const fs = require('fs').promises;
const path = require('path');
const nock = require('nock');
const NitradoAPIConverter = require('../converter');
const { sampleApiData, sampleRawApiResponse } = require('./fixtures/sampleData');

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('NitradoAPIConverter', () => {
  let converter;
  let consoleLogSpy;

  beforeEach(() => {
    // Create converter with test configuration
    const testConfig = {
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

    converter = new NitradoAPIConverter(testConfig);
    jest.clearAllMocks();
    nock.cleanAll();

    // Mock console.log to reduce noise in tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    nock.cleanAll();
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(converter.apiDataUrl).toBe('https://doc.nitrado.net/api_data.js?v=1752345280167');
      expect(converter.outputDir).toBe('./output');
      expect(converter.serverUrl).toBe('https://api.nitrado.net');
      expect(converter.apiData).toBeNull();
      expect(converter.usedOperationIds).toBeInstanceOf(Set);
      expect(converter.usedOperationIds.size).toBe(0);
      expect(converter.config).toBeDefined();
      expect(converter.config.apiTitle).toBe('Nitrado API');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        apiDataUrl: 'https://custom.api.url',
        outputDir: './custom-output',
        serverUrl: 'https://custom.server.url',
        apiTitle: 'Custom API',
        apiVersion: '2.0.0'
      };

      const customConverter = new NitradoAPIConverter(customConfig);

      expect(customConverter.apiDataUrl).toBe('https://custom.api.url');
      expect(customConverter.outputDir).toBe('./custom-output');
      expect(customConverter.serverUrl).toBe('https://custom.server.url');
      expect(customConverter.config.apiTitle).toBe('Custom API');
      expect(customConverter.config.apiVersion).toBe('2.0.0');
    });

    it('should merge custom config with defaults', () => {
      const partialConfig = {
        apiTitle: 'Partial Config API'
      };

      const partialConverter = new NitradoAPIConverter(partialConfig);

      // Should have custom title
      expect(partialConverter.config.apiTitle).toBe('Partial Config API');
      // Should have default values for other fields
      expect(partialConverter.config.apiVersion).toBe('1.0.0');
      expect(partialConverter.config.contactName).toBe('Nitrado Support');
    });
  });

  describe('fetchAPIData', () => {
    beforeEach(() => {
      // Mock the API endpoint
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, sampleRawApiResponse);
    });

    it('should fetch and parse API data successfully', async () => {
      const result = await converter.fetchAPIData();

      expect(result).toEqual(sampleApiData.api);
      expect(converter.apiData).toEqual(sampleApiData);
    });

    it('should handle HTTP errors', async () => {
      nock.cleanAll();
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(404, 'Not Found');

      await expect(converter.fetchAPIData()).rejects.toThrow();
    });

    it('should handle invalid JSON', async () => {
      nock.cleanAll();
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, 'define({"invalid": json});');

      await expect(converter.fetchAPIData()).rejects.toThrow('Failed to parse API data');
    });

    it('should handle malformed define wrapper', async () => {
      nock.cleanAll();
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, 'not a define wrapper');

      await expect(converter.fetchAPIData()).rejects.toThrow();
    });

    it('should handle response without define wrapper', async () => {
      nock.cleanAll();
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, JSON.stringify(sampleApiData));

      // This should still work since the replace calls on JSON string will just not match
      const result = await converter.fetchAPIData();
      expect(result).toEqual(sampleApiData.api);
    });

    it('should handle empty response', async () => {
      nock.cleanAll();
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, 'define();');

      await expect(converter.fetchAPIData()).rejects.toThrow();
    });
  });

  describe('generateOperationId', () => {
    it('should generate operation ID from endpoint name', () => {
      const endpoint = {
        name: 'GetUserProfile',
        url: '/users/profile',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('UsersProfileGetUserProfile');
    });

    it('should generate operation ID for generic names with path context', () => {
      const endpoint = {
        name: 'Details',
        url: '/services/:id/gameservers/games/minecraft',
        type: 'get',
        group: 'Game_Minecraft'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('GameMinecraftServicesIdGameserversGamesMinecraftDetails');
    });

    it('should generate operation ID from path when no name is provided', () => {
      const endpoint = {
        url: '/company/stats',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('GetCompanyStats');
    });

    it('should handle path parameters correctly', () => {
      const endpoint = {
        url: '/services/:service_id/gameservers/:id',
        type: 'post'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('PostServicesServiceIdGameserversId');
    });

    it('should handle empty or missing URL', () => {
      const endpoint = {
        name: 'TestOperation',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('TestOperation');
    });

    it('should handle deep URLs with generic names', () => {
      const endpoint = {
        name: 'Get',
        url: '/very/deep/path/structure/with/many/parts',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('VeryDeepPathStructureWithManyPartsGet');
    });

    it('should handle underscores in path parameters', () => {
      const endpoint = {
        url: '/services/:service_id/users/:user_id',
        type: 'put'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('PutServicesServiceIdUsersUserId');
    });
  });

  describe('ensureUniqueOperationId', () => {
    it('should return the same ID if not used', () => {
      const result = converter.ensureUniqueOperationId('UniqueOperationId');
      expect(result).toBe('UniqueOperationId');
      expect(converter.usedOperationIds.has('UniqueOperationId')).toBe(true);
    });

    it('should add numeric suffix for duplicate IDs', () => {
      converter.ensureUniqueOperationId('DuplicateId');
      const result = converter.ensureUniqueOperationId('DuplicateId');

      expect(result).toBe('DuplicateId2');
      expect(converter.usedOperationIds.has('DuplicateId')).toBe(true);
      expect(converter.usedOperationIds.has('DuplicateId2')).toBe(true);
    });

    it('should handle multiple duplicates', () => {
      converter.ensureUniqueOperationId('TestId');
      converter.ensureUniqueOperationId('TestId');
      const result = converter.ensureUniqueOperationId('TestId');

      expect(result).toBe('TestId3');
    });

    it('should handle many duplicates', () => {
      for (let i = 0; i < 10; i++) {
        converter.ensureUniqueOperationId('ManyDuplicates');
      }
      const result = converter.ensureUniqueOperationId('ManyDuplicates');

      expect(result).toBe('ManyDuplicates11');
    });
  });

  describe('parseParameterType', () => {
    it('should parse string types', () => {
      expect(converter.parseParameterType('String')).toEqual({ type: 'string' });
      expect(converter.parseParameterType('string')).toEqual({ type: 'string' });
      expect(converter.parseParameterType('TEXT')).toEqual({ type: 'string' });
    });

    it('should parse integer types', () => {
      expect(converter.parseParameterType('Integer')).toEqual({ type: 'integer' });
      expect(converter.parseParameterType('number')).toEqual({ type: 'integer' });
      expect(converter.parseParameterType('int')).toEqual({ type: 'integer' });
      expect(converter.parseParameterType('NUMBER')).toEqual({ type: 'integer' });
    });

    it('should parse boolean types', () => {
      expect(converter.parseParameterType('Boolean')).toEqual({ type: 'boolean' });
      expect(converter.parseParameterType('bool')).toEqual({ type: 'boolean' });
      expect(converter.parseParameterType('BOOLEAN')).toEqual({ type: 'boolean' });
    });

    it('should parse array types', () => {
      expect(converter.parseParameterType('Array')).toEqual({
        type: 'array',
        items: { type: 'string' }
      });
      expect(converter.parseParameterType('array')).toEqual({
        type: 'array',
        items: { type: 'string' }
      });
    });

    it('should parse object types', () => {
      expect(converter.parseParameterType('Object')).toEqual({ type: 'object' });
      expect(converter.parseParameterType('object')).toEqual({ type: 'object' });
    });

    it('should default to string for unknown types', () => {
      expect(converter.parseParameterType('unknown')).toEqual({ type: 'string' });
      expect(converter.parseParameterType('')).toEqual({ type: 'string' });
      expect(converter.parseParameterType()).toEqual({ type: 'string' });
      expect(converter.parseParameterType(null)).toEqual({ type: 'string' });
    });
  });

  describe('convertToOpenAPI', () => {
    beforeEach(() => {
      converter.apiData = sampleApiData;
    });

    it('should convert API data to OpenAPI specification', () => {
      const result = converter.convertToOpenAPI();

      expect(result.openapi).toBe('3.1.1');
      expect(result.info.title).toBe('Nitrado API');
      expect(result.paths).toBeDefined();
      expect(result.components.securitySchemes.BearerAuth).toBeDefined();
    });

    it('should reset operation IDs tracking', () => {
      converter.usedOperationIds.add('existingId');
      converter.convertToOpenAPI();

      expect(converter.usedOperationIds.has('existingId')).toBe(false);
    });

    it('should throw error if no API data is available', () => {
      converter.apiData = null;

      expect(() => converter.convertToOpenAPI()).toThrow('No API data available');
    });

    it('should throw error if API data has no api property', () => {
      converter.apiData = { notApi: [] };

      expect(() => converter.convertToOpenAPI()).toThrow('No API data available');
    });

    it('should group endpoints by tags', () => {
      const result = converter.convertToOpenAPI();

      // Check that paths are created
      expect(result.paths['/company/stats']).toBeDefined();
      expect(result.paths['/domain/{domain}/service']).toBeDefined();
      expect(result.paths['/services/{id}/gameservers/games/minecraft']).toBeDefined();
    });

    it('should handle deprecated endpoints', () => {
      const result = converter.convertToOpenAPI();

      const domainServicePath = result.paths['/domain/{domain}/service'];
      expect(domainServicePath.post.deprecated).toBe(true);
      expect(domainServicePath.post.description).toContain('Deprecated');
    });

    it('should add security schemes to operations', () => {
      const result = converter.convertToOpenAPI();

      const companyStatsOp = result.paths['/company/stats'].get;
      expect(companyStatsOp.security).toEqual([{ BearerAuth: [] }]);
    });

    it('should create proper OpenAPI structure', () => {
      const result = converter.convertToOpenAPI();

      expect(result).toHaveProperty('openapi');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('servers');
      expect(result).toHaveProperty('paths');
      expect(result).toHaveProperty('components');
      expect(result.info).toHaveProperty('title');
      expect(result.info).toHaveProperty('version');
      expect(result.components).toHaveProperty('securitySchemes');
    });
  });

  describe('convertEndpoint', () => {
    let openAPISpec;

    beforeEach(() => {
      openAPISpec = {
        openapi: '3.1.1',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer' } } }
      };
    });

    it('should convert a simple GET endpoint', () => {
      const endpoint = sampleApiData.api[0]; // Company stats endpoint

      converter.convertEndpoint(endpoint, openAPISpec);

      const path = openAPISpec.paths['/company/stats'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
      expect(path.get.summary).toBe('Get company stats');
      expect(path.get.operationId).toBe('CompanyCompanyStatsGetStats');
      expect(path.get.tags).toEqual(['Company']);
    });

    it('should convert path parameters', () => {
      const endpoint = sampleApiData.api[1]; // Domain service endpoint

      converter.convertEndpoint(endpoint, openAPISpec);

      const path = openAPISpec.paths['/domain/{domain}/service'];
      const operation = path.post;
      const domainParam = operation.parameters.find(p => p.name === 'domain');

      expect(domainParam).toBeDefined();
      expect(domainParam.in).toBe('path');
      expect(domainParam.required).toBe(true);
    });

    it('should convert query parameters', () => {
      const endpoint = sampleApiData.api[1]; // Domain service endpoint

      converter.convertEndpoint(endpoint, openAPISpec);

      const path = openAPISpec.paths['/domain/{domain}/service'];
      const operation = path.post;
      const serviceIdParam = operation.parameters.find(p => p.name === 'service_id');

      expect(serviceIdParam).toBeDefined();
      expect(serviceIdParam.in).toBe('query');
      expect(serviceIdParam.required).toBe(true);
      expect(serviceIdParam.schema.type).toBe('integer');
    });

    it('should convert header parameters', () => {
      const endpoint = sampleApiData.api[1]; // Domain service endpoint

      converter.convertEndpoint(endpoint, openAPISpec);

      const path = openAPISpec.paths['/domain/{domain}/service'];
      const operation = path.post;
      const authParam = operation.parameters.find(p => p.name === 'Authorization');

      expect(authParam).toBeDefined();
      expect(authParam.in).toBe('header');
      expect(authParam.required).toBe(false);
    });

    it('should skip endpoints without URL', () => {
      const endpoint = { name: 'InvalidEndpoint', type: 'get' };

      converter.convertEndpoint(endpoint, openAPISpec);

      expect(Object.keys(openAPISpec.paths)).toHaveLength(0);
    });

    it('should handle multiple path parameters', () => {
      const endpoint = {
        name: 'TestMultipleParams',
        url: '/services/:service_id/users/:user_id/items/:item_id',
        type: 'get'
      };

      converter.convertEndpoint(endpoint, openAPISpec);

      const path = openAPISpec.paths['/services/{service_id}/users/{user_id}/items/{item_id}'];
      const operation = path.get;

      expect(operation.parameters).toHaveLength(3);
      expect(operation.parameters[0].name).toBe('service_id');
      expect(operation.parameters[1].name).toBe('user_id');
      expect(operation.parameters[2].name).toBe('item_id');
    });

    it('should handle mixed parameter types', () => {
      const endpoint = {
        name: 'TestMixedParams',
        url: '/test/:id',
        type: 'post',
        parameter: {
          fields: {
            Parameter: [
              { field: 'query_param', type: 'String', optional: false },
              { field: 'optional_param', type: 'Integer', optional: true }
            ]
          }
        },
        header: {
          fields: {
            Header: [
              { field: 'X-Custom-Header', type: 'String', optional: true }
            ]
          }
        }
      };

      converter.convertEndpoint(endpoint, openAPISpec);

      const operation = openAPISpec.paths['/test/{id}'].post;

      expect(operation.parameters).toHaveLength(4); // 1 path + 2 query + 1 header

      const pathParam = operation.parameters.find(p => p.name === 'id');
      const queryParam = operation.parameters.find(p => p.name === 'query_param');
      const optionalParam = operation.parameters.find(p => p.name === 'optional_param');
      const headerParam = operation.parameters.find(p => p.name === 'X-Custom-Header');

      expect(pathParam.in).toBe('path');
      expect(pathParam.required).toBe(true);

      expect(queryParam.in).toBe('query');
      expect(queryParam.required).toBe(true);

      expect(optionalParam.in).toBe('query');
      expect(optionalParam.required).toBe(false);

      expect(headerParam.in).toBe('header');
      expect(headerParam.required).toBe(false);
    });
  });

  describe('addParameters', () => {
    let operation;

    beforeEach(() => {
      operation = {
        parameters: []
      };
    });

    it('should add path parameters', () => {
      const endpoint = { url: '/services/:service_id/test/:id' };

      converter.addParameters(endpoint, operation, '/services/{service_id}/test/{id}');

      expect(operation.parameters).toHaveLength(2);
      expect(operation.parameters[0].name).toBe('service_id');
      expect(operation.parameters[0].in).toBe('path');
      expect(operation.parameters[1].name).toBe('id');
      expect(operation.parameters[1].in).toBe('path');
    });

    it('should add query parameters', () => {
      const endpoint = {
        url: '/test',
        parameter: {
          fields: {
            Parameter: [
              {
                type: 'String',
                optional: false,
                field: 'query_param',
                description: 'Test parameter'
              }
            ]
          }
        }
      };

      converter.addParameters(endpoint, operation, '/test');

      const queryParam = operation.parameters.find(p => p.name === 'query_param');
      expect(queryParam).toBeDefined();
      expect(queryParam.in).toBe('query');
      expect(queryParam.required).toBe(true);
      expect(queryParam.schema.type).toBe('string');
    });

    it('should add header parameters', () => {
      const endpoint = {
        url: '/test',
        header: {
          fields: {
            Header: [
              {
                type: 'String',
                optional: true,
                field: 'X-Custom-Header',
                description: 'Custom header'
              }
            ]
          }
        }
      };

      converter.addParameters(endpoint, operation, '/test');

      const headerParam = operation.parameters.find(p => p.name === 'X-Custom-Header');
      expect(headerParam).toBeDefined();
      expect(headerParam.in).toBe('header');
      expect(headerParam.required).toBe(false);
    });

    it('should handle empty parameter fields', () => {
      const endpoint = {
        url: '/test',
        parameter: {
          fields: {}
        }
      };

      converter.addParameters(endpoint, operation, '/test');

      expect(operation.parameters).toHaveLength(0);
    });

    it('should handle missing parameter fields', () => {
      const endpoint = {
        url: '/test',
        parameter: {}
      };

      converter.addParameters(endpoint, operation, '/test');

      expect(operation.parameters).toHaveLength(0);
    });
  });

  describe('addResponses', () => {
    let operation;

    beforeEach(() => {
      operation = {
        responses: {}
      };
    });

    it('should add default success response', () => {
      const endpoint = { url: '/test' };

      converter.addResponses(endpoint, operation);

      expect(operation.responses['200']).toBeDefined();
      expect(operation.responses['200'].description).toBe('Successful operation');
    });

    it('should add common error responses', () => {
      const endpoint = { url: '/test' };

      converter.addResponses(endpoint, operation);

      expect(operation.responses['401']).toBeDefined();
      expect(operation.responses['403']).toBeDefined();
      expect(operation.responses['404']).toBeDefined();
      expect(operation.responses['500']).toBeDefined();
    });

    it('should add error response for endpoints with error fields', () => {
      const endpoint = {
        url: '/test',
        error: {
          fields: {
            'Error 4xx': [
              {
                field: '400',
                description: 'Bad request'
              }
            ]
          }
        }
      };

      converter.addResponses(endpoint, operation);

      expect(operation.responses['400']).toBeDefined();
      expect(operation.responses['400'].description).toBe('Bad Request');
    });

    it('should override default success response with custom fields', () => {
      const endpoint = {
        url: '/test',
        success: {
          fields: {
            'Success 200': [
              {
                field: 'data',
                type: 'Object',
                description: 'Response data'
              }
            ]
          }
        }
      };

      converter.addResponses(endpoint, operation);

      expect(operation.responses['200']).toBeDefined();
      expect(operation.responses['200'].content['application/json'].schema.properties.data).toBeDefined();
    });
  });

  describe('saveAsJSON', () => {
    it('should save data to JSON file', async () => {
      const testData = { test: 'data' };

      await converter.saveAsJSON(testData, 'test.json');

      expect(fs.mkdir).toHaveBeenCalledWith('./output', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('./output', 'test.json'),
        JSON.stringify(testData, null, 2)
      );
    });

    it('should use default filename if not provided', async () => {
      const testData = { test: 'data' };

      await converter.saveAsJSON(testData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('./output', 'nitrado-api.json'),
        JSON.stringify(testData, null, 2)
      );
    });

    it('should handle filesystem errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(converter.saveAsJSON({})).rejects.toThrow('Permission denied');
    });

    it('should handle write errors', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(converter.saveAsJSON({})).rejects.toThrow('Disk full');
    });
  });

  describe('integration tests', () => {
    it('should handle a complete conversion workflow', async () => {
      // Mock the API call
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, sampleRawApiResponse);

      // Run the complete workflow
      await converter.fetchAPIData();
      const openAPISpec = converter.convertToOpenAPI();

      // Verify the results
      expect(openAPISpec.openapi).toBe('3.1.1');
      expect(Object.keys(openAPISpec.paths)).toHaveLength(3);

      // Check that all operations have unique IDs
      const operationIds = new Set();
      for (const path of Object.values(openAPISpec.paths)) {
        for (const operation of Object.values(path)) {
          if (operation.operationId) {
            expect(operationIds.has(operation.operationId)).toBe(false);
            operationIds.add(operation.operationId);
          }
        }
      }
    });

    it('should handle run method workflow', async () => {
      // Mock the API call
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .reply(200, sampleRawApiResponse);

      // Mock file system operations
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      // Run the complete workflow
      await converter.run();

      // Verify file operations were called
      expect(fs.mkdir).toHaveBeenCalledWith('./output', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // Once for API data, once for OpenAPI
    });

    it('should handle network failures gracefully', async () => {
      // Mock network failure
      nock('https://doc.nitrado.net')
        .get('/api_data.js?v=1752345280167')
        .replyWithError('Network error');

      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await converter.run();

      // Verify error handling
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle endpoint with no group', () => {
      const endpoint = {
        name: 'TestEndpoint',
        url: '/test',
        type: 'get'
      };

      const openAPISpec = {
        openapi: '3.1.1',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      converter.convertEndpoint(endpoint, openAPISpec);

      const operation = openAPISpec.paths['/test'].get;
      expect(operation.tags).toEqual(['Default']);
    });

    it('should handle endpoint with no title or name', () => {
      const endpoint = {
        url: '/test',
        type: 'post'
      };

      const openAPISpec = {
        openapi: '3.1.1',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      converter.convertEndpoint(endpoint, openAPISpec);

      const operation = openAPISpec.paths['/test'].post;
      expect(operation.summary).toBe('POST /test');
    });

    it('should handle endpoint with complex path parameters', () => {
      const endpoint = {
        name: 'ComplexPath',
        url: '/services/:service_id/users/:user_id/items/:item_id',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('ItemsItemIdComplexPath');
    });

    it('should handle very long operation IDs', () => {
      const endpoint = {
        name: 'VeryLongOperationNameThatExceedsNormalLengthExpectations',
        url: '/very/long/path/with/many/segments',
        type: 'get'
      };

      const result = converter.generateOperationId(endpoint);
      expect(result).toBe('ManySegmentsVeryLongOperationNameThatExceedsNormalLengthExpectations');
    });
  });
});
