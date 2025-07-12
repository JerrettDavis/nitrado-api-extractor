// Jest setup file for Nitrado API Extractor tests

// Mock console to reduce noise in tests unless explicitly testing console output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Global test configuration
process.env.NODE_ENV = 'test';

// Set up global timeout for long-running tests
jest.setTimeout(30000);

// Mock console methods by default
global.mockConsole = () => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
};

global.restoreConsole = () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
};

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Restore process.exit after tests
afterAll(() => {
  process.exit = originalExit;
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Custom matchers for OpenAPI validation
expect.extend({
  toBeValidOpenAPISpec(received) {
    if (typeof received !== 'object' || received === null) {
      return {
        message: () => `Expected value to be a valid OpenAPI specification object, but received ${typeof received}`,
        pass: false
      };
    }

    const requiredFields = ['openapi', 'info', 'paths'];
    const missingFields = requiredFields.filter(field => !(field in received));

    if (missingFields.length > 0) {
      return {
        message: () => `Expected OpenAPI spec to have required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    if (typeof received.openapi !== 'string' || !received.openapi.startsWith('3.')) {
      return {
        message: () => `Expected OpenAPI version to be 3.x, but received ${received.openapi}`,
        pass: false
      };
    }

    if (typeof received.info !== 'object' || !received.info.title || !received.info.version) {
      return {
        message: () => `Expected info object to have title and version fields`,
        pass: false
      };
    }

    if (typeof received.paths !== 'object') {
      return {
        message: () => `Expected paths to be an object, but received ${typeof received.paths}`,
        pass: false
      };
    }

    return {
      message: () => `Expected value not to be a valid OpenAPI specification`,
      pass: true
    };
  },

  toHaveUniqueOperationIds(received) {
    if (typeof received !== 'object' || received === null || typeof received.paths !== 'object') {
      return {
        message: () => `Expected value to be a valid OpenAPI specification with paths`,
        pass: false
      };
    }

    const operationIds = new Set();
    const duplicates = [];

    for (const [pathName, pathMethods] of Object.entries(received.paths)) {
      for (const [method, operation] of Object.entries(pathMethods)) {
        if (operation.operationId) {
          if (operationIds.has(operation.operationId)) {
            duplicates.push({
              operationId: operation.operationId,
              path: pathName,
              method: method.toUpperCase()
            });
          } else {
            operationIds.add(operation.operationId);
          }
        }
      }
    }

    if (duplicates.length > 0) {
      return {
        message: () => `Found duplicate operation IDs: ${duplicates.map(d => `${d.operationId} (${d.method} ${d.path})`).join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => `Expected to find duplicate operation IDs but all were unique`,
      pass: true
    };
  },

  toHaveValidParameterTypes(received) {
    if (typeof received !== 'object' || received === null || !Array.isArray(received.parameters)) {
      return {
        message: () => `Expected value to have a parameters array`,
        pass: false
      };
    }

    const validTypes = ['string', 'integer', 'number', 'boolean', 'array', 'object'];
    const invalidParams = received.parameters.filter(param => {
      return !param.schema || !validTypes.includes(param.schema.type);
    });

    if (invalidParams.length > 0) {
      return {
        message: () => `Found parameters with invalid types: ${invalidParams.map(p => p.name).join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => `Expected to find parameters with invalid types but all were valid`,
      pass: true
    };
  },

  toHaveValidResponseStructure(received) {
    if (typeof received !== 'object' || received === null || typeof received.responses !== 'object') {
      return {
        message: () => `Expected value to have a responses object`,
        pass: false
      };
    }

    const requiredResponses = ['200'];
    const missingResponses = requiredResponses.filter(code => !(code in received.responses));

    if (missingResponses.length > 0) {
      return {
        message: () => `Expected responses to include required status codes: ${missingResponses.join(', ')}`,
        pass: false
      };
    }

    const invalidResponses = Object.entries(received.responses).filter(([_code, response]) => {
      return !response.description || (response.content && typeof response.content !== 'object');
    });

    if (invalidResponses.length > 0) {
      return {
        message: () => `Found responses with invalid structure: ${invalidResponses.map(([code]) => code).join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => `Expected to find responses with invalid structure but all were valid`,
      pass: true
    };
  }
});

// Utility functions for tests
global.createMockApiData = (overrides = {}) => {
  return {
    api: [
      {
        type: 'get',
        url: '/test',
        title: 'Test Endpoint',
        name: 'TestEndpoint',
        group: 'Test',
        version: '1.0.0',
        ...overrides
      }
    ]
  };
};

global.createMockOpenAPISpec = (overrides = {}) => {
  return {
    openapi: '3.1.1',
    info: {
      title: 'Test API',
      version: '1.0.0'
    },
    paths: {},
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    },
    ...overrides
  };
};

global.createMockEndpoint = (overrides = {}) => {
  return {
    type: 'get',
    url: '/test',
    title: 'Test Endpoint',
    name: 'TestEndpoint',
    group: 'Test',
    version: '1.0.0',
    ...overrides
  };
};

// Helper to create large test datasets
global.createLargeApiData = (count = 100) => {
  const api = [];
  for (let i = 0; i < count; i++) {
    api.push({
      type: i % 4 === 0 ? 'get' : i % 4 === 1 ? 'post' : i % 4 === 2 ? 'put' : 'delete',
      url: `/endpoint${i}`,
      title: `Test Endpoint ${i}`,
      name: `TestEndpoint${i}`,
      group: `Group${i % 10}`,
      version: '1.0.0',
      description: `Description for endpoint ${i}`,
      parameter: i % 3 === 0 ? {
        fields: {
          Parameter: [
            {
              field: `param${i}`,
              type: 'String',
              optional: false,
              description: `Parameter ${i}`
            }
          ]
        }
      } : undefined
    });
  }
  return { api };
};

// Helper to validate JSON structure
global.isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Helper to count operation IDs in OpenAPI spec
global.countOperationIds = (spec) => {
  let count = 0;
  for (const pathMethods of Object.values(spec.paths)) {
    for (const operation of Object.values(pathMethods)) {
      if (operation.operationId) {
        count++;
      }
    }
  }
  return count;
};

// Helper to find duplicate operation IDs
global.findDuplicateOperationIds = (spec) => {
  const operationIds = new Set();
  const duplicates = [];

  for (const [pathName, pathMethods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathMethods)) {
      if (operation.operationId) {
        if (operationIds.has(operation.operationId)) {
          duplicates.push({
            operationId: operation.operationId,
            path: pathName,
            method: method.toUpperCase()
          });
        } else {
          operationIds.add(operation.operationId);
        }
      }
    }
  }

  return duplicates;
};

// Performance timing utilities
global.timeFunction = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000; // Convert to milliseconds
  return { result, duration };
};

// Network mock helpers
global.mockNetworkSuccess = (url, response) => {
  const nock = require('nock');
  return nock(url.origin)
    .get(url.pathname + url.search)
    .reply(200, response);
};

global.mockNetworkError = (url, error) => {
  const nock = require('nock');
  return nock(url.origin)
    .get(url.pathname + url.search)
    .replyWithError(error);
};

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clear nock interceptors
  const nock = require('nock');
  nock.cleanAll();

  // Reset console
  global.restoreConsole();
});

// Cleanup after all tests
afterAll(() => {
  // Final cleanup
  jest.restoreAllMocks();
});
