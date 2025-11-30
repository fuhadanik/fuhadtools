/**
 * CSV Generator for Salesforce Layout Metadata
 * Extracts fields from layouts and generates transposed CSV with metadata
 */

/**
 * Extract field details from describe metadata
 */
function getFieldDetails(fieldName, describe) {
  const field = describe.fields.find(f => f.name === fieldName);

  if (!field) {
    return {
      apiName: fieldName,
      type: 'Unknown',
      length: '',
      precision: '',
      required: false,
      readOnly: false,
      picklistValues: '',
      helpText: '',
      referenceTo: '',
    };
  }

  return {
    apiName: field.name,
    label: field.label,
    type: field.type,
    length: field.length || '',
    precision: field.precision || '',
    scale: field.scale || '',
    required: !field.nillable,
    readOnly: !field.updateable,
    picklistValues: field.picklistValues
      ? field.picklistValues.map(pv => pv.value).join('; ')
      : '',
    helpText: field.inlineHelpText || '',
    referenceTo: field.referenceTo ? field.referenceTo.join(', ') : '',
    defaultValue: field.defaultValue || '',
  };
}

/**
 * Parse standard Layout metadata
 */
export function parseLayoutMetadata(layoutMetadata, describe) {
  const fields = [];

  // Try both property names (layoutSections and detailLayoutSections)
  const sections = layoutMetadata.layoutSections || layoutMetadata.detailLayoutSections || [];

  sections.forEach(section => {
    const sectionName = section.label || section.heading || 'Unnamed Section';

    // Process layout columns
    if (section.layoutColumns) {
      section.layoutColumns.forEach(column => {
        if (column.layoutItems) {
          column.layoutItems.forEach(item => {
            if (item.field) {
              // Direct field reference
              const details = getFieldDetails(item.field, describe);
              fields.push({
                section: sectionName,
                ...details,
              });
            } else if (item.layoutComponents) {
              // Components array
              item.layoutComponents.forEach(component => {
                if (component.type === 'Field' && component.value) {
                  const details = getFieldDetails(component.value, describe);
                  fields.push({
                    section: sectionName,
                    ...details,
                  });
                }
              });
            }
          });
        }
      });
    }
  });

  return fields;
}

/**
 * Parse FlexiPage metadata (Lightning Record Page)
 */
export function parseFlexiPageMetadata(flexiPageMetadata, describe) {
  const fields = [];

  try {
    // Parse the Metadata JSON string
    const metadata = typeof flexiPageMetadata.Metadata === 'string'
      ? JSON.parse(flexiPageMetadata.Metadata)
      : flexiPageMetadata.Metadata;

    // Recursively extract field references from components
    function extractFields(component, sectionName = 'FlexiPage') {
      if (!component) return;

      // Check if this is a field component
      if (component.componentType === 'Field' && component.name) {
        const details = getFieldDetails(component.name, describe);
        fields.push({
          section: sectionName,
          ...details,
        });
      }

      // Check componentAttributes for field references
      if (component.componentAttributes) {
        const fieldAttr = component.componentAttributes.find(
          attr => attr.name === 'fieldName' || attr.name === 'name'
        );

        if (fieldAttr && fieldAttr.value) {
          const details = getFieldDetails(fieldAttr.value, describe);
          fields.push({
            section: sectionName,
            ...details,
          });
        }
      }

      // Recursively process child components
      if (component.componentInstances) {
        component.componentInstances.forEach(child => {
          const childSection = component.name || sectionName;
          extractFields(child, childSection);
        });
      }

      // Process items array if present
      if (component.items) {
        component.items.forEach(item => extractFields(item, sectionName));
      }
    }

    // Start extraction from flexiPageRegions
    if (metadata.flexiPageRegions) {
      metadata.flexiPageRegions.forEach(region => {
        const regionName = region.name || 'Main';
        if (region.itemInstances) {
          region.itemInstances.forEach(item => {
            extractFields(item.componentInstance, regionName);
          });
        }
      });
    }

  } catch (error) {
    console.error('Error parsing FlexiPage metadata:', error);
  }

  return fields;
}

/**
 * Generate transposed CSV from field data
 */
export function generateTransposedCsv(fields) {
  if (!fields || fields.length === 0) {
    return 'No fields found';
  }

  // Define the rows (field attributes)
  const attributes = [
    { key: 'section', label: 'Section' },
    { key: 'apiName', label: 'API Name' },
    { key: 'label', label: 'Label' },
    { key: 'type', label: 'Type' },
    { key: 'length', label: 'Length' },
    { key: 'precision', label: 'Precision' },
    { key: 'scale', label: 'Scale' },
    { key: 'required', label: 'Required' },
    { key: 'readOnly', label: 'Read Only' },
    { key: 'picklistValues', label: 'Picklist Values' },
    { key: 'referenceTo', label: 'Reference To' },
    { key: 'helpText', label: 'Help Text' },
    { key: 'defaultValue', label: 'Default Value' },
  ];

  // Build CSV rows
  const csvRows = [];

  // Header row (Field 1, Field 2, etc.)
  const headerRow = ['Attribute', ...fields.map((_, i) => `Field ${i + 1}`)];
  csvRows.push(headerRow);

  // Data rows (transposed)
  attributes.forEach(attr => {
    const row = [attr.label];
    fields.forEach(field => {
      let value = field[attr.key];

      // Convert boolean to Yes/No
      if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }

      // Escape and quote values that contain commas, quotes, or newlines
      if (value !== null && value !== undefined) {
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
      } else {
        value = '';
      }

      row.push(value);
    });
    csvRows.push(row);
  });

  // Join into CSV string
  return csvRows.map(row => row.join(',')).join('\n');
}
