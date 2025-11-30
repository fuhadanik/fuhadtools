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
    // Get object describe metadata
    const describe = await sfClient.describeObject(object);

    let fields = [];

    if (layoutType === 'Layout') {
      // Get layout metadata
      const layoutMetadata = await sfClient.getLayoutMetadata(object, layoutId);

      // Parse layout and extract fields
      fields = parseLayoutMetadata(layoutMetadata, describe);

    } else if (layoutType === 'FlexiPage') {
      // Get FlexiPage metadata
      const flexiPageMetadata = await sfClient.getFlexiPageMetadata(layoutId);

      // Parse FlexiPage and extract fields
      fields = parseFlexiPageMetadata(flexiPageMetadata, describe);

    } else {
      return res.status(400).json({
        error: 'Invalid layout type',
        message: 'layoutType must be either "Layout" or "FlexiPage"',
      });
    }

    // Generate CSV
    const csv = generateTransposedCsv(fields);

    // Set headers for file download
    const filename = `${object}_${layoutType}_layout.csv`;
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
