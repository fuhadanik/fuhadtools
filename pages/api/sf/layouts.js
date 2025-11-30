import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { requireAuth, withErrorHandling, compose } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/layouts?object=Account
 * Returns layouts (Page Layouts and FlexiPages) for a specific object
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { object } = req.query;

  if (!object) {
    return res.status(400).json({
      error: 'Missing parameter',
      message: 'object parameter is required',
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

  // Get layouts
  const layouts = await sfClient.getLayouts(object);

  return res.status(200).json(layouts);
}

export default compose(requireAuth, withErrorHandling)(handler);
