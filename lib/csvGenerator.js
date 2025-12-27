/**
 * CSV Generator for Salesforce Layout Metadata
 * Extracts fields from layouts and generates transposed CSV with metadata
 */

/**
 * Extract field details from describe metadata
 * @param {string} fieldName - The API name of the field
 * @param {object} describe - The object describe metadata
 * @param {boolean} layoutRequired - Whether the field is required on the layout (optional)
 * @param {object} rtPicklists - Record type-specific picklist values (optional)
 */
function getFieldDetails(fieldName, describe, layoutRequired = null, rtPicklists = null) {
  const field = describe.fields.find(f => f.name === fieldName);

  if (!field) {
    return {
      apiName: fieldName,
      type: 'Unknown',
      length: '',
      precision: '',
      required: layoutRequired || false,
      layoutRequired: layoutRequired || false,
      fieldRequired: false,
      readOnly: false,
      picklistValues: '',
      helpText: '',
      referenceTo: '',
    };
  }

  // Field-level required (from metadata - nillable = false)
  const fieldRequired = !field.nillable;

  // Layout-level required (from page layout configuration)
  // If layoutRequired is explicitly set, use it; otherwise fall back to field-level
  const isRequired = layoutRequired !== null ? layoutRequired : fieldRequired;

  // Get picklist values - use RT-specific if available, otherwise fall back to global
  let picklistValues = '';
  if (rtPicklists && rtPicklists[fieldName]) {
    // Use record type-specific picklist values
    picklistValues = rtPicklists[fieldName].join('; ');
  } else if (field.picklistValues) {
    // Fall back to global picklist values from object describe
    picklistValues = field.picklistValues.map(pv => pv.value).join('; ');
  }

  return {
    apiName: field.name,
    label: field.label,
    type: field.type,
    length: field.length || '',
    precision: field.precision || '',
    scale: field.scale || '',
    required: isRequired,
    layoutRequired: layoutRequired || false,
    fieldRequired: fieldRequired,
    readOnly: !field.updateable,
    picklistValues: picklistValues,
    helpText: field.inlineHelpText || '',
    referenceTo: field.referenceTo ? field.referenceTo.join(', ') : '',
    defaultValue: field.defaultValue || '',
  };
}

/**
 * Parse standard Layout metadata
 * Extracts fields with their layout-level required setting
 * @param {object} layoutMetadata - The layout metadata from Salesforce
 * @param {object} describe - The object describe metadata
 * @param {object} rtPicklists - Record type-specific picklist values (optional)
 */
export function parseLayoutMetadata(layoutMetadata, describe, rtPicklists = null) {
  const fields = [];

  console.log('Parsing layout metadata, sections:', layoutMetadata.detailLayoutSections?.length);

  layoutMetadata.detailLayoutSections?.forEach(section => {
    const sectionName = section.heading || 'Unnamed Section';

    section.layoutRows?.forEach(row => {
      row.layoutItems?.forEach(item => {
        // Get the layout-level required setting from the item
        // This is set when admin marks field as required on the page layout
        const layoutRequired = item.required === true;

        if (item.layoutComponents) {
          item.layoutComponents.forEach(component => {
            if (component.type === 'Field' && component.value) {
              // Pass layoutRequired and rtPicklists to get correct required status and picklist values
              const details = getFieldDetails(component.value, describe, layoutRequired, rtPicklists);
              fields.push({
                section: sectionName,
                ...details,
              });
            }
          });
        }
      });
    });
  });

  console.log('Parsed', fields.length, 'fields, required fields:', fields.filter(f => f.required).length);

  return fields;
}

/**
 * Parse FlexiPage metadata (Lightning Record Page)
 * Based on proven parsing logic that follows the FlexiPage structure:
 * fieldSection → columns facet → column → body facet → fieldInstance
 * @param {object} flexiPageMetadata - The FlexiPage metadata from Salesforce
 * @param {object} describe - The object describe metadata
 * @param {object} rtPicklists - Record type-specific picklist values (optional)
 */
