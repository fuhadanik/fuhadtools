import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/users?search=john
 * Search for users by name, username, or email
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
    let query;
    if (search && search.trim()) {
      const searchTerm = search.trim().replace(/'/g, "\\'");
      query = `
        SELECT Id, Username, Name, Email, ProfileId, Profile.Name, UserRoleId, UserRole.Name, IsActive
        FROM User
        WHERE (Name LIKE '%${searchTerm}%' OR Username LIKE '%${searchTerm}%' OR Email LIKE '%${searchTerm}%')
        AND IsActive = true
        ORDER BY Name
        LIMIT 50
      `;
    } else {
      query = `
        SELECT Id, Username, Name, Email, ProfileId, Profile.Name, UserRoleId, UserRole.Name, IsActive
        FROM User
        WHERE IsActive = true
        ORDER BY Name
        LIMIT 50
      `;
    }

    const result = await sfClient.makeRequest(`/query?q=${encodeURIComponent(query)}`);

    const users = result.records?.map(u => ({
      id: u.Id,
      name: u.Name,
      username: u.Username,
      email: u.Email,
      profile: u.Profile?.Name || 'Unknown',
      profileId: u.ProfileId,
      role: u.UserRole?.Name || 'No Role',
      roleId: u.UserRoleId,
      isActive: u.IsActive,
    })) || [];

    return res.status(200).json(users);

  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
