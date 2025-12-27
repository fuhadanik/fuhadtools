import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/objects
 * Returns list of all Salesforce objects
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  // Get objects
  const objects = await sfClient.getObjects();

  return res.status(200).json(objects);
}

export default withErrorHandling(handler);
