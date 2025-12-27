import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/flows?search=myflow
 * List all flows with optional search
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

  try {
    // Query FlowDefinition for all flows
    let query = `
      SELECT Id, DeveloperName, MasterLabel, Description, ActiveVersionId, LatestVersionId,
             ActiveVersion.VersionNumber, LatestVersion.VersionNumber, ActiveVersion.Status
      FROM FlowDefinition
    `;

    if (search && search.trim()) {
      const searchTerm = search.trim().replace(/'/g, "\\'");
      query += ` WHERE MasterLabel LIKE '%${searchTerm}%' OR DeveloperName LIKE '%${searchTerm}%'`;
    }

    query += ` ORDER BY MasterLabel LIMIT 200`;

    const url = `${session.instanceUrl}/services/data/v59.0/tooling/query?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.sid}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch flows: ${errorText}`);
    }

    const data = await response.json();

    const flows = data.records?.map(f => ({
      id: f.Id,
      definitionId: f.Id,
      developerName: f.DeveloperName,
      label: f.MasterLabel,
      description: f.Description || '',
      activeVersionId: f.ActiveVersionId,
      latestVersionId: f.LatestVersionId,
      activeVersionNumber: f.ActiveVersion?.VersionNumber || null,
      latestVersionNumber: f.LatestVersion?.VersionNumber || null,
      status: f.ActiveVersion?.Status || 'Draft',
      isActive: !!f.ActiveVersionId,
    })) || [];

    return res.status(200).json(flows);

  } catch (error) {
    console.error('Flow list error:', error);
    return res.status(500).json({
      error: 'Failed to list flows',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