export function parseFlexiPageMetadata(flexiPageMetadata, describe, rtPicklists = null) {
  const fields = [];
  const seenFields = new Set();
  let usesRecordDetail = false;

  // Build field map for lookups
  const fieldMap = new Map();
  describe.fields.forEach(f => {
    fieldMap.set(f.name, f);
    fieldMap.set(f.name.toLowerCase(), f);
  });

  // Helper to recursively find a property value in an object
  function findPropertyValue(obj, propName) {
    if (!obj || typeof obj !== 'object') return null;

    // Direct property check
    if (obj[propName] !== undefined) {
      return obj[propName];
    }

    // Check in arrays of properties
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && item.name === propName) {
          return item.value;
        }
        const found = findPropertyValue(item, propName);
        if (found !== null) return found;
      }
    }

    // Recurse into object properties
    for (const key of Object.keys(obj)) {
      if (key === propName) {
        return obj[key];
      }
      const found = findPropertyValue(obj[key], propName);
      if (found !== null) return found;
    }

    return null;
  }

  // Helper to add field without duplicates
  function addField(fieldName, sectionName, fieldInstanceProps = null, fullItemContext = null) {
    if (!fieldName || seenFields.has(fieldName)) return;
    seenFields.add(fieldName);

    // Check if field is required from fieldInstance properties
    let layoutRequired = null;

    if (fieldInstanceProps) {
      // Method 1: Check uiBehavior property (Lightning Pages store required as uiBehavior: "required")
      if (fieldInstanceProps.fieldInstanceProperties) {
        const uiBehaviorProp = fieldInstanceProps.fieldInstanceProperties.find(p => p.name === 'uiBehavior');
        if (uiBehaviorProp && uiBehaviorProp.value === 'required') {
          layoutRequired = true;
        } else if (uiBehaviorProp && uiBehaviorProp.value === 'readonly') {
          // Field is read-only on layout, not required
          layoutRequired = false;
        }

        // Also check for explicit required property
        if (layoutRequired === null) {
          const reqProp = fieldInstanceProps.fieldInstanceProperties.find(p => p.name === 'required');
          if (reqProp) {
            layoutRequired = reqProp.value === 'true' || reqProp.value === true;
          }
        }
      }

      // Method 2: Check direct 'required' property on fieldInstance
      if (layoutRequired === null && fieldInstanceProps.required !== undefined) {
        layoutRequired = fieldInstanceProps.required === true || fieldInstanceProps.required === 'true';
      }

      // Method 3: Check visibilityRule or behaviorProperties for required
      if (layoutRequired === null && fieldInstanceProps.behaviorProperties) {
        const reqBehavior = fieldInstanceProps.behaviorProperties.find(p => p.name === 'required');
        if (reqBehavior) {
          layoutRequired = reqBehavior.value === 'true' || reqBehavior.value === true;
        }
      }
    }

    if (layoutRequired === true) {
      console.log('FlexiPage required field found:', fieldName);
    }

    const details = getFieldDetails(fieldName, describe, layoutRequired, rtPicklists);
    fields.push({
      section: sectionName,
      ...details,
    });
  }

  // Recursively find components by name
  function findComponentsRecursively(obj, componentName, results = []) {
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
  }

  // Get property value from componentInstanceProperties
  function getPropertyValue(component, propName) {
    if (!component.componentInstanceProperties) return null;
    const prop = component.componentInstanceProperties.find(p => p.name === propName);
    return prop ? prop.value : null;
  }

  try {
    // Parse the Metadata JSON string if needed
    const metadata = typeof flexiPageMetadata.Metadata === 'string'
      ? JSON.parse(flexiPageMetadata.Metadata)
      : flexiPageMetadata.Metadata;

    if (!metadata) {
      console.log('FlexiPage: No Metadata field found');
      return fields;
    }

    // Build map of regions by name
    const regionsByName = new Map();
    if (metadata.flexiPageRegions) {
      metadata.flexiPageRegions.forEach(region => regionsByName.set(region.name, region));
    }

    // Check for recordDetail component (means it uses standard layout)
    const recordDetailComponents = findComponentsRecursively(metadata, 'flexipage:recordDetail');
    const forceRecordDetail = findComponentsRecursively(metadata, 'force:recordDetail');
    if (recordDetailComponents.length > 0 || forceRecordDetail.length > 0) {
      usesRecordDetail = true;
    }

    // Find all fieldSection components
    const fieldSections = findComponentsRecursively(metadata, 'flexipage:fieldSection');
    console.log('Found', fieldSections.length, 'fieldSection components');

    fieldSections.forEach(sectionComp => {
      // Get section label, clean up SFDC markers
      let sectionLabel = (getPropertyValue(sectionComp, 'label') || 'Unnamed Section')
        .replace(/@@@SFDC/g, '')
        .replace(/SFDC@@@/g, '')
        .replace(/_/g, ' ')
        .trim();

      // Get the columns facet reference
      const columnsFacetId = getPropertyValue(sectionComp, 'columns');

      if (columnsFacetId && regionsByName.has(columnsFacetId)) {
        const columnsRegion = regionsByName.get(columnsFacetId);

        if (columnsRegion.itemInstances) {
          columnsRegion.itemInstances.forEach(colItem => {
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
                      // Pass the fieldInstance and full item context to extract required property
                      addField(fieldName, sectionLabel, fieldItem.fieldInstance, fieldItem);
                    }
                  });
                }
              }
            }
          });
        }
      }
    });

    // Also check for direct field instances in Facet regions (for simpler FlexiPages)
    if (fields.length === 0 && metadata.flexiPageRegions) {
      metadata.flexiPageRegions.forEach(region => {
        if (region.itemInstances) {
          region.itemInstances.forEach(item => {
            if (item.fieldInstance && item.fieldInstance.fieldItem) {
              let fieldName = item.fieldInstance.fieldItem;
              if (fieldName.startsWith('Record.')) {
                fieldName = fieldName.replace('Record.', '');
              }
              const sectionName = region.name && !region.name.startsWith('Facet-')
                ? region.name
                : 'Fields';
              // Pass the fieldInstance and full item context to extract required property
              addField(fieldName, sectionName, item.fieldInstance, item);
            }
          });
        }
      });
    }

    console.log('Extracted', fields.length, 'fields from FlexiPage');

    // If uses recordDetail and no fields found, show info message
    if (usesRecordDetail && fields.length === 0) {
      fields.push({
        section: 'Note',
        apiName: '(Uses Page Layout)',
        label: 'This Lightning Page uses the Page Layout for field display',
        type: 'Info',
        length: '',
        precision: '',
        required: false,
        readOnly: true,
        picklistValues: '',
        helpText: 'Select the corresponding Page Layout to see field details',
        referenceTo: '',
      });
    }

  } catch (error) {
    console.error('Error parsing FlexiPage metadata:', error);
  }

  return fields;
}

