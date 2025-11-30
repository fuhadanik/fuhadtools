/**
 * Salesforce API Client
 * Handles all Salesforce REST API calls
 */

const API_VERSION = 'v62.0';

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
   * Get layouts for an object using Tooling API
   */
  async getLayouts(objectName) {
    try {
      const layouts = [];

      // Query Layout using Tooling API (not standard REST API)
      try {
        const layoutQuery = `SELECT Id, Name FROM Layout WHERE EntityDefinition.QualifiedApiName = '${objectName}'`;
        const toolingUrl = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(layoutQuery)}`;

        const response = await fetch(toolingUrl, {
          headers: {
            'Authorization': `Bearer ${this.sessionId}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.records) {
            data.records.forEach(layout => {
              layouts.push({
                id: layout.Id,
                label: layout.Name,
                type: 'Layout',
              });
            });
          }
        }
      } catch (error) {
        console.error('Error fetching layouts:', error);
      }

      // Query FlexiPages using Tooling API
      try {
        const flexiQuery = `SELECT Id, DeveloperName FROM FlexiPage WHERE EntityDefinition.QualifiedApiName = '${objectName}'`;
        const toolingUrl = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(flexiQuery)}`;

        const response = await fetch(toolingUrl, {
          headers: {
            'Authorization': `Bearer ${this.sessionId}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.records) {
            data.records.forEach(page => {
              layouts.push({
                id: page.Id,
                label: `${page.DeveloperName} [FlexiPage]`,
                type: 'FlexiPage',
              });
            });
          }
        }
      } catch (error) {
        console.error('Error fetching FlexiPages:', error);
      }

      // If no layouts found, add default option
      if (layouts.length === 0) {
        layouts.push({
          id: 'default',
          label: `${objectName} - All Fields`,
          type: 'Layout',
        });
      }

      return layouts;
    } catch (error) {
      console.error('Error fetching layouts:', error);
      throw error;
    }
  }

  /**
   * Get layout metadata using Tooling API
   */
  async getLayoutMetadata(objectName, layoutId) {
    const url = `${this.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/Layout/${layoutId}`;
    const headers = {
      'Authorization': `Bearer ${this.sessionId}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Layout fetch error: ${response.status}`);
      }

      const data = await response.json();
      return data.Metadata; // Return the Metadata object
    } catch (error) {
      console.error('Error fetching Layout metadata:', error);
      throw error;
    }
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
