import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { requireAuth, withErrorHandling, compose } from '@/lib/apiMiddleware';
import {
  parseLayoutMetadata,
  parseFlexiPageMetadata,
  generateTransposedCsv,
} from '@/lib/csvGenerator';

/**
 * GET /api/sf/export?object=Account&layoutId=00hxxxx&layoutType=Layout
 * Exports layout metadata as transposed CSV
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { object, layoutId, layoutType } = req.query;

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
    // Get object describe metadata (contains all fields)
    const describe = await sfClient.describeObject(object);

    // Extract all fields with their metadata
    const fields = describe.fields.map(field => ({
      section: 'All Fields',
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
    }));

    // Generate CSV
    const csv = generateTransposedCsv(fields);

    // Set headers for file download
    const filename = `${object}_fields.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(csv);

  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({
      error: 'Export failed',
      message: error.message,
    });
  }
}

export default compose(requireAuth, withErrorHandling)(handler);
