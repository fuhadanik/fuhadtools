import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { requireAuth, withErrorHandling, compose } from '@/lib/apiMiddleware';
import {
  parseLayoutMetadata,
  parseFlexiPageMetadata,
} from '@/lib/csvGenerator';

/**
 * GET /api/sf/export-metadata?object=Account&layoutId=00hxxxx&layoutType=Layout
 * Returns layout metadata and parsed fields without generating a file
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
    let layoutMetadata = null;

    if (layoutType === 'Layout') {
      // Get layout metadata using Tooling API
      layoutMetadata = await sfClient.getLayoutMetadata(object, layoutId);

      // Parse layout and extract fields
      fields = parseLayoutMetadata(layoutMetadata, describe);

    } else if (layoutType === 'FlexiPage') {
      // Get FlexiPage metadata using Tooling API
      const flexiPageMetadata = await sfClient.getFlexiPageMetadata(layoutId);
      layoutMetadata = flexiPageMetadata.Metadata;

      // Parse FlexiPage and extract fields
      fields = parseFlexiPageMetadata(layoutMetadata, describe);

    } else {
      return res.status(400).json({
        error: 'Invalid layout type',
        message: 'layoutType must be either "Layout" or "FlexiPage"',
      });
    }

    // Return metadata and fields as JSON
    return res.status(200).json({
      success: true,
      layoutMetadata: {
        ...layoutMetadata,
        type: layoutType,
      },
      fields: fields,
      objectName: object,
    });

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return res.status(500).json({
      error: 'Metadata fetch failed',
      message: error.message,
    });
  }
}

export default compose(requireAuth, withErrorHandling)(handler);
