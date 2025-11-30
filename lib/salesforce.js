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
   * Get layouts for an object (using record types as proxy)
   */
  async getLayouts(objectName) {
    try {
      // Get object describe (this always works)
      const describe = await this.describeObject(objectName);

      const layouts = [];

      // Use record types as layouts
      if (describe.recordTypeInfos && describe.recordTypeInfos.length > 0) {
        describe.recordTypeInfos.forEach(rt => {
          if (rt.available) {
            layouts.push({
              id: rt.recordTypeId,
              label: `${rt.name} Layout`,
              recordTypeId: rt.recordTypeId,
              objectName: objectName,
              type: 'Layout',
            });
          }
        });
      }

      // If no record types, add a default layout option
      if (layouts.length === 0) {
        layouts.push({
          id: 'default',
          label: `${objectName} - All Fields`,
          objectName: objectName,
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
