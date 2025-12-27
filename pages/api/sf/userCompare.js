import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/userCompare?user1=005xxx&user2=005xxx&includeDetails=true
 * Compare two users to find differences in access including object and field permissions
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user1, user2, includeDetails = 'true' } = req.query;

  if (!user1 || !user2) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'user1 and user2 IDs are required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    // Fetch user details
    const userQuery = `
      SELECT Id, Username, Name, Email, ProfileId, Profile.Name, UserRoleId, UserRole.Name, IsActive
      FROM User
      WHERE Id IN ('${user1}', '${user2}')
    `;
    const usersResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(userQuery)}`);

    if (!usersResult.records || usersResult.records.length !== 2) {
      return res.status(400).json({ error: 'Could not find both users' });
    }

    const userData1 = usersResult.records.find(u => u.Id === user1);
    const userData2 = usersResult.records.find(u => u.Id === user2);

    // Fetch ALL Permission Set Assignments for both users (including profile-owned ones)
    const psaQuery = `
      SELECT AssigneeId, PermissionSetId, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, PermissionSet.ProfileId
      FROM PermissionSetAssignment
      WHERE AssigneeId IN ('${user1}', '${user2}')
    `;
    const psaResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(psaQuery)}`);

    // Separate profile-owned and regular permission sets
    const allPs1 = psaResult.records?.filter(p => p.AssigneeId === user1) || [];
    const allPs2 = psaResult.records?.filter(p => p.AssigneeId === user2) || [];

    const ps1 = allPs1.filter(p => !p.PermissionSet.IsOwnedByProfile).map(p => ({
      id: p.PermissionSetId,
      name: p.PermissionSet.Name,
      label: p.PermissionSet.Label,
    }));

    const ps2 = allPs2.filter(p => !p.PermissionSet.IsOwnedByProfile).map(p => ({
      id: p.PermissionSetId,
      name: p.PermissionSet.Name,
      label: p.PermissionSet.Label,
    }));

    // Get all permission set IDs for both users (including profile-owned)
    const allPsIds1 = allPs1.map(p => p.PermissionSetId);
    const allPsIds2 = allPs2.map(p => p.PermissionSetId);
    const allPsIds = [...new Set([...allPsIds1, ...allPsIds2])];

    // Fetch Public Group Memberships
    const groupQuery = `
      SELECT GroupId, Group.Name, Group.Type, UserOrGroupId
      FROM GroupMember
      WHERE UserOrGroupId IN ('${user1}', '${user2}')
    `;
    const groupResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(groupQuery)}`);

    const groups1 = groupResult.records?.filter(g => g.UserOrGroupId === user1).map(g => ({
      id: g.GroupId,
      name: g.Group.Name,
      type: g.Group.Type,
    })) || [];

    const groups2 = groupResult.records?.filter(g => g.UserOrGroupId === user2).map(g => ({
      id: g.GroupId,
      name: g.Group.Name,
      type: g.Group.Type,
    })) || [];

    // Fetch Queue Memberships
    const queueQuery = `
      SELECT GroupId, Group.Name, UserOrGroupId
      FROM GroupMember
      WHERE UserOrGroupId IN ('${user1}', '${user2}')
      AND Group.Type = 'Queue'
    `;
    const queueResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(queueQuery)}`);

    const queues1 = queueResult.records?.filter(q => q.UserOrGroupId === user1).map(q => ({
      id: q.GroupId,
      name: q.Group.Name,
    })) || [];

    const queues2 = queueResult.records?.filter(q => q.UserOrGroupId === user2).map(q => ({
      id: q.GroupId,
      name: q.Group.Name,
    })) || [];

    // Initialize object and field permissions
    let objectPermissions = { user1: {}, user2: {}, differences: [] };
    let fieldPermissions = { user1: {}, user2: {}, differences: [] };

    // Fetch Object and Field permissions if details are requested
    if (includeDetails === 'true' && allPsIds.length > 0) {
      // Check if users have System Administrator profile (implicit full access to all objects/fields)
      const isSystemAdmin1 = userData1.Profile?.Name === 'System Administrator';
      const isSystemAdmin2 = userData2.Profile?.Name === 'System Administrator';

      // Fetch Object Permissions from Permission Sets
      const objPermQuery = `
        SELECT ParentId, SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit,
               PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
        FROM ObjectPermissions
        WHERE ParentId IN ('${allPsIds.join("','")}')
      `;
      const objPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(objPermQuery)}`);

      // Aggregate object permissions per user
      const user1ObjPerms = {};
      const user2ObjPerms = {};

      objPermResult.records?.forEach(perm => {
        const objName = perm.SobjectType;
        const isUser1 = allPsIds1.includes(perm.ParentId);
        const isUser2 = allPsIds2.includes(perm.ParentId);

        const permData = {
          read: perm.PermissionsRead,
          create: perm.PermissionsCreate,
          edit: perm.PermissionsEdit,
          delete: perm.PermissionsDelete,
          viewAll: perm.PermissionsViewAllRecords,
          modifyAll: perm.PermissionsModifyAllRecords,
        };

        if (isUser1) {
          if (!user1ObjPerms[objName]) {
            user1ObjPerms[objName] = { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };
          }
          // Aggregate (OR) permissions
          Object.keys(permData).forEach(key => {
            user1ObjPerms[objName][key] = user1ObjPerms[objName][key] || permData[key];
          });
        }

        if (isUser2) {
          if (!user2ObjPerms[objName]) {
            user2ObjPerms[objName] = { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };
          }
          Object.keys(permData).forEach(key => {
            user2ObjPerms[objName][key] = user2ObjPerms[objName][key] || permData[key];
          });
        }
      });

      // Find object permission differences
      // For System Administrator, assume full access for objects they don't have explicit records for
      const allObjects = [...new Set([...Object.keys(user1ObjPerms), ...Object.keys(user2ObjPerms)])];
      const objDifferences = [];

      allObjects.forEach(objName => {
        // Get explicit permissions or default
        let perm1 = user1ObjPerms[objName] || { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };
        let perm2 = user2ObjPerms[objName] || { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };

        // For System Administrator, default to full access if no explicit record exists
        if (isSystemAdmin1 && !user1ObjPerms[objName]) {
          perm1 = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
        }
        if (isSystemAdmin2 && !user2ObjPerms[objName]) {
          perm2 = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
        }

        const diff = {};
        let hasDiff = false;
        ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'].forEach(key => {
          if (perm1[key] !== perm2[key]) {
            diff[key] = { user1: perm1[key], user2: perm2[key] };
            hasDiff = true;
          }
        });

        if (hasDiff) {
          objDifferences.push({
            object: objName,
            user1Permissions: perm1,
            user2Permissions: perm2,
            differences: diff,
          });
        }
      });

      objectPermissions = {
        user1: user1ObjPerms,
        user2: user2ObjPerms,
        differences: objDifferences,
      };

      // Fetch Field Permissions from Permission Sets
      const fieldPermQuery = `
        SELECT ParentId, SobjectType, Field, PermissionsRead, PermissionsEdit
        FROM FieldPermissions
        WHERE ParentId IN ('${allPsIds.join("','")}')
      `;
      const fieldPermResult = await sfClient.makeRequest(`/query?q=${encodeURIComponent(fieldPermQuery)}`);

      // Aggregate field permissions per user from Permission Sets
      const user1FieldPerms = {};
      const user2FieldPerms = {};

      fieldPermResult.records?.forEach(perm => {
        const fieldParts = perm.Field.split('.');
        const actualFieldName = fieldParts.length > 1 ? fieldParts.slice(1).join('.') : perm.Field;
        const objectName = perm.SobjectType;
        const fieldKey = `${objectName}.${actualFieldName}`;

        const isUser1 = allPsIds1.includes(perm.ParentId);
        const isUser2 = allPsIds2.includes(perm.ParentId);

        const permData = {
          read: perm.PermissionsRead,
          edit: perm.PermissionsEdit,
        };

        if (isUser1) {
          if (!user1FieldPerms[fieldKey]) {
            user1FieldPerms[fieldKey] = { read: false, edit: false, object: objectName, field: actualFieldName };
          }
          user1FieldPerms[fieldKey].read = user1FieldPerms[fieldKey].read || permData.read;
          user1FieldPerms[fieldKey].edit = user1FieldPerms[fieldKey].edit || permData.edit;
        }

        if (isUser2) {
          if (!user2FieldPerms[fieldKey]) {
            user2FieldPerms[fieldKey] = { read: false, edit: false, object: objectName, field: actualFieldName };
          }
          user2FieldPerms[fieldKey].read = user2FieldPerms[fieldKey].read || permData.read;
          user2FieldPerms[fieldKey].edit = user2FieldPerms[fieldKey].edit || permData.edit;
        }
      });

      // Find field permission differences
      // For System Administrator, assume full access for any field encountered
      const allFields = [...new Set([...Object.keys(user1FieldPerms), ...Object.keys(user2FieldPerms)])];
      const fieldDifferences = [];

      allFields.forEach(fieldKey => {
        const parts = fieldKey.split('.');
        const objectName = parts[0];
        const fieldName = parts.slice(1).join('.');

        // Get explicit permissions or default to false
        let perm1 = user1FieldPerms[fieldKey] || { read: false, edit: false, object: objectName, field: fieldName };
        let perm2 = user2FieldPerms[fieldKey] || { read: false, edit: false, object: objectName, field: fieldName };

        // For System Administrator profile, default to full access for fields they don't have explicit records for
        // System Admin has implicit access to all standard and custom fields
        if (isSystemAdmin1 && !user1FieldPerms[fieldKey]) {
          perm1 = { read: true, edit: true, object: objectName, field: fieldName };
        }
        if (isSystemAdmin2 && !user2FieldPerms[fieldKey]) {
          perm2 = { read: true, edit: true, object: objectName, field: fieldName };
        }

        if (perm1.read !== perm2.read || perm1.edit !== perm2.edit) {
          fieldDifferences.push({
            object: objectName,
            field: fieldName,
            user1: { read: perm1.read, edit: perm1.edit },
            user2: { read: perm2.read, edit: perm2.edit },
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

      fieldPermissions = {
        user1: user1FieldPerms,
        user2: user2FieldPerms,
        differences: fieldDifferences,
        differencesByObject: fieldDiffByObject,
      };
    }

    // Compare and find differences
    const ps1Ids = new Set(ps1.map(p => p.id));
    const ps2Ids = new Set(ps2.map(p => p.id));
    const group1Ids = new Set(groups1.map(g => g.id));
    const group2Ids = new Set(groups2.map(g => g.id));
    const queue1Ids = new Set(queues1.map(q => q.id));
    const queue2Ids = new Set(queues2.map(q => q.id));

    const comparison = {
      user1: {
        id: userData1.Id,
        name: userData1.Name,
        username: userData1.Username,
        email: userData1.Email,
        profile: userData1.Profile?.Name || 'Unknown',
        profileId: userData1.ProfileId,
        role: userData1.UserRole?.Name || 'No Role',
        roleId: userData1.UserRoleId,
        isActive: userData1.IsActive,
        permissionSets: ps1,
        groups: groups1.filter(g => g.type !== 'Queue'),
        queues: queues1,
      },
      user2: {
        id: userData2.Id,
        name: userData2.Name,
        username: userData2.Username,
        email: userData2.Email,
        profile: userData2.Profile?.Name || 'Unknown',
        profileId: userData2.ProfileId,
        role: userData2.UserRole?.Name || 'No Role',
        roleId: userData2.UserRoleId,
        isActive: userData2.IsActive,
        permissionSets: ps2,
        groups: groups2.filter(g => g.type !== 'Queue'),
        queues: queues2,
      },
      differences: {
        profile: userData1.ProfileId !== userData2.ProfileId,
        role: userData1.UserRoleId !== userData2.UserRoleId,
        permissionSets: {
          onlyUser1: ps1.filter(p => !ps2Ids.has(p.id)),
          onlyUser2: ps2.filter(p => !ps1Ids.has(p.id)),
          common: ps1.filter(p => ps2Ids.has(p.id)),
        },
        groups: {
          onlyUser1: groups1.filter(g => !group2Ids.has(g.id) && g.type !== 'Queue'),
          onlyUser2: groups2.filter(g => !group1Ids.has(g.id) && g.type !== 'Queue'),
          common: groups1.filter(g => group2Ids.has(g.id) && g.type !== 'Queue'),
        },
        queues: {
          onlyUser1: queues1.filter(q => !queue2Ids.has(q.id)),
          onlyUser2: queues2.filter(q => !queue1Ids.has(q.id)),
          common: queues1.filter(q => queue2Ids.has(q.id)),
        },
        objectPermissions: objectPermissions.differences,
        fieldPermissions: fieldPermissions.differences,
        fieldPermissionsByObject: fieldPermissions.differencesByObject || {},
      },
      summary: {
        hasDifferences: false,
        totalDifferences: 0,
        details: [],
      },
    };

    // Build summary
    if (comparison.differences.profile) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences++;
      comparison.summary.details.push(`Different Profiles: ${comparison.user1.profile} vs ${comparison.user2.profile}`);
    }

    if (comparison.differences.role) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences++;
      comparison.summary.details.push(`Different Roles: ${comparison.user1.role} vs ${comparison.user2.role}`);
    }

    const psDiff = comparison.differences.permissionSets.onlyUser1.length +
                   comparison.differences.permissionSets.onlyUser2.length;
    if (psDiff > 0) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences += psDiff;
      comparison.summary.details.push(`${psDiff} Permission Set difference(s)`);
    }

    const groupDiff = comparison.differences.groups.onlyUser1.length +
                      comparison.differences.groups.onlyUser2.length;
    if (groupDiff > 0) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences += groupDiff;
      comparison.summary.details.push(`${groupDiff} Public Group difference(s)`);
    }

    const queueDiff = comparison.differences.queues.onlyUser1.length +
                      comparison.differences.queues.onlyUser2.length;
    if (queueDiff > 0) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences += queueDiff;
      comparison.summary.details.push(`${queueDiff} Queue difference(s)`);
    }

    const objDiff = comparison.differences.objectPermissions?.length || 0;
    if (objDiff > 0) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences += objDiff;
      comparison.summary.details.push(`${objDiff} Object permission difference(s)`);
    }

    const fieldDiff = comparison.differences.fieldPermissions?.length || 0;
    if (fieldDiff > 0) {
      comparison.summary.hasDifferences = true;
      comparison.summary.totalDifferences += fieldDiff;
      comparison.summary.details.push(`${fieldDiff} Field permission difference(s)`);
    }

    return res.status(200).json(comparison);

  } catch (error) {
    console.error('User compare error:', error);
    return res.status(500).json({
      error: 'Comparison failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
