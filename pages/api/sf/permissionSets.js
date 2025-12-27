import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/permissionSets?search=admin&includeProfiles=false
 * List all permission sets with optional search
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search, includeProfiles = 'false' } = req.query;

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    let query = `
      SELECT Id, Name, Label, Description, IsOwnedByProfile, ProfileId, Profile.Name,
             LicenseId, License.Name, PermissionSetGroupId, Type
      FROM PermissionSet
    `;

    const conditions = [];

    // Filter out profile-owned permission sets unless requested
    if (includeProfiles !== 'true') {
      conditions.push('IsOwnedByProfile = false');
    }

    if (search && search.trim()) {
      const searchTerm = search.trim().replace(/'/g, "\\'");
      conditions.push(`(Label LIKE '%${searchTerm}%' OR Name LIKE '%${searchTerm}%')`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY Label LIMIT 200`;

    const result = await sfClient.makeRequest(`/query?q=${encodeURIComponent(query)}`);

    const permissionSets = result.records?.map(ps => ({
      id: ps.Id,
      name: ps.Name,
      label: ps.Label,
      description: ps.Description || '',
      isOwnedByProfile: ps.IsOwnedByProfile,
      profileId: ps.ProfileId,
      profileName: ps.Profile?.Name || null,
      license: ps.License?.Name || 'No License Required',
      type: ps.Type || 'Regular',
      isGroup: ps.PermissionSetGroupId !== null,
    })) || [];

    return res.status(200).json(permissionSets);

  } catch (error) {
    console.error('Permission set list error:', error);
    return res.status(500).json({
      error: 'Failed to list permission sets',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
