import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/mockup?object=Account&layoutId=00hxxxx&layoutType=Layout&recordTypeId=012xxx
 * Returns layout structure for mockup view - preserves sections and column layout
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { object, layoutId, layoutType, recordTypeId } = req.query;

  if (!object || !layoutId) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'object and layoutId are required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please login first',
    });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    // Get object describe for field metadata
    const describe = await sfClient.describeObject(object);
    const fieldMap = new Map();
    describe.fields.forEach(f => {
      fieldMap.set(f.name, f);
    });

    // Fetch RT-specific picklist values if recordTypeId is provided
    let rtPicklists = null;
    if (recordTypeId) {
      rtPicklists = await sfClient.getPicklistValuesForRecordType(object, recordTypeId);
    }

    let sections = [];
    let picklistFields = [];
    let relatedLists = [];

    // Helper to format type display
    const formatType = (field) => {
      if (!field) return 'Unknown';
      let typeDisplay = field.type || 'Unknown';

      // Handle reference fields - show lookup/master-detail with related object
      if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
        const relatedObjects = field.referenceTo.join(', ');
        // Check if it's master-detail (relationshipOrder is not null) or lookup
        if (field.relationshipOrder !== null && field.relationshipOrder !== undefined) {
          typeDisplay = `master-detail(${relatedObjects})`;
        } else {
          typeDisplay = `lookup(${relatedObjects})`;
        }
        return typeDisplay;
      }

      if (field.length && field.type !== 'boolean' && field.type !== 'date' && field.type !== 'datetime') {
        typeDisplay = `${field.type} (${field.length})`;
      }
      if (field.precision && field.scale !== undefined) {
        typeDisplay = `${field.type} (${field.precision},${field.scale})`;
      }
      return typeDisplay;
    };

    // Helper to get picklist values
    const getPicklistValues = (fieldName, field) => {
      if (rtPicklists && rtPicklists[fieldName]) {
        return rtPicklists[fieldName];
      } else if (field?.picklistValues) {
        return field.picklistValues.map(pv => pv.value);
      }
      return [];
    };

    if (layoutType === 'FlexiPage') {
      // Handle FlexiPage (Lightning Record Page)
      console.log('Mockup: Parsing FlexiPage');
      const flexiPageMetadata = await sfClient.getFlexiPageMetadata(layoutId);

      // Parse the Metadata JSON string if needed
      const metadata = typeof flexiPageMetadata.Metadata === 'string'
        ? JSON.parse(flexiPageMetadata.Metadata)
        : flexiPageMetadata.Metadata;

      if (!metadata) {
        return res.status(200).json({
          objectName: object,
          layoutId: layoutId,
          sections: [],
          picklistFields: [],
          message: 'No metadata found in FlexiPage',
        });
      }

      // Build map of regions by name
      const regionsByName = new Map();
      if (metadata.flexiPageRegions) {
        metadata.flexiPageRegions.forEach(region => regionsByName.set(region.name, region));
      }

      // Helper to get property value from component
      const getPropertyValue = (component, propName) => {
        if (!component.componentInstanceProperties) return null;
        const prop = component.componentInstanceProperties.find(p => p.name === propName);
        return prop ? prop.value : null;
      };

      // Recursively find components by name
      const findComponentsRecursively = (obj, componentName, results = []) => {
        if (!obj || typeof obj !== 'object') return results;
        if (obj.componentName === componentName) results.push(obj);
        Object.keys(obj).forEach(key => {
          if (Array.isArray(obj[key])) {
            obj[key].forEach(child => findComponentsRecursively(child, componentName, results));
          } else if (typeof obj[key] === 'object') {
            findComponentsRecursively(obj[key], componentName, results);
          }
        });
        return results;
      };

      // Find all fieldSection components
      const fieldSections = findComponentsRecursively(metadata, 'flexipage:fieldSection');
      console.log('Mockup: Found', fieldSections.length, 'fieldSection components');

      const seenFields = new Set();

      fieldSections.forEach(sectionComp => {
        // Get section label
        let sectionLabel = (getPropertyValue(sectionComp, 'label') || 'Unnamed Section')
          .replace(/@@@SFDC/g, '')
          .replace(/SFDC@@@/g, '')
          .replace(/_/g, ' ')
          .trim();

        const sectionData = {
          heading: sectionLabel,
          useHeading: true,
          columns: 2, // Default to 2 columns
          rows: [],
        };

        // Get the columns facet reference
        const columnsFacetId = getPropertyValue(sectionComp, 'columns');

        if (columnsFacetId && regionsByName.has(columnsFacetId)) {
          const columnsRegion = regionsByName.get(columnsFacetId);

          // Collect fields from each column
          const columnFields = [[], []]; // Support up to 2 columns

          if (columnsRegion.itemInstances) {
            columnsRegion.itemInstances.forEach((colItem, colIndex) => {
              const colComp = colItem.componentInstance;

              if (colComp && colComp.componentName === 'flexipage:column') {
                const bodyFacetId = getPropertyValue(colComp, 'body');

                if (bodyFacetId && regionsByName.has(bodyFacetId)) {
                  const bodyRegion = regionsByName.get(bodyFacetId);

                  if (bodyRegion.itemInstances) {
                    bodyRegion.itemInstances.forEach(fieldItem => {
                      if (fieldItem.fieldInstance) {
                        let fieldName = fieldItem.fieldInstance.fieldItem;
                        // Remove "Record." prefix
                        if (fieldName && fieldName.startsWith('Record.')) {
                          fieldName = fieldName.replace('Record.', '');
                        }

                        if (fieldName && !seenFields.has(fieldName)) {
                          seenFields.add(fieldName);
                          const field = fieldMap.get(fieldName);

                          // Check for required from fieldInstanceProperties
                          let required = !field?.nillable;
                          if (fieldItem.fieldInstance.fieldInstanceProperties) {
                            const uiBehaviorProp = fieldItem.fieldInstance.fieldInstanceProperties.find(p => p.name === 'uiBehavior');
                            if (uiBehaviorProp && uiBehaviorProp.value === 'required') {
                              required = true;
                            }
                          }

                          const picklistValues = getPicklistValues(fieldName, field);

                          columnFields[colIndex % 2].push({
                            fieldName: fieldName,
                            label: field?.label || fieldName,
                            type: formatType(field),
                            required: required,
                            picklistValues: picklistValues,
                            isBlank: false,
                          });
                        }
                      }
                    });
                  }
                }
              }
            });
          }

          // Determine actual column count
          sectionData.columns = columnFields[1].length > 0 ? 2 : 1;

          // Create rows - pair up fields from left and right columns
          const maxRows = Math.max(columnFields[0].length, columnFields[1].length);
          for (let i = 0; i < maxRows; i++) {
            const rowData = { items: [] };

            // Left column
            if (columnFields[0][i]) {
              rowData.items.push(columnFields[0][i]);
            } else {
              rowData.items.push({
                fieldName: null,
                label: '',
                type: '',
                required: false,
                picklistValues: [],
                isBlank: true,
              });
            }

            // Right column (if 2-column layout)
            if (sectionData.columns >= 2) {
              if (columnFields[1][i]) {
                rowData.items.push(columnFields[1][i]);
              } else {
                rowData.items.push({
                  fieldName: null,
                  label: '',
                  type: '',
                  required: false,
                  picklistValues: [],
                  isBlank: true,
                });
              }
            }

            sectionData.rows.push(rowData);
          }
        }

        // Only add section if it has rows
        if (sectionData.rows.length > 0) {
          sections.push(sectionData);
        }
      });

      // If no fieldSections found, try direct field instances in regions
      if (sections.length === 0 && metadata.flexiPageRegions) {
        const directFields = [];
        metadata.flexiPageRegions.forEach(region => {
          if (region.itemInstances) {
            region.itemInstances.forEach(item => {
              if (item.fieldInstance && item.fieldInstance.fieldItem) {
                let fieldName = item.fieldInstance.fieldItem;
                if (fieldName.startsWith('Record.')) {
                  fieldName = fieldName.replace('Record.', '');
                }
                if (fieldName && !seenFields.has(fieldName)) {
                  seenFields.add(fieldName);
                  const field = fieldMap.get(fieldName);
                  const picklistValues = getPicklistValues(fieldName, field);
                  directFields.push({
                    fieldName: fieldName,
                    label: field?.label || fieldName,
                    type: formatType(field),
                    required: !field?.nillable,
                    picklistValues: picklistValues,
                    isBlank: false,
                  });
                }
              }
            });
          }
        });

        if (directFields.length > 0) {
          const sectionData = {
            heading: 'Fields',
            useHeading: true,
            columns: 2,
            rows: [],
          };

          // Create 2-column layout
          for (let i = 0; i < directFields.length; i += 2) {
            const rowData = { items: [directFields[i]] };
            if (directFields[i + 1]) {
              rowData.items.push(directFields[i + 1]);
            } else {
              rowData.items.push({
                fieldName: null,
                label: '',
                type: '',
                required: false,
                picklistValues: [],
                isBlank: true,
              });
            }
            sectionData.rows.push(rowData);
          }

          sections.push(sectionData);
        }
      }

      console.log('Mockup: Extracted', sections.length, 'sections from FlexiPage');

      // Extract related lists from FlexiPage
      // Helper to format related list name into readable label
      const formatRelatedListLabel = (name) => {
        if (!name) return 'Unknown';
        // Remove common prefixes/suffixes
        let label = name
          .replace(/^Related_/i, '')
          .replace(/__r$/i, '')
          .replace(/__c$/i, '')
          .replace(/_/g, ' ');
        // Capitalize words
        return label.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      };

      // Collect ALL component instances from the entire FlexiPage
      const allComponentInstances = [];
      const collectComponents = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.componentInstance) allComponentInstances.push(obj.componentInstance);
        if (obj.componentName) allComponentInstances.push(obj);
        Object.values(obj).forEach(val => {
          if (Array.isArray(val)) val.forEach(collectComponents);
          else if (typeof val === 'object') collectComponents(val);
        });
      };
      collectComponents(metadata);

      console.log('Mockup: Found', allComponentInstances.length, 'total components in FlexiPage');

      // Find all related list components - look for specific component types
      allComponentInstances.forEach(comp => {
        const compName = comp.componentName || '';

        // Check for lst:dynamicRelatedList or force:relatedListSingleContainer
        if (compName === 'lst:dynamicRelatedList' ||
            compName === 'force:relatedListSingleContainer' ||
            compName === 'force:relatedListSingle' ||
            compName.toLowerCase().includes('relatedlist')) {

          // Get the related list API name
          const relatedListApiName = getPropertyValue(comp, 'relatedListApiName');
          // Get the label
          const relatedListLabel = getPropertyValue(comp, 'relatedListLabel') ||
                                   getPropertyValue(comp, 'label') ||
                                   getPropertyValue(comp, 'title');

          // Get columns from relatedListFieldAliases if available
          const columns = [];
          if (comp.componentInstanceProperties) {
            const fieldAliasesProp = comp.componentInstanceProperties.find(p => p.name === 'relatedListFieldAliases');
            if (fieldAliasesProp && fieldAliasesProp.valueList && fieldAliasesProp.valueList.valueListItems) {
              fieldAliasesProp.valueList.valueListItems.forEach(item => {
                if (item.value) {
                  columns.push({
                    field: item.value,
                    label: item.value.replace(/__c$/, '').replace(/_/g, ' '),
                  });
                }
              });
            }
          }

          if (relatedListApiName && !relatedLists.find(r => r.name === relatedListApiName)) {
            console.log('Mockup: Found related list:', relatedListApiName, '- Label:', relatedListLabel);
            relatedLists.push({
              name: relatedListApiName,
              label: relatedListLabel || formatRelatedListLabel(relatedListApiName),
              columns: columns,
            });
          }
        }
      });

      if (relatedLists.length > 0) {
        console.log('Mockup: Extracted', relatedLists.length, 'related lists from FlexiPage metadata');
      }

      // Only fetch from Page Layout if no related lists found in FlexiPage
      // The FlexiPage has its own related list components defined
      if (relatedLists.length === 0 && recordTypeId) {
        console.log('Mockup: Fetching related lists from associated Page Layout...');
        try {
          // Get the layouts to find which one is assigned to this record type
          const layoutsResponse = await sfClient.getLayoutsForObject(object);
          if (layoutsResponse.recordTypeMappings) {
            const rtMapping = layoutsResponse.recordTypeMappings.find(
              m => m.recordTypeId === recordTypeId
            );
            if (rtMapping && rtMapping.layoutId) {
              console.log('Mockup: Found Page Layout ID:', rtMapping.layoutId);

              // Keep FlexiPage-specific related lists
              const flexiPageRelatedLists = [...relatedLists];
              relatedLists = [];

              // First try describe/layouts endpoint
              const pageLayoutMetadata = await sfClient.getLayoutMetadata(object, rtMapping.layoutId);

              // Extract from relatedLists array
              if (pageLayoutMetadata.relatedLists && pageLayoutMetadata.relatedLists.length > 0) {
                console.log('Mockup: Found', pageLayoutMetadata.relatedLists.length, 'in describe relatedLists');
                pageLayoutMetadata.relatedLists.forEach(rl => {
                  const columns = [];
                  if (rl.columns) {
                    rl.columns.forEach(col => {
                      columns.push({
                        field: col.field || col.name,
                        label: col.label || col.field || col.name,
                      });
                    });
                  }
                  const name = rl.relatedList || rl.name || rl.sobject;
                  const label = rl.label || rl.relatedList || rl.name;
                  if (name && !relatedLists.find(r => r.name === name)) {
                    relatedLists.push({ name, label, columns });
                  }
                });
              }

              // If no related lists from describe, try Tooling API directly
              if (relatedLists.length === 0) {
                console.log('Mockup: No related lists from describe, trying Tooling API...');
                const toolingRelatedLists = await sfClient.getLayoutRelatedLists(rtMapping.layoutId);
                if (toolingRelatedLists.length > 0) {
                  console.log('Mockup: Found', toolingRelatedLists.length, 'from Tooling API');
                  relatedLists = toolingRelatedLists;
                }
              }

              // Also check relatedContent section - but filter out field references
              if (relatedLists.length === 0 && pageLayoutMetadata.relatedContent && pageLayoutMetadata.relatedContent.relatedContentItems) {
                console.log('Mockup: Checking relatedContent items');
                pageLayoutMetadata.relatedContent.relatedContentItems.forEach(item => {
                  if (item.layoutItem && item.layoutItem.layoutComponents) {
                    item.layoutItem.layoutComponents.forEach(comp => {
                      // Skip field references (contain .Id, .Name, etc.) - these aren't related lists
                      if (comp.value &&
                          !comp.value.includes('.') &&
                          !relatedLists.find(r => r.name === comp.value)) {
                        relatedLists.push({
                          name: comp.value,
                          label: comp.value.replace(/__r$/, '').replace(/__c$/, '').replace(/_/g, ' '),
                          columns: [],
                        });
                      }
                    });
                  }
                });
              }

              // Now add back any FlexiPage-specific related lists that aren't already in Page Layout
              flexiPageRelatedLists.forEach(fpRl => {
                if (!relatedLists.find(r => r.name === fpRl.name)) {
                  relatedLists.push(fpRl);
                }
              });

              console.log('Mockup: Extracted', relatedLists.length, 'total related lists (Page Layout + FlexiPage)');
            }
          }
        } catch (err) {
          console.log('Mockup: Could not fetch Page Layout related lists:', err.message);
        }
      }

      // Log final related lists count
      console.log('Mockup: Final related lists count:', relatedLists.length);

    } else {
      // Handle Page Layout (Classic)
      console.log('Mockup: Parsing Page Layout');
      const layoutMetadata = await sfClient.getLayoutMetadata(object, layoutId);

      layoutMetadata.detailLayoutSections?.forEach(section => {
        const sectionData = {
          heading: section.heading || 'Unnamed Section',
          useHeading: section.useHeading !== false,
          columns: section.columns || 2,
          rows: [],
        };

        // Determine actual column count from first row
        if (section.layoutRows && section.layoutRows.length > 0) {
          const firstRow = section.layoutRows[0];
          if (firstRow.layoutItems) {
            sectionData.columns = firstRow.layoutItems.length || 1;
          }
        }

        section.layoutRows?.forEach(row => {
          const rowData = { items: [] };

          row.layoutItems?.forEach((item, colIndex) => {
            let fieldName = null;
            let isBlank = true;

            if (item.layoutComponents) {
              item.layoutComponents.forEach(component => {
                if (component.type === 'Field' && component.value) {
                  fieldName = component.value;
                  isBlank = false;
                }
              });
            }

            if (fieldName) {
              const field = fieldMap.get(fieldName);
              const picklistValues = getPicklistValues(fieldName, field);

              rowData.items.push({
                column: colIndex,
                fieldName: fieldName,
                label: field?.label || fieldName,
                type: formatType(field),
                required: item.required || !field?.nillable,
                picklistValues: picklistValues,
                isBlank: false,
              });
            } else {
              rowData.items.push({
                column: colIndex,
                fieldName: null,
                label: '',
                type: '',
                required: false,
                picklistValues: [],
                isBlank: true,
              });
            }
          });

          // Only add row if it has at least one non-blank item
          if (rowData.items.some(item => !item.isBlank)) {
            sectionData.rows.push(rowData);
          }
        });

        // Only add section if it has rows
        if (sectionData.rows.length > 0) {
          sections.push(sectionData);
        }
      });

      console.log('Mockup: Extracted', sections.length, 'sections from Page Layout');

      // Extract related lists from Page Layout
      if (layoutMetadata.relatedLists && layoutMetadata.relatedLists.length > 0) {
        layoutMetadata.relatedLists.forEach(rl => {
          const columns = [];
          if (rl.columns) {
            rl.columns.forEach(col => {
              columns.push({
                field: col.field || col.name,
                label: col.label || col.field || col.name,
              });
            });
          }

          relatedLists.push({
            name: rl.relatedList || rl.name,
            label: rl.label || rl.relatedList || rl.name,
            columns: columns,
          });
        });
        console.log('Mockup: Extracted', relatedLists.length, 'related lists');
      }
    }

    // Collect all picklist fields with their values
    sections.forEach(section => {
      section.rows.forEach(row => {
        row.items.forEach(item => {
          if (!item.isBlank && item.picklistValues && item.picklistValues.length > 0) {
            // Check if already added (avoid duplicates)
            if (!picklistFields.find(p => p.fieldName === item.fieldName)) {
              picklistFields.push({
                fieldName: item.fieldName,
                label: item.label,
                values: item.picklistValues,
              });
            }
          }
        });
      });
    });

    // Sort picklist fields alphabetically by label
    picklistFields.sort((a, b) => a.label.localeCompare(b.label));

    return res.status(200).json({
      objectName: object,
      layoutId: layoutId,
      layoutType: layoutType || 'Layout',
      sections: sections,
      relatedLists: relatedLists,
      picklistFields: picklistFields,
    });

  } catch (error) {
    console.error('Mockup error:', error);
    return res.status(500).json({
      error: 'Mockup generation failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
