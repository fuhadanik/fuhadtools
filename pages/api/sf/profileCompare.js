import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/profileCompare?profile1=00eXXX&profile2=00eXXX
 * Compare two profiles to find differences in permissions
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile1, profile2 } = req.query;

  if (!profile1 || !profile2) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'profile1 and profile2 IDs are required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    // Fetch profile details
    const profileQuery = `
      SELECT Id, Name, UserType, UserLicenseId, UserLicense.Name, Description
      FROM Profile
      WHERE Id IN ('${profile1}', '${profile2}')
    `;
    const profileResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(profileQuery)}`);

    if (!profileResult.records || profileResult.records.length !== 2) {
      return res.status(400).json({ error: 'Could not find both profiles' });
    }

    const profileData1 = profileResult.records.find(p => p.Id === profile1);
    const profileData2 = profileResult.records.find(p => p.Id === profile2);

    // Check if profiles are System Administrator (implicit full access)
    const isSystemAdmin1 = profileData1.Name === 'System Administrator';
    const isSystemAdmin2 = profileData2.Name === 'System Administrator';

    // Get the profile-owned permission sets
    const psQuery = `
      SELECT Id, ProfileId, Name, Label
      FROM PermissionSet
      WHERE IsOwnedByProfile = true AND ProfileId IN ('${profile1}', '${profile2}')
    `;
    const psResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(psQuery)}`);

    const ps1 = psResult.records?.find(p => p.ProfileId === profile1);
    const ps2 = psResult.records?.find(p => p.ProfileId === profile2);

    if (!ps1 || !ps2) {
      return res.status(400).json({ error: 'Could not find permission sets for profiles' });
    }

    const psId1 = ps1.Id;
    const psId2 = ps2.Id;

    // Fetch Object Permissions
    const objPermQuery = `
      SELECT ParentId, SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit,
             PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
      FROM ObjectPermissions
      WHERE ParentId IN ('${psId1}', '${psId2}')
    `;
    const objPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(objPermQuery)}`);

    // Aggregate object permissions per profile
    const profile1ObjPerms = {};
    const profile2ObjPerms = {};

    objPermResult.records?.forEach(perm => {
      const objName = perm.SobjectType;
      const permData = {
        read: perm.PermissionsRead,
        create: perm.PermissionsCreate,
        edit: perm.PermissionsEdit,
        delete: perm.PermissionsDelete,
        viewAll: perm.PermissionsViewAllRecords,
        modifyAll: perm.PermissionsModifyAllRecords,
      };

      if (perm.ParentId === psId1) {
        profile1ObjPerms[objName] = permData;
      }
      if (perm.ParentId === psId2) {
        profile2ObjPerms[objName] = permData;
      }
    });

    // Find object permission differences
    const allObjects = [...new Set([...Object.keys(profile1ObjPerms), ...Object.keys(profile2ObjPerms)])];
    const objDifferences = [];

    allObjects.forEach(objName => {
      let perm1 = profile1ObjPerms[objName] || { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };
      let perm2 = profile2ObjPerms[objName] || { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };

      // For System Administrator, default to full access if no explicit record
      if (isSystemAdmin1 && !profile1ObjPerms[objName]) {
        perm1 = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
      }
      if (isSystemAdmin2 && !profile2ObjPerms[objName]) {
        perm2 = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
      }

      const diff = {};
      let hasDiff = false;
      ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'].forEach(key => {
        if (perm1[key] !== perm2[key]) {
          diff[key] = { profile1: perm1[key], profile2: perm2[key] };
          hasDiff = true;
        }
      });

      if (hasDiff) {
        objDifferences.push({
          object: objName,
          profile1Permissions: perm1,
          profile2Permissions: perm2,
          differences: diff,
        });
      }
    });

    // Fetch Field Permissions
    const fieldPermQuery = `
      SELECT ParentId, SobjectType, Field, PermissionsRead, PermissionsEdit
      FROM FieldPermissions
      WHERE ParentId IN ('${psId1}', '${psId2}')
    `;
    const fieldPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(fieldPermQuery)}`);

    // Aggregate field permissions per profile
    const profile1FieldPerms = {};
    const profile2FieldPerms = {};

    fieldPermResult.records?.forEach(perm => {
      const fieldParts = perm.Field.split('.');
      const actualFieldName = fieldParts.length > 1 ? fieldParts.slice(1).join('.') : perm.Field;
      const objectName = perm.SobjectType;
      const fieldKey = `${objectName}.${actualFieldName}`;

      const permData = {
        read: perm.PermissionsRead,
        edit: perm.PermissionsEdit,
        object: objectName,
        field: actualFieldName,
      };

      if (perm.ParentId === psId1) {
        profile1FieldPerms[fieldKey] = permData;
      }
      if (perm.ParentId === psId2) {
        profile2FieldPerms[fieldKey] = permData;
      }
    });

    // Find field permission differences
    const allFields = [...new Set([...Object.keys(profile1FieldPerms), ...Object.keys(profile2FieldPerms)])];
    const fieldDifferences = [];

    allFields.forEach(fieldKey => {
      const parts = fieldKey.split('.');
      const objectName = parts[0];
      const fieldName = parts.slice(1).join('.');

      let perm1 = profile1FieldPerms[fieldKey] || { read: false, edit: false, object: objectName, field: fieldName };
      let perm2 = profile2FieldPerms[fieldKey] || { read: false, edit: false, object: objectName, field: fieldName };

      // For System Administrator, default to full access
      if (isSystemAdmin1 && !profile1FieldPerms[fieldKey]) {
        perm1 = { read: true, edit: true, object: objectName, field: fieldName };
      }
      if (isSystemAdmin2 && !profile2FieldPerms[fieldKey]) {
        perm2 = { read: true, edit: true, object: objectName, field: fieldName };
      }

      if (perm1.read !== perm2.read || perm1.edit !== perm2.edit) {
        fieldDifferences.push({
          object: objectName,
          field: fieldName,
          profile1: { read: perm1.read, edit: perm1.edit },
          profile2: { read: perm2.read, edit: perm2.edit },
        });
      }
    });

    // Group field differences by object
    const fieldDiffByObject = {};
    fieldDifferences.forEach(diff => {
      if (!fieldDiffByObject[diff.object]) {
        fieldDiffByObject[diff.object] = [];
      }
      fieldDiffByObject[diff.object].push(diff);
    });

    // Build comparison result
    const comparison = {
      profile1: {
        id: profileData1.Id,
        name: profileData1.Name,
        userType: profileData1.UserType,
        license: profileData1.UserLicense?.Name || 'Unknown',
        description: profileData1.Description || '',
        isSystemAdmin: isSystemAdmin1,
        permissionSetId: psId1,
      },
      profile2: {
        id: profileData2.Id,
        name: profileData2.Name,
        userType: profileData2.UserType,
        license: profileData2.UserLicense?.Name || 'Unknown',
        description: profileData2.Description || '',
        isSystemAdmin: isSystemAdmin2,
        permissionSetId: psId2,
      },
      differences: {
        objectPermissions: objDifferences,
        fieldPermissions: fieldDifferences,
        fieldPermissionsByObject: fieldDiffByObject,
      },
      summary: {
        objectPermissionDiffs: objDifferences.length,
        fieldPermissionDiffs: fieldDifferences.length,
        totalDifferences: objDifferences.length + fieldDifferences.length,
      },
    };

    return res.status(200).json(comparison);

  } catch (error) {
    console.error('Profile compare error:', error);
    return res.status(500).json({
      error: 'Comparison failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
