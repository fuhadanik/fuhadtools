import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/profiles?search=admin
 * List all profiles with optional search
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search } = req.query;

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    let query = `
      SELECT Id, Name, UserType, UserLicenseId, UserLicense.Name, Description
      FROM Profile
    `;

    if (search && search.trim()) {
      const searchTerm = search.trim().replace(/'/g, "\\'");
      query += ` WHERE Name LIKE '%${searchTerm}%'`;
    }

    query += ` ORDER BY Name LIMIT 100`;

    const result = await sfClient.makeRequest(`/query?q=${encodeURIComponent(query)}`);

    const profiles = result.records?.map(p => ({
      id: p.Id,
      name: p.Name,
      userType: p.UserType,
      license: p.UserLicense?.Name || 'Unknown',
      description: p.Description || '',
    })) || [];

    return res.status(200).json(profiles);

  } catch (error) {
    console.error('Profile list error:', error);
    return res.status(500).json({
      error: 'Failed to list profiles',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
