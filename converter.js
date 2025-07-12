const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class NitradoAPIConverter {
  constructor(config = {}) {
    // Default configuration
    const defaultConfig = {
      apiDataUrl: 'https://doc.nitrado.net/api_data.js?v=1752345280167',
      outputDir: './output',
      serverUrl: 'https://api.nitrado.net',
      apiTitle: 'Nitrado API',
      apiDescription: 'Official Nitrado API for managing game servers, domains, and other services',
      apiVersion: '1.0.0',
      contactName: 'Nitrado Support',
      contactUrl: 'https://nitrado.net/support',
      licenseUrl: 'https://nitrado.net/terms'
    };

    // Merge provided config with defaults
    this.config = { ...defaultConfig, ...config };

    // Set instance properties from config
    this.apiDataUrl = this.config.apiDataUrl;
    this.outputDir = this.config.outputDir;
    this.serverUrl = this.config.serverUrl;
    this.apiData = null;
    this.usedOperationIds = new Set(); // Track used operation IDs
  }

  /**
   * Fetch and parse the API data from the Nitrado endpoint
   */
  async fetchAPIData() {
    console.log('🌐 Fetching API data from:', this.apiDataUrl);

    try {
      const response = await axios.get(this.apiDataUrl);
      console.log('✅ HTTP request successful');
      console.log('📊 Response data type:', typeof response.data);

      const processedData = this.processResponseData(response.data);
      const parsedData = this.parseAPIData(processedData);
      
      this.apiData = parsedData;
      return this.extractAPIEndpoints(parsedData);
    } catch (error) {
      console.error('❌ Error fetching API data:', error.message);
      throw error;
    }
  }

  /**
   * Process response data by stripping define() wrapper if needed
   */
  processResponseData(data) {
    if (typeof data === 'string') {
      console.log('📊 Response length:', data.length);
      const stripped = data.replace(/^define\(/, '').replace(/\);?\s*$/, '');
      console.log('🔄 Stripped define() wrapper');
      console.log('📊 Stripped content length:', stripped.length);
      return stripped;
    }
    
    console.log('📊 Response is already an object, using directly');
    return JSON.stringify(data);
  }

  /**
   * Parse API data from processed string
   */
  parseAPIData(processedData) {
    try {
      const parsed = JSON.parse(processedData);
      console.log('✅ JSON parsing successful!');
      console.log('📊 API data type:', typeof parsed);
      return parsed;
    } catch (jsonError) {
      console.error('❌ JSON parse error:', jsonError.message);
      this.logParseError(jsonError, processedData);
      throw new Error('Failed to parse API data: ' + jsonError.message);
    }
  }

  /**
   * Log detailed parse error information
   */
  logParseError(jsonError, data) {
    const positionMatch = jsonError.message.match(/at position (\d+)/);
    
    if (!positionMatch) {
      console.error('Could not determine error position.');
      return;
    }

    const pos = parseInt(positionMatch[1], 10);
    const before = data.slice(Math.max(0, pos - 100), pos);
    const after = data.slice(pos, pos + 100);
    console.error(
      `Problematic area around position ${pos}:\n...${before}[HERE]${after}...`
    );
  }

  /**
   * Extract API endpoints from parsed data
   */
  extractAPIEndpoints(data) {
    const hasAPIEndpoints = data?.api && Array.isArray(data.api);
    
    if (hasAPIEndpoints) {
      console.log('📊 Found', data.api.length, 'API endpoints');
      return data.api;
    }
    
    console.log('📊 API data structure:', Object.keys(data || {}));
    return data;
  }  /**
   * Convert API data to OpenAPI 3.1.1 specification
   */
  convertToOpenAPI() {
    this.validateAPIData();
    
    console.log('🔄 Converting to OpenAPI 3.1.1 specification...');
    this.usedOperationIds.clear();

    const openAPISpec = this.createBaseOpenAPISpec();
    const endpointsByGroup = this.groupEndpointsByGroup();
    
    console.log('� Found', Object.keys(endpointsByGroup).length, 'API groups');
    
    this.apiData.api.forEach(endpoint => {
      this.convertEndpoint(endpoint, openAPISpec);
    });

    console.log('✅ OpenAPI conversion completed');
    return openAPISpec;
  }

  /**
   * Validate API data is available for conversion
   */
  validateAPIData() {
    if (!this.apiData?.api) {
      throw new Error('No API data available. Please fetch data first.');
    }
  }

  /**
   * Create base OpenAPI specification structure
   */
  createBaseOpenAPISpec() {
    return {
      openapi: '3.1.1',
      info: this.createAPIInfo(),
      servers: this.createServers(),
      paths: {},
      components: this.createComponents()
    };
  }

  /**
   * Create API info section
   */
  createAPIInfo() {
    return {
      title: this.config.apiTitle,
      description: this.config.apiDescription,
      version: this.config.apiVersion,
      contact: {
        name: this.config.contactName,
        url: this.config.contactUrl
      },
      license: {
        name: 'Proprietary',
        url: this.config.licenseUrl
      }
    };
  }

  /**
   * Create servers section
   */
  createServers() {
    return [
      {
        url: this.serverUrl,
        description: 'Nitrado API Server'
      }
    ];
  }

  /**
   * Create components section
   */
  createComponents() {
    return {
      schemas: {},
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token authentication'
        }
      }
    };
  }

  /**
   * Group endpoints by their group/tag
   */
  groupEndpointsByGroup() {
    return this.apiData.api.reduce((groups, endpoint) => {
      const group = endpoint.group || 'Default';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(endpoint);
      return groups;
    }, {});
  }

  /**
   * Convert a single endpoint to OpenAPI format
   */
  convertEndpoint(endpoint, openAPISpec) {
    const { url, type: method = 'get' } = endpoint;
    
    if (!url) {
      console.warn('⚠️ Skipping endpoint without URL:', endpoint.name || 'Unknown');
      return;
    }

    const path = this.normalizePath(url);
    const normalizedMethod = method.toLowerCase();
    
    this.ensurePathExists(openAPISpec.paths, path);
    
    const operation = this.buildOperation(endpoint, path, normalizedMethod);
    openAPISpec.paths[path][normalizedMethod] = operation;
  }

  /**
   * Normalize URL path by converting :param to {param}
   */
  normalizePath(url) {
    return url.replace(/:(\w+)/g, '{$1}');
  }

  /**
   * Ensure path exists in OpenAPI spec
   */
  ensurePathExists(paths, path) {
    if (!paths[path]) {
      paths[path] = {};
    }
  }

  /**
   * Build complete operation object
   */
  buildOperation(endpoint, path, method) {
    const baseOperationId = this.generateOperationId(endpoint);
    const operationId = this.ensureUniqueOperationId(baseOperationId);

    const operation = {
      summary: endpoint.title || endpoint.name || `${method.toUpperCase()} ${path}`,
      description: endpoint.description || '',
      operationId: operationId,
      tags: [endpoint.group || 'Default'],
      parameters: [],
      responses: {}
    };

    this.addDeprecationInfo(endpoint, operation);
    this.addParameters(endpoint, operation, path);
    this.addRequestBodyIfNeeded(endpoint, operation, method);
    this.addResponses(endpoint, operation);
    this.addSecurityIfNeeded(endpoint, operation);

    return operation;
  }

  /**
   * Add deprecation information if endpoint is deprecated
   */
  addDeprecationInfo(endpoint, operation) {
    if (!endpoint.deprecated) return;
    
    operation.deprecated = true;
    if (endpoint.deprecated.content) {
      operation.description += `\n\n**Deprecated:** ${endpoint.deprecated.content}`;
    }
  }

  /**
   * Add request body for POST/PUT/PATCH methods
   */
  addRequestBodyIfNeeded(endpoint, operation, method) {
    const methodsWithBody = ['post', 'put', 'patch'];
    if (methodsWithBody.includes(method)) {
      this.addRequestBody(endpoint, operation);
    }
  }

  /**
   * Add security if endpoint is not public
   */
  addSecurityIfNeeded(endpoint, operation) {
    if (!endpoint.public) {
      operation.security = [{ BearerAuth: [] }];
    }
  }

  /**
   * Add parameters to OpenAPI operation
   */
  addParameters(endpoint, operation, path) {
    const pathParams = this.extractPathParameters(path);
    const queryParams = this.extractQueryParameters(endpoint);
    const headerParams = this.extractHeaderParameters(endpoint);
    
    operation.parameters.push(...pathParams, ...queryParams, ...headerParams);
  }

  /**
   * Extract path parameters from URL path
   */
  extractPathParameters(path) {
    const pathParamMatches = path.match(/\{(\w+)\}/g) || [];
    
    return pathParamMatches.map(param => {
      const paramName = param.replace(/[{}]/g, '');
      return {
        name: paramName,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `The ${paramName} parameter`
      };
    });
  }

  /**
   * Extract query parameters from endpoint
   */
  extractQueryParameters(endpoint) {
    const parameterFields = endpoint.parameter?.fields;
    if (!parameterFields) return [];
    
    const queryParams = parameterFields.Parameter || parameterFields.Query || [];
    
    return queryParams.map(param => ({
      name: param.field,
      in: 'query',
      required: !param.optional,
      schema: this.parseParameterType(param.type),
      description: param.description || ''
    }));
  }

  /**
   * Extract header parameters from endpoint
   */
  extractHeaderParameters(endpoint) {
    const headerFields = endpoint.header?.fields;
    if (!headerFields) return [];
    
    const headerParams = headerFields.Header || [];
    
    return headerParams.map(param => ({
      name: param.field,
      in: 'header',
      required: !param.optional,
      schema: { type: 'string' },
      description: param.description || ''
    }));
  }

  /**
   * Add request body to OpenAPI operation
   */
  addRequestBody(endpoint, operation) {
    const bodyParams = this.extractBodyParameters(endpoint);
    
    if (bodyParams.length === 0) return;

    const { properties, required } = this.buildRequestBodySchema(bodyParams);
    
    operation.requestBody = {
      required: required.length > 0,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties,
            ...(required.length > 0 && { required })
          }
        }
      }
    };
  }

  /**
   * Extract body parameters from endpoint
   */
  extractBodyParameters(endpoint) {
    const parameterFields = endpoint.parameter?.fields;
    if (!parameterFields) return [];
    
    return parameterFields.Body || parameterFields.Request || [];
  }

  /**
   * Build request body schema from parameters
   */
  buildRequestBodySchema(bodyParams) {
    const properties = {};
    const required = [];

    bodyParams.forEach(param => {
      const paramSchema = this.parseParameterType(param.type);
      properties[param.field] = {
        ...paramSchema,
        description: param.description || ''
      };

      if (!param.optional) {
        required.push(param.field);
      }
    });

    return { properties, required };
  }

  /**
   * Add responses to OpenAPI operation
   */
  addResponses(endpoint, operation) {
    const successResponse = this.buildSuccessResponse(endpoint);
    const errorResponse = this.buildErrorResponse(endpoint);
    const standardResponses = this.buildStandardResponses();
    
    operation.responses = {
      '200': successResponse,
      ...errorResponse,
      ...standardResponses
    };
  }

  /**
   * Build success response (200)
   */
  buildSuccessResponse(endpoint) {
    const successFields = this.extractSuccessFields(endpoint);
    
    if (successFields.length === 0) {
      return {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    const properties = this.buildResponseProperties(successFields);
    
    return {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties
          }
        }
      }
    };
  }

  /**
   * Extract success fields from endpoint
   */
  extractSuccessFields(endpoint) {
    const successFields = endpoint.success?.fields;
    if (!successFields) return [];
    
    return successFields['Success 200'] || successFields.Success || [];
  }

  /**
   * Build error response (400) if error fields exist
   */
  buildErrorResponse(endpoint) {
    const errorFields = endpoint.error?.fields;
    if (!errorFields) return {};
    
    const hasErrorFields = (errorFields['Error 4xx'] || errorFields.Error || []).length > 0;
    
    if (!hasErrorFields) return {};
    
    return {
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Build standard HTTP responses
   */
  buildStandardResponses() {
    return {
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' },
      '500': { description: 'Internal Server Error' }
    };
  }

  /**
   * Build response properties from fields
   */
  buildResponseProperties(fields) {
    const properties = {};
    
    fields.forEach(field => {
      const fieldSchema = this.parseParameterType(field.type);
      properties[field.field] = {
        ...fieldSchema,
        description: field.description || ''
      };
    });
    
    return properties;
  }

  /**
   * Generate operation ID from endpoint
   */
  generateOperationId(endpoint) {
    const method = (endpoint.type || 'get').toLowerCase();
    const url = endpoint.url || '';
    
    if (endpoint.name?.trim()) {
      return this.generateOperationIdFromName(endpoint, method, url);
    }
    
    return this.generateOperationIdFromPath(method, url);
  }

  /**
   * Generate operation ID from endpoint name
   */
  generateOperationIdFromName(endpoint, method, url) {
    const cleanName = endpoint.name.replace(/[^a-zA-Z0-9]/g, '');
    const isGeneric = this.isGenericOperationName(cleanName);
    
    if (isGeneric) {
      return this.generateContextualOperationId(endpoint, cleanName, url);
    }
    
    return this.addPathContextIfNeeded(cleanName, url);
  }

  /**
   * Generate operation ID from URL path
   */
  generateOperationIdFromPath(method, url) {
    const pathParts = this.extractPathParts(url);
    const processedParts = this.processPathParts(pathParts);
    const methodCapitalized = this.capitalizeFirst(method);
    
    return methodCapitalized + processedParts.join('');
  }

  /**
   * Check if operation name is generic
   */
  isGenericOperationName(name) {
    const genericNames = [
      'Details', 'List', 'Create', 'Update', 'Delete', 'Get', 'Post', 'Put', 'Patch',
      'Restart', 'Stop', 'Start', 'Info', 'Status', 'Check', 'Add', 'Remove', 'Set',
      'Generate', 'Enable', 'Disable', 'Send', 'Receive', 'Upload', 'Download'
    ];
    
    return genericNames.some(generic => 
      name.toLowerCase().includes(generic.toLowerCase())
    ) || name.length < 4;
  }

  /**
   * Generate contextual operation ID for generic names
   */
  generateContextualOperationId(endpoint, cleanName, url) {
    const groupPrefix = this.getGroupPrefix(endpoint);
    const pathId = this.generatePathId(url);
    
    return this.capitalizeFirst(groupPrefix + pathId + cleanName);
  }

  /**
   * Add path context if needed for potentially duplicate names
   */
  addPathContextIfNeeded(cleanName, url) {
    const pathParts = this.extractPathParts(url);
    const urlDepth = pathParts.length;
    
    if (urlDepth > 2) {
      const processedParts = this.processPathParts(pathParts);
      const lastTwoParts = processedParts.slice(-2).join('');
      return this.capitalizeFirst(lastTwoParts + cleanName);
    }
    
    return cleanName;
  }

  /**
   * Get group prefix for operation ID
   */
  getGroupPrefix(endpoint) {
    const group = endpoint.group;
    return (group && group !== 'Default') ? 
      group.replace(/[^a-zA-Z0-9]/g, '') : '';
  }

  /**
   * Generate path ID from URL
   */
  generatePathId(url) {
    const pathParts = this.extractPathParts(url);
    const processedParts = this.processPathParts(pathParts);
    return processedParts.join('');
  }

  /**
   * Extract path parts from URL
   */
  extractPathParts(url) {
    return url.replace(/^\//, '').split('/').filter(part => part);
  }

  /**
   * Process path parts to PascalCase
   */
  processPathParts(pathParts) {
    return pathParts.map(part => {
      if (part.startsWith(':')) {
        return this.convertParamToPascalCase(part.substring(1));
      }
      return this.convertToPascalCase(part);
    });
  }

  /**
   * Convert parameter to PascalCase
   */
  convertParamToPascalCase(param) {
    return param.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
                .replace(/^[a-z]/, letter => letter.toUpperCase());
  }

  /**
   * Convert string to PascalCase
   */
  convertToPascalCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
              .replace(/^[a-z]/, letter => letter.toUpperCase());
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.replace(/^[a-z]/, letter => letter.toUpperCase());
  }

  /**
   * Ensure operation ID is unique by adding suffix if needed
   */
  ensureUniqueOperationId(baseId) {
    if (!this.usedOperationIds.has(baseId)) {
      this.usedOperationIds.add(baseId);
      return baseId;
    }

    // If base ID is taken, try with numeric suffix
    let counter = 2;
    let uniqueId = `${baseId}${counter}`;

    while (this.usedOperationIds.has(uniqueId)) {
      counter++;
      uniqueId = `${baseId}${counter}`;
    }

    this.usedOperationIds.add(uniqueId);
    return uniqueId;
  }

  /**
   * Parse parameter type to OpenAPI schema
   */
  parseParameterType(type) {
    if (!type) return { type: 'string' };
    
    const normalizedType = type.toLowerCase();
    const typeMap = {
      string: () => ({ type: 'string' }),
      number: () => ({ type: 'integer' }),
      integer: () => ({ type: 'integer' }),
      int: () => ({ type: 'integer' }),
      boolean: () => ({ type: 'boolean' }),
      bool: () => ({ type: 'boolean' }),
      array: () => ({ type: 'array', items: { type: 'string' } }),
      object: () => ({ type: 'object' })
    };
    
    const matchingType = Object.keys(typeMap).find(key => 
      normalizedType.includes(key)
    );
    
    return matchingType ? typeMap[matchingType]() : { type: 'string' };
  }

  /**
   * Save extracted data as JSON
   */
  async saveAsJSON(data, filename = 'nitrado-api.json') {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      const filePath = path.join(this.outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log('💾 Data saved to:', filePath);
      return filePath;
    } catch (error) {
      console.error('❌ Error saving file:', error.message);
      throw error;
    }
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 Starting Nitrado API extraction...');
      
      await this.executeExtractionPipeline();
      
      console.log('✅ All tasks completed successfully!');
      this.logSummary();
    } catch (error) {
      console.error('❌ Error during execution:', error.message);
      process.exit(1);
    }
  }

  /**
   * Execute the complete extraction pipeline
   */
  async executeExtractionPipeline() {
    await this.fetchAPIData();
    await this.saveRawData();
    await this.convertAndSaveOpenAPI();
  }

  /**
   * Save raw API data
   */
  async saveRawData() {
    return this.saveAsJSON(this.apiData, 'nitrado-api.json');
  }

  /**
   * Convert to OpenAPI and save
   */
  async convertAndSaveOpenAPI() {
    const openAPISpec = this.convertToOpenAPI();
    return this.saveAsJSON(openAPISpec, 'nitrado-openapi.json');
  }

  /**
   * Log execution summary
   */
  logSummary() {
    const endpointCount = this.apiData?.api?.length || 0;
    const openAPISpec = this.convertToOpenAPI();
    const pathCount = Object.keys(openAPISpec.paths).length;
    
    console.log('📊 Summary:');
    console.log(`  - Extracted ${endpointCount} API endpoints`);
    console.log(`  - Generated OpenAPI spec with ${pathCount} paths`);
    console.log(`  - Files saved to: ${this.outputDir}/`);
  }
}

// Allow running as script
if (require.main === module) {
  const Config = require('./config');
  const config = new Config().getConfig();
  const converter = new NitradoAPIConverter(config);
  converter.run();
}

module.exports = NitradoAPIConverter;
