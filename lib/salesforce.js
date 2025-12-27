/**
 * Salesforce API Client
 * Handles all Salesforce REST API calls
 */

const API_VERSION = 'v59.0';

export class SalesforceClient {
  constructor(instanceUrl, sessionId) {
    this.instanceUrl = instanceUrl.replace(/\/$/, ''); // Remove trailing slash
    this.sessionId = sessionId;
    this.baseUrl = `${this.instanceUrl}/services/data/${API_VERSION}`;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.sessionId}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Salesforce API request failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate the session by making a simple API call
   */
  async validateSession() {
    try {
      await this.makeRequest('/');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all objects (sobjects)
   */
  async getObjects() {
    const response = await this.makeRequest('/sobjects');
    return response.sobjects.map(obj => ({
      name: obj.name,
      label: obj.label,
      labelPlural: obj.labelPlural,
    }));
  }

  /**
   * Get object describe metadata
   */
  async describeObject(objectName) {
    return await this.makeRequest(`/sobjects/${objectName}/describe`);
  }

  /**
   * Get record types for an object
   */
  async getRecordTypes(objectName) {
    const describe = await this.describeObject(objectName);
    return describe.recordTypeInfos
      .filter(rt => rt.available)
      .map(rt => ({
        id: rt.recordTypeId,
        name: rt.name,
        developerName: rt.developerName,
      }));
  }

  /**
   * Get layouts for an object (Page Layouts and FlexiPages)
   */
  async getLayouts(objectName) {
    const result = {
      pageLayouts: [],
      flexiPages: [],
    };

    // Get ALL Page Layouts using Tooling API
    // Query using EntityDefinition.QualifiedApiName - only select Id and Name (no FullName in bulk)
    try {
      const layoutQuery = `SELECT Id, Name FROM Layout WHERE EntityDefinition.QualifiedApiName = '${objectName}'`;
      const layoutUrl = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(layoutQuery)}`;

      console.log('Layout query:', layoutQuery);

      const layoutResponse = await fetch(layoutUrl, {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`,
          'Content-Type': 'application/json',
        },
      });

