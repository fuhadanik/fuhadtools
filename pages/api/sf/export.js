import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { requireAuth, withErrorHandling, compose } from '@/lib/apiMiddleware';
import {
  parseLayoutMetadata,
  parseFlexiPageMetadata,
  generateTransposedCsv,
} from '@/lib/csvGenerator';

/**
 * Generate CSV in vertical format (standard)
 */
function generateVerticalCsv(fields) {
  const headers = [
    'Section', 'Layout Mode', 'Field Label (XML)', 'Field API Name', 'Label (Data)',
    'Type', 'Length', 'Precision', 'Scale', 'Required', 'Read Only',
    'Default Value', 'Help Text', 'Reference To', 'Picklist Values'
  ];

  const rows = [headers];

  fields.forEach(field => {
    rows.push([
      field.section || '',
      field.layoutMode || 'FlexiPage',
      field.fieldLabelXml || field.apiName,
      field.apiName,
      field.label || '',
      field.type || '',
      field.length || '',
      field.precision || '',
      field.scale || '',
      field.required ? 'Yes' : 'No',
      field.readOnly ? 'Yes' : 'No',
      field.defaultValue || '',
      field.helpText || '',
      field.referenceTo || '',
      field.picklistValues || ''
    ]);
  });

  return rows.map(row =>
    row.map(cell => {
      const str = String(cell || '');
      return (str.includes(',') || str.includes('"') || str.includes('\n'))
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  ).join('\n');
}

/**
 * Generate XML format
 */
function generateXml(fields) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<LayoutMetadata>\n';

  fields.forEach(field => {
    xml += '  <Field>\n';
    for (const [key, value] of Object.entries(field)) {
      const escapedValue = String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      xml += `    <${key}>${escapedValue}</${key}>\n`;
    }
    xml += '  </Field>\n';
  });

  xml += '</LayoutMetadata>';
  return xml;
}

/**
 * GET /api/sf/export?object=Account&layoutId=00hxxxx&layoutType=Layout&format=csv&orientation=vertical
 * Exports layout metadata in various formats
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { object, layoutId, layoutType, format = 'csv', orientation = 'vertical' } = req.query;

  // Validate parameters
  if (!object || !layoutId || !layoutType) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'object, layoutId, and layoutType are required',
    });
  }

  // Get session from cookie
  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please login first',
    });
  }

  // Create Salesforce client
  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    // Get object describe metadata
    const describe = await sfClient.describeObject(object);

    let fields = [];

    if (layoutType === 'Layout') {
      // Get layout metadata using Tooling API
      const layoutMetadata = await sfClient.getLayoutMetadata(object, layoutId);

      // Parse layout and extract ONLY fields that are on the layout
      fields = parseLayoutMetadata(layoutMetadata, describe);

    } else if (layoutType === 'FlexiPage') {
      // Get FlexiPage metadata using Tooling API
      const flexiPageMetadata = await sfClient.getFlexiPageMetadata(layoutId);

      // Parse FlexiPage and extract fields
      fields = parseFlexiPageMetadata(flexiPageMetadata, describe);

    } else {
      return res.status(400).json({
        error: 'Invalid layout type',
        message: 'layoutType must be either "Layout" or "FlexiPage"',
      });
    }

    // Generate output based on format
    let output = '';
    let contentType = 'text/plain';
    let extension = 'txt';

    if (format === 'json') {
      output = JSON.stringify(fields, null, 2);
      contentType = 'application/json';
      extension = 'json';
    } else if (format === 'xml') {
      output = generateXml(fields);
      contentType = 'application/xml';
      extension = 'xml';
    } else {
      // CSV format
      if (orientation === 'horizontal') {
        output = generateTransposedCsv(fields);
      } else {
        output = generateVerticalCsv(fields);
      }
      contentType = 'text/csv';
      extension = 'csv';
    }

    // Set headers for file download
    const filename = `${object}_${layoutType}_layout.${extension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(output);

  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({
      error: 'Export failed',
      message: error.message,
    });
  }
}

export default compose(requireAuth, withErrorHandling)(handler);
