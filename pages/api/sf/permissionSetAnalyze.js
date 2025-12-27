import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/permissionSetAnalyze?id=0PSXXX
 * Analyze a permission set and return all its permissions
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Permission Set ID is required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    // Fetch basic permission set details
    const psQuery = `
      SELECT Id, Name, Label, Description, IsOwnedByProfile, ProfileId, Profile.Name,
             LicenseId, License.Name, Type
      FROM PermissionSet
      WHERE Id = '${id}'
    `;

    const psResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(psQuery)}`);

    if (!psResult.records || psResult.records.length === 0) {
      return res.status(404).json({ error: 'Permission Set not found' });
    }

    const ps = psResult.records[0];

    // Try to get system permissions using the most basic/common fields
    let systemPermissions = [];
    try {
      // Query only the most universally available permissions
      const commonPermsQuery = `
        SELECT Id,
               PermissionsApiEnabled, PermissionsModifyAllData, PermissionsViewAllData
        FROM PermissionSet
        WHERE Id = '${id}'
      `;
      const permsResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(commonPermsQuery)}`);

      if (permsResult.records && permsResult.records.length > 0) {
        const perms = permsResult.records[0];
        Object.keys(perms).forEach(key => {
          if (key.startsWith('Permissions') && perms[key] === true) {
            const permName = key.replace('Permissions', '').replace(/([A-Z])/g, ' $1').trim();
            systemPermissions.push({
              apiName: key,
              label: permName,
              enabled: true,
            });
          }
        });
      }
    } catch (e) {
      console.log('Could not fetch system permissions:', e.message);
      // System permissions will remain empty, which is fine
    }

    // Fetch Object Permissions
    const objPermQuery = `
      SELECT SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit,
             PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
      FROM ObjectPermissions
      WHERE ParentId = '${id}'
      ORDER BY SobjectType
    `;
    const objPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(objPermQuery)}`);

    const objectPermissions = objPermResult.records?.map(perm => ({
      object: perm.SobjectType,
      read: perm.PermissionsRead,
      create: perm.PermissionsCreate,
      edit: perm.PermissionsEdit,
      delete: perm.PermissionsDelete,
      viewAll: perm.PermissionsViewAllRecords,
      modifyAll: perm.PermissionsModifyAllRecords,
    })) || [];

    // Group objects by access level
    const objectsByAccess = {
      fullAccess: objectPermissions.filter(o => o.read && o.create && o.edit && o.delete && o.viewAll && o.modifyAll),
      readWriteDelete: objectPermissions.filter(o => o.read && o.create && o.edit && o.delete && !(o.viewAll && o.modifyAll)),
      readWrite: objectPermissions.filter(o => o.read && (o.create || o.edit) && !o.delete),
      readOnly: objectPermissions.filter(o => o.read && !o.create && !o.edit && !o.delete),
      noAccess: objectPermissions.filter(o => !o.read),
    };

    // Fetch Field Permissions
    const fieldPermQuery = `
      SELECT SobjectType, Field, PermissionsRead, PermissionsEdit
      FROM FieldPermissions
      WHERE ParentId = '${id}'
      ORDER BY SobjectType, Field
    `;
    const fieldPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(fieldPermQuery)}`);

    const fieldPermissions = fieldPermResult.records?.map(perm => {
      const fieldParts = perm.Field.split('.');
      const actualFieldName = fieldParts.length > 1 ? fieldParts.slice(1).join('.') : perm.Field;
      return {
        object: perm.SobjectType,
        field: actualFieldName,
        read: perm.PermissionsRead,
        edit: perm.PermissionsEdit,
      };
    }) || [];

    // Group field permissions by object
    const fieldsByObject = {};
    fieldPermissions.forEach(fp => {
      if (!fieldsByObject[fp.object]) {
        fieldsByObject[fp.object] = [];
      }
      fieldsByObject[fp.object].push(fp);
    });

    // Try to get Tab Settings (may fail if not accessible)
    let tabSettings = [];
    try {
      const tabQuery = `
        SELECT Name, Visibility
        FROM PermissionSetTabSetting
        WHERE ParentId = '${id}'
        ORDER BY Name
      `;
      const tabResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(tabQuery)}`);
      tabSettings = tabResult.records?.map(t => ({
        name: t.Name,
        visibility: t.Visibility,
      })) || [];
    } catch (e) {
      console.log('Could not fetch tab settings:', e.message);
    }

    // Try to get Apex Class Access
    let apexClassAccess = [];
    try {
      const apexQuery = `
        SELECT SetupEntityId, SetupEntityType
        FROM SetupEntityAccess
        WHERE ParentId = '${id}' AND SetupEntityType = 'ApexClass'
      `;
      const apexResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(apexQuery)}`);

      if (apexResult.records && apexResult.records.length > 0) {
        const classIds = apexResult.records.map(r => r.SetupEntityId);
        const classQuery = `SELECT Id, Name FROM ApexClass WHERE Id IN ('${classIds.join("','")}')`;
        const classResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(classQuery)}`);
        apexClassAccess = classResult.records?.map(c => c.Name) || [];
      }
    } catch (e) {
      console.log('Could not fetch Apex class access:', e.message);
    }

    // Try to get Visualforce Page Access
    let vfPageAccess = [];
    try {
      const vfQuery = `
        SELECT SetupEntityId, SetupEntityType
        FROM SetupEntityAccess
        WHERE ParentId = '${id}' AND SetupEntityType = 'ApexPage'
      `;
      const vfResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(vfQuery)}`);

      if (vfResult.records && vfResult.records.length > 0) {
        const pageIds = vfResult.records.map(r => r.SetupEntityId);
        const pageQuery = `SELECT Id, Name FROM ApexPage WHERE Id IN ('${pageIds.join("','")}')`;
        const pageResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(pageQuery)}`);
        vfPageAccess = pageResult.records?.map(p => p.Name) || [];
      }
    } catch (e) {
      console.log('Could not fetch VF page access:', e.message);
    }

    // Build the analysis result
    const analysis = {
      permissionSet: {
        id: ps.Id,
        name: ps.Name,
        label: ps.Label,
        description: ps.Description || '',
        isOwnedByProfile: ps.IsOwnedByProfile,
        profileId: ps.ProfileId,
        profileName: ps.Profile?.Name || null,
        license: ps.License?.Name || 'No License Required',
        type: ps.Type || 'Regular',
      },
      systemPermissions: systemPermissions,
      objectPermissions: {
        all: objectPermissions,
        byAccess: objectsByAccess,
        count: objectPermissions.length,
      },
      fieldPermissions: {
        all: fieldPermissions,
        byObject: fieldsByObject,
        count: fieldPermissions.length,
        objectCount: Object.keys(fieldsByObject).length,
      },
      tabSettings: tabSettings,
      apexClassAccess: apexClassAccess,
      visualforcePageAccess: vfPageAccess,
      summary: {
        systemPermissionsCount: systemPermissions.length,
        objectPermissionsCount: objectPermissions.length,
        fieldPermissionsCount: fieldPermissions.length,
        tabSettingsCount: tabSettings.length,
        apexClassCount: apexClassAccess.length,
        vfPageCount: vfPageAccess.length,
      },
    };

    return res.status(200).json(analysis);

  } catch (error) {
    console.error('Permission set analyze error:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
