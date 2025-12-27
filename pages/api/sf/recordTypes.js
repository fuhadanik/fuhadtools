import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/recordTypes?object=Account
 * Returns record types for a specific object with layout assignments
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

  try {
    // Get object describe which includes record types
    const describe = await sfClient.describeObject(object);

    // Get layout assignments from describe/layouts endpoint
    const layoutsData = await sfClient.makeRequest(`/sobjects/${object}/describe/layouts`);

    // Build record type to layout mapping
    const recordTypeLayoutMap = {};
    if (layoutsData.recordTypeMappings) {
      layoutsData.recordTypeMappings.forEach(mapping => {
        recordTypeLayoutMap[mapping.recordTypeId] = {
          layoutId: mapping.layoutId,
          layoutName: mapping.name || mapping.recordTypeName || 'Default Layout',
        };
      });
    }

    // Get available record types with layout info
    let recordTypes = describe.recordTypeInfos
      .filter(rt => rt.available)
      .map(rt => ({
        id: rt.recordTypeId,
        name: rt.name,
        developerName: rt.developerName,
        isDefault: rt.defaultRecordTypeMapping,
        isMaster: rt.master || rt.name === 'Master',
        layoutId: recordTypeLayoutMap[rt.recordTypeId]?.layoutId || null,
        layoutName: recordTypeLayoutMap[rt.recordTypeId]?.layoutName || null,
        picklistValues: {}, // Will be populated via UI API
      }));

    // Fetch picklist values for each record type using UI API (in parallel)
    const picklistPromises = recordTypes.map(async (rt) => {
      try {
        const picklistValues = await sfClient.getPicklistValuesForRecordType(object, rt.id);
        rt.picklistValues = picklistValues;
      } catch (err) {
        console.warn(`Failed to fetch picklist values for RT ${rt.name}:`, err.message);
        rt.picklistValues = {};
      }
    });
    await Promise.all(picklistPromises);

    // Sort: default first, then alphabetically
    recordTypes.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      if (a.isMaster && !b.isMaster) return 1;
      if (!a.isMaster && b.isMaster) return -1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      recordTypes,
      hasMultipleRecordTypes: recordTypes.length > 1,
    });

  } catch (error) {
    console.error('Record types error:', error);
    return res.status(500).json({
      error: 'Failed to fetch record types',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
