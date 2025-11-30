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
   * Get layouts for an object (Page Layouts)
   */
  async getLayouts(objectName) {
    try {
      const layouts = [];

      // Get Page Layouts from describe endpoint
      try {
        const layoutsResponse = await this.makeRequest(`/sobjects/${objectName}/describe/layouts`);
        if (layoutsResponse && layoutsResponse.layouts) {
          layoutsResponse.layouts.forEach(layout => {
            layouts.push({
              id: layout.id,
              label: layout.name,
              type: 'Layout',
            });
          });
        }
      } catch (error) {
        console.error('Error fetching page layouts:', error);
      }

      // Query for FlexiPages using Tooling API
      try {
        const flexiPageQuery = `SELECT Id, DeveloperName, MasterLabel FROM FlexiPage WHERE Type = 'RecordPage'`;
        const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(flexiPageQuery)}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.sessionId}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const flexiPageResponse = await response.json();
          if (flexiPageResponse.records) {
            flexiPageResponse.records.forEach(page => {
              layouts.push({
                id: page.Id,
                label: page.MasterLabel || page.DeveloperName,
                type: 'FlexiPage',
              });
            });
          }
        }
      } catch (error) {
        console.error('Error fetching FlexiPages:', error);
      }

      return layouts;
    } catch (error) {
      console.error('Error fetching layouts:', error);
      throw error;
    }
  }

  /**
   * Get layout metadata
   */
  async getLayoutMetadata(objectName, layoutId) {
    return await this.makeRequest(`/sobjects/${objectName}/describe/layouts/${layoutId}`);
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
