import { SalesforceClient } from '@/lib/salesforce';
import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';
import { parseLayoutMetadata, parseFlexiPageMetadata } from '@/lib/csvGenerator';

// Force recompile v3 - uiBehavior fix

/**
 * GET /api/sf/preview?object=Account&layoutId=00hxxxx&layoutType=Layout&recordTypeId=012xxx
 * Returns layout fields as JSON for preview
 * recordTypeId is optional - if provided, fetches RT-specific picklist values
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { object, layoutId, layoutType, recordTypeId } = req.query;

  if (!object || !layoutId || !layoutType) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'object, layoutId, and layoutType are required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please login first',
    });
  }

  const sfClient = new SalesforceClient(session.instanceUrl, session.sid);

  try {
    const describe = await sfClient.describeObject(object);

    // Fetch RT-specific picklist values if recordTypeId is provided
    let rtPicklists = null;
    if (recordTypeId) {
      rtPicklists = await sfClient.getPicklistValuesForRecordType(object, recordTypeId);
    }

    let rawFields = [];
    let rawMetadata = null;

    if (layoutType === 'Layout') {
      const layoutMetadata = await sfClient.getLayoutMetadata(object, layoutId);
      rawFields = parseLayoutMetadata(layoutMetadata, describe, rtPicklists);
    } else if (layoutType === 'FlexiPage') {
      const flexiPageMetadata = await sfClient.getFlexiPageMetadata(layoutId);
      rawMetadata = flexiPageMetadata;
      rawFields = parseFlexiPageMetadata(flexiPageMetadata, describe, rtPicklists);
    } else {
      return res.status(400).json({
        error: 'Invalid layout type',
        message: 'layoutType must be either "Layout" or "FlexiPage"',
      });
    }

    // Transform fields to use display column names
    const fields = rawFields.map(field => ({
      'Section': field.section || '-',
      'Field Label': field.label || '-',
      'API Name': field.apiName || '-',
      'Type': field.type || '-',
      'Length': field.length || '-',
      'Required': field.required ? 'Yes' : 'No',
      'Layout Required': field.layoutRequired ? 'Yes' : 'No',
      'Field Required': field.fieldRequired ? 'Yes' : 'No',
      'Read Only': field.readOnly ? 'Yes' : 'No',
      'Picklist Values': field.picklistValues || '-',
      'Reference To': field.referenceTo || '-',
      'Help Text': field.helpText || '-',
    }));

    // Define columns - show Layout Required prominently
    const columns = [
      'Section',
      'Field Label',
      'API Name',
      'Type',
      'Length',
      'Required',
      'Layout Required',
      'Field Required',
      'Read Only',
      'Picklist Values',
      'Reference To',
      'Help Text',
    ];

    // Debug: return raw metadata for FlexiPages
    const debugInfo = layoutType === 'FlexiPage' ? {
      rawMetadataKeys: Object.keys(rawMetadata || {}),
      rawMetadataSample: JSON.stringify(rawMetadata || {}).substring(0, 5000),
      rawFieldsSample: rawFields.slice(0, 3).map(f => ({
        apiName: f.apiName,
        required: f.required,
        layoutRequired: f.layoutRequired,
        fieldRequired: f.fieldRequired,
      })),
    } : null;

    return res.status(200).json({
      columns,
      fields,
      totalCount: fields.length,
      debug: debugInfo,
    });

  } catch (error) {
    console.error('Preview error:', error);
    return res.status(500).json({
      error: 'Preview failed',
      message: error.message,
    });
  }
}

export default withErrorHandling(handler);
