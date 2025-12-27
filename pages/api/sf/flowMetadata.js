import { getSessionFromRequest } from '@/lib/session';
import { withErrorHandling } from '@/lib/apiMiddleware';

/**
 * GET /api/sf/flowMetadata?flowId=301xxx&format=xml|json
 * Get flow metadata in XML or JSON format
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { flowId, versionId, format = 'xml' } = req.query;

  if (!flowId && !versionId) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'flowId or versionId is required',
    });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.instanceUrl || !session.sid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    let flowVersionId = versionId;

    // If flowId is provided (definition ID), get the latest version ID
    if (flowId && !versionId) {
      const defQuery = `SELECT Id, LatestVersionId, ActiveVersionId FROM FlowDefinition WHERE Id = '${flowId}'`;
      const defUrl = `${session.instanceUrl}/services/data/v59.0/tooling/query?q=${encodeURIComponent(defQuery)}`;

      const defResponse = await fetch(defUrl, {
        headers: {
          'Authorization': `Bearer ${session.sid}`,
          'Content-Type': 'application/json',
        },
      });

      if (!defResponse.ok) {
        throw new Error('Failed to fetch flow definition');
      }

      const defData = await defResponse.json();
      if (!defData.records || defData.records.length === 0) {
        throw new Error('Flow definition not found');
      }

      // Prefer active version, fallback to latest
      flowVersionId = defData.records[0].ActiveVersionId || defData.records[0].LatestVersionId;
    }

    if (!flowVersionId) {
      throw new Error('No flow version found');
    }

    // Get flow version metadata
    const versionUrl = `${session.instanceUrl}/services/data/v59.0/tooling/sobjects/Flow/${flowVersionId}`;

    const versionResponse = await fetch(versionUrl, {
      headers: {
        'Authorization': `Bearer ${session.sid}`,
        'Content-Type': 'application/json',
      },
    });

    if (!versionResponse.ok) {
      const errorText = await versionResponse.text();
      throw new Error(`Failed to fetch flow version: ${errorText}`);
    }

    const flowData = await versionResponse.json();

    // Get full flow info
    const flowInfo = {
      id: flowData.Id,
      definitionId: flowData.DefinitionId,
      masterLabel: flowData.MasterLabel,
      description: flowData.Description,
      processType: flowData.ProcessType,
      status: flowData.Status,
      versionNumber: flowData.VersionNumber,
      apiVersion: flowData.ApiVersion,
    };

    if (format === 'json') {
      // Return JSON metadata
      const metadata = flowData.Metadata;
      return res.status(200).json({
        flowInfo,
        metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
      });
    } else {
      // Get XML format using Metadata API retrieve
      // First, let's try to get it via composite request or build from metadata
      const metadata = flowData.Metadata;

      // Convert to XML format
      const xml = convertFlowToXML(flowInfo, typeof metadata === 'string' ? JSON.parse(metadata) : metadata);

      if (req.query.download === 'true') {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${flowInfo.masterLabel || 'flow'}.flow-meta.xml"`);
        return res.send(xml);
      }

      return res.status(200).json({
        flowInfo,
        xml: xml,
      });
    }

  } catch (error) {
    console.error('Flow metadata error:', error);
    return res.status(500).json({
      error: 'Failed to get flow metadata',
      message: error.message,
    });
  }
}

/**
 * Convert flow metadata to Salesforce XML format
 */
function convertFlowToXML(flowInfo, metadata) {
  const escapeXml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const buildXmlElement = (name, value, indent = '') => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
      const children = Object.entries(value)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => buildXmlElement(k, v, indent + '    '))
        .filter(x => x)
        .join('\n');
      if (!children) return '';
      return `${indent}<${name}>\n${children}\n${indent}</${name}>`;
    }
    if (Array.isArray(value)) {
      return value
        .map(item => buildXmlElement(name, item, indent))
        .filter(x => x)
        .join('\n');
    }
    return `${indent}<${name}>${escapeXml(value)}</${name}>`;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<Flow xmlns="http://soap.sforce.com/2006/04/metadata">\n`;

  // Add API version
  if (flowInfo.apiVersion) {
    xml += `    <apiVersion>${flowInfo.apiVersion}</apiVersion>\n`;
  }

  // Add description
  if (flowInfo.description) {
    xml += `    <description>${escapeXml(flowInfo.description)}</description>\n`;
  }

  // Add label
  if (flowInfo.masterLabel) {
    xml += `    <label>${escapeXml(flowInfo.masterLabel)}</label>\n`;
  }

  // Add process type
  if (flowInfo.processType) {
    xml += `    <processType>${flowInfo.processType}</processType>\n`;
  }

  // Add status
  if (flowInfo.status) {
    xml += `    <status>${flowInfo.status}</status>\n`;
  }

  // Add all metadata elements
  if (metadata) {
    const metadataOrder = [
      'actionCalls', 'apexPluginCalls', 'assignments', 'choices', 'collectionProcessors',
      'constants', 'decisions', 'dynamicChoiceSets', 'formulas', 'interviewLabel',
      'loops', 'orchestratedStages', 'processMetadataValues', 'recordCreates',
      'recordDeletes', 'recordLookups', 'recordUpdates', 'screens', 'stages',
      'start', 'steps', 'subflows', 'textTemplates', 'variables', 'waits'
    ];

    // First add ordered elements
    for (const key of metadataOrder) {
      if (metadata[key]) {
        const element = buildXmlElement(key, metadata[key], '    ');
        if (element) xml += element + '\n';
      }
    }

    // Then add any remaining elements
    for (const [key, value] of Object.entries(metadata)) {
      if (!metadataOrder.includes(key) && !['apiVersion', 'description', 'label', 'processType', 'status'].includes(key)) {
        const element = buildXmlElement(key, value, '    ');
        if (element) xml += element + '\n';
      }
    }
  }

  xml += `</Flow>`;

  return xml;
}

export default withErrorHandling(handler);