      if (layoutResponse.ok) {
        const layoutData = await layoutResponse.json();
        console.log('Layout query returned:', layoutData.records?.length || 0, 'layouts');
        if (layoutData.records && layoutData.records.length > 0) {
          for (const layout of layoutData.records) {
            // Name is just the layout name (not prefixed with object name)
            result.pageLayouts.push({
              id: layout.Id,
              label: layout.Name,
              apiName: layout.Name,
              type: 'Layout',
            });
          }
        }
      } else {
        const errorText = await layoutResponse.text();
        console.error('Layout query error:', layoutResponse.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching layouts via Tooling API:', error);
    }

    // Fallback: try describe/layouts if Tooling API didn't return results
    if (result.pageLayouts.length === 0) {
      try {
        const layoutsData = await this.makeRequest(`/sobjects/${objectName}/describe/layouts`);
        const seenLayoutIds = new Set();

        console.log('describe/layouts keys:', Object.keys(layoutsData));
        console.log('recordTypeMappings count:', layoutsData.recordTypeMappings?.length);

        // Extract layouts from recordTypeMappings
        if (layoutsData.recordTypeMappings) {
          for (const mapping of layoutsData.recordTypeMappings) {
            if (mapping.layoutId && !seenLayoutIds.has(mapping.layoutId)) {
              seenLayoutIds.add(mapping.layoutId);

              // Try to find a better name from layouts array
              let layoutName = mapping.layoutName || mapping.name || `Layout for ${mapping.recordTypeName || 'Master'}`;

              // Check if layouts array exists and has metadata
              if (layoutsData.layouts) {
                const layoutIndex = layoutsData.recordTypeMappings.indexOf(mapping);
                if (layoutsData.layouts[layoutIndex]?.id) {
                  layoutName = layoutsData.layouts[layoutIndex].id.split('-').pop() || layoutName;
                }
              }

              result.pageLayouts.push({
                id: mapping.layoutId,
                label: layoutName,
                apiName: mapping.layoutId,
                type: 'Layout',
                recordTypeName: mapping.recordTypeName,
              });
            }
          }
        }

        console.log('Extracted', result.pageLayouts.length, 'layouts from describe');
      } catch (error) {
        console.error('Error fetching page layouts via describe:', error);
      }
    }

    // Get FlexiPages (Lightning Record Pages) via Tooling API
    try {
      const query = `SELECT Id, DeveloperName, MasterLabel FROM FlexiPage WHERE EntityDefinition.QualifiedApiName = '${objectName}' AND Type = 'RecordPage'`;
      const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(query)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.records) {
          for (const page of data.records) {
            result.flexiPages.push({
              id: page.Id,
              label: page.MasterLabel || page.DeveloperName,
              apiName: page.DeveloperName,
              type: 'FlexiPage',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching FlexiPages:', error);
    }

    return result;
  }

  /**
   * Get all layouts for an object (including record type mappings)
   */
  async getLayoutsForObject(objectName) {
    return await this.makeRequest(`/sobjects/${objectName}/describe/layouts`);
  }

  /**
   * Get layout metadata using Tooling API
   */
  async getLayoutMetadata(objectName, layoutId) {
    // First try the describe layouts endpoint
    const layoutsData = await this.makeRequest(`/sobjects/${objectName}/describe/layouts`);

    // Check if layoutId is an index reference (e.g., "layout-0")
    if (layoutId.startsWith('layout-')) {
      const index = parseInt(layoutId.split('-')[1], 10);
      if (layoutsData.layouts && layoutsData.layouts[index]) {
        return layoutsData.layouts[index];
      }
    }

    // Try to find in layouts array if available
    if (layoutsData.recordTypeMappings && layoutsData.layouts) {
      for (let i = 0; i < layoutsData.recordTypeMappings.length; i++) {
        const mapping = layoutsData.recordTypeMappings[i];
        if (mapping.layoutId === layoutId && layoutsData.layouts[i]) {
          return layoutsData.layouts[i];
        }
      }
    }

    // If layouts array is not available, use Tooling API to get layout metadata
    try {
      const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/Layout/${layoutId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const toolingLayout = await response.json();

        // Parse the Metadata field if it exists
        if (toolingLayout.Metadata) {
          const metadata = typeof toolingLayout.Metadata === 'string'
            ? JSON.parse(toolingLayout.Metadata)
            : toolingLayout.Metadata;

          // Convert Tooling API format to describe layouts format
          return this.convertToolingLayoutToDescribe(metadata, objectName);
        }
      }
    } catch (error) {
      console.error('Tooling API layout fetch error:', error);
    }

    // Final fallback: return first available layout
    if (layoutsData.layouts && layoutsData.layouts.length > 0) {
      return layoutsData.layouts[0];
    }

    throw new Error(`Layout ${layoutId} not found for object ${objectName}`);
  }

  /**
   * Convert Tooling API layout metadata to describe format
   */
  convertToolingLayoutToDescribe(metadata, objectName) {
    const result = {
      detailLayoutSections: [],
      relatedLists: [],
    };

    if (metadata.layoutSections) {
      metadata.layoutSections.forEach(section => {
        const layoutSection = {
          heading: section.label || 'Section',
          layoutRows: [],
        };

        if (section.layoutColumns) {
          // Combine all columns into rows
          const maxItems = Math.max(...section.layoutColumns.map(col =>
            col.layoutItems ? col.layoutItems.length : 0
          ));

          for (let i = 0; i < maxItems; i++) {
            const layoutRow = { layoutItems: [] };

            section.layoutColumns.forEach(col => {
              if (col.layoutItems && col.layoutItems[i]) {
                const item = col.layoutItems[i];
                layoutRow.layoutItems.push({
                  layoutComponents: [{
                    type: 'Field',
                    value: item.field,
                  }],
                });
              }
            });

            if (layoutRow.layoutItems.length > 0) {
              layoutSection.layoutRows.push(layoutRow);
            }
          }
        }

        result.detailLayoutSections.push(layoutSection);
      });
    }

    // Convert related lists from Tooling API format
    if (metadata.relatedLists) {
      metadata.relatedLists.forEach(rl => {
        const columns = [];
        if (rl.fields) {
          rl.fields.forEach(field => {
            columns.push({
              field: field,
              label: field,
            });
          });
        }
        result.relatedLists.push({
          relatedList: rl.relatedList,
          name: rl.relatedList,
          label: rl.relatedList?.replace(/__r$/, '').replace(/_/g, ' ') || rl.relatedList,
          columns: columns,
        });
      });
    }

    return result;
  }

  /**
   * Get record type-specific picklist values using UI API
   * @param {string} objectName - The API name of the object
   * @param {string} recordTypeId - The record type ID
   * @returns {object} Map of field API names to array of picklist values
   */
  async getPicklistValuesForRecordType(objectName, recordTypeId) {
    const url = `/ui-api/object-info/${objectName}/picklist-values/${recordTypeId}`;

    try {
      const response = await this.makeRequest(url);

      // Convert UI API response to simple format: { fieldName: [value1, value2, ...] }
      const result = {};
      if (response.picklistFieldValues) {
        for (const fieldName of Object.keys(response.picklistFieldValues)) {
          const fieldData = response.picklistFieldValues[fieldName];
          if (fieldData.values && fieldData.values.length > 0) {
            result[fieldName] = fieldData.values.map(v => v.value);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error fetching picklist values for record type:', error.message);
      return {};
    }
  }

  /**
   * Get layout related lists directly from Tooling API
   */
  async getLayoutRelatedLists(layoutId) {
    try {
      const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/Layout/${layoutId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const toolingLayout = await response.json();
        if (toolingLayout.Metadata) {
          const metadata = typeof toolingLayout.Metadata === 'string'
            ? JSON.parse(toolingLayout.Metadata)
            : toolingLayout.Metadata;

          const relatedLists = [];
          if (metadata.relatedLists) {
            metadata.relatedLists.forEach(rl => {
              const columns = [];
              if (rl.fields) {
                rl.fields.forEach(field => {
                  columns.push({ field: field, label: field });
                });
              }
              relatedLists.push({
                name: rl.relatedList,
                label: rl.relatedList?.replace(/__r$/, '').replace(/_/g, ' ') || rl.relatedList,
                columns: columns,
              });
            });
          }
          return relatedLists;
        }
      }
    } catch (error) {
      console.error('Error fetching layout related lists:', error);
    }
    return [];
  }

  /**
   * Get FlexiPage metadata using Tooling API
   */
  async getFlexiPageMetadata(flexiPageId) {
    const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/FlexiPage/${flexiPageId}`;
    const headers = {
      'Authorization': `Bearer ${this.sessionId}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`FlexiPage fetch error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching FlexiPage metadata:', error);
      throw error;
    }
  }
}