/**
 * Escape CSV value
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';

  // Convert boolean to Yes/No
  if (typeof value === 'boolean') {
    value = value ? 'Yes' : 'No';
  }

  value = String(value);

  // Escape and quote values that contain commas, quotes, or newlines
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    value = '"' + value.replace(/"/g, '""') + '"';
  }

  return value;
}

/**
 * Generate horizontal CSV (standard format - rows are records)
 */
export function generateHorizontalCsv(fields) {
  if (!fields || fields.length === 0) {
    return 'No fields found';
  }

  const attributes = [
    { key: 'section', label: 'Section' },
    { key: 'label', label: 'Field Label' },
    { key: 'apiName', label: 'API Name' },
    { key: 'type', label: 'Type' },
    { key: 'length', label: 'Length' },
    { key: 'required', label: 'Required' },
    { key: 'layoutRequired', label: 'Layout Required' },
    { key: 'fieldRequired', label: 'Field Required' },
    { key: 'readOnly', label: 'Read Only' },
    { key: 'picklistValues', label: 'Picklist Values' },
    { key: 'referenceTo', label: 'Reference To' },
    { key: 'helpText', label: 'Help Text' },
  ];

  const csvRows = [];

  // Header row
  csvRows.push(attributes.map(attr => attr.label));

  // Data rows
  fields.forEach(field => {
    const row = attributes.map(attr => escapeCsvValue(field[attr.key]));
    csvRows.push(row);
  });

  return csvRows.map(row => row.join(',')).join('\n');
}

/**
 * Generate vertical/transposed CSV (attributes as rows, fields as columns)
 */
export function generateTransposedCsv(fields) {
  if (!fields || fields.length === 0) {
    return 'No fields found';
  }

  const attributes = [
    { key: 'section', label: 'Section' },
    { key: 'label', label: 'Field Label' },
    { key: 'apiName', label: 'API Name' },
    { key: 'type', label: 'Type' },
    { key: 'length', label: 'Length' },
    { key: 'required', label: 'Required' },
    { key: 'layoutRequired', label: 'Layout Required' },
    { key: 'fieldRequired', label: 'Field Required' },
    { key: 'readOnly', label: 'Read Only' },
    { key: 'picklistValues', label: 'Picklist Values' },
    { key: 'referenceTo', label: 'Reference To' },
    { key: 'helpText', label: 'Help Text' },
  ];

  const csvRows = [];

  // Header row (Attribute, Field 1, Field 2, etc.)
  const headerRow = ['Attribute', ...fields.map((_, i) => `Field ${i + 1}`)];
  csvRows.push(headerRow);

  // Data rows (transposed)
  attributes.forEach(attr => {
    const row = [attr.label, ...fields.map(field => escapeCsvValue(field[attr.key]))];
    csvRows.push(row);
  });

  return csvRows.map(row => row.join(',')).join('\n');
}
