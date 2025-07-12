const { sampleOpenApiSpec } = require('./fixtures/sampleData');

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock the validate-openapi script by extracting its logic
const validateOperationIds = (openApiData) => {
  const operationIds = new Set();
  const duplicates = [];

  for (const [pathName, pathMethods] of Object.entries(openApiData.paths)) {
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

  return {
    totalOperations: operationIds.size,
    totalPaths: Object.keys(openApiData.paths).length,
    duplicates,
    operationIds: Array.from(operationIds)
  };
};

describe('OpenAPI Validation', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('validateOperationIds function', () => {
    it('should validate unique operation IDs', () => {
      const result = validateOperationIds(sampleOpenApiSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(1);
      expect(result.totalPaths).toBe(1);
      expect(result.operationIds).toContain('testOperation');
    });

    it('should detect duplicate operation IDs', () => {
      const duplicateSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 'duplicateId',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            post: {
              operationId: 'duplicateId',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(duplicateSpec);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].operationId).toBe('duplicateId');
      expect(result.duplicates[0].path).toBe('/test2');
      expect(result.duplicates[0].method).toBe('POST');
    });

    it('should handle missing operation IDs', () => {
      const incompleteSpec = {
        paths: {
          '/test': {
            get: {
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(incompleteSpec);

      expect(result.totalOperations).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle empty paths', () => {
      const emptySpec = {
        paths: {}
      };

      const result = validateOperationIds(emptySpec);

      expect(result.totalOperations).toBe(0);
      expect(result.totalPaths).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should calculate correct statistics', () => {
      const complexSpec = {
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: { '200': { description: 'Success' } }
            },
            post: {
              operationId: 'createUser',
              responses: { '201': { description: 'Created' } }
            }
          },
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              responses: { '200': { description: 'Success' } }
            },
            put: {
              operationId: 'updateUser',
              responses: { '200': { description: 'Updated' } }
            },
            delete: {
              operationId: 'deleteUser',
              responses: { '204': { description: 'Deleted' } }
            }
          }
        }
      };

      const result = validateOperationIds(complexSpec);

      expect(result.totalOperations).toBe(5);
      expect(result.totalPaths).toBe(2);
      expect(result.duplicates).toHaveLength(0);
      expect(result.operationIds).toContain('getUsers');
      expect(result.operationIds).toContain('createUser');
      expect(result.operationIds).toContain('getUser');
      expect(result.operationIds).toContain('updateUser');
      expect(result.operationIds).toContain('deleteUser');
    });

    it('should handle multiple duplicates', () => {
      const multiDuplicateSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 'duplicate1',
              responses: { '200': { description: 'Success' } }
            },
            post: {
              operationId: 'duplicate2',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            get: {
              operationId: 'duplicate1',
              responses: { '200': { description: 'Success' } }
            },
            post: {
              operationId: 'duplicate2',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(multiDuplicateSpec);

      expect(result.duplicates).toHaveLength(2);
      expect(result.duplicates.map(d => d.operationId)).toEqual(
        expect.arrayContaining(['duplicate1', 'duplicate2'])
      );
    });

    it('should handle mixed valid and invalid operations', () => {
      const mixedSpec = {
        paths: {
          '/valid1': {
            get: {
              operationId: 'validOperation1',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/valid2': {
            get: {
              operationId: 'validOperation2',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/invalid': {
            get: {
              operationId: 'validOperation1', // Duplicate
              responses: { '200': { description: 'Success' } }
            }
          },
          '/no-operation-id': {
            get: {
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(mixedSpec);

      expect(result.totalOperations).toBe(2); // Only unique operations
      expect(result.totalPaths).toBe(4);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].operationId).toBe('validOperation1');
    });

    it('should handle case sensitivity in operation IDs', () => {
      const caseSensitiveSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 'TestOperation',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            get: {
              operationId: 'testOperation',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(caseSensitiveSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(2);
    });

    it('should handle different HTTP methods on same path', () => {
      const methodSpec = {
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: { '200': { description: 'Success' } }
            },
            post: {
              operationId: 'postTest',
              responses: { '201': { description: 'Created' } }
            },
            put: {
              operationId: 'putTest',
              responses: { '200': { description: 'Updated' } }
            },
            delete: {
              operationId: 'deleteTest',
              responses: { '204': { description: 'Deleted' } }
            },
            patch: {
              operationId: 'patchTest',
              responses: { '200': { description: 'Patched' } }
            }
          }
        }
      };

      const result = validateOperationIds(methodSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(5);
      expect(result.totalPaths).toBe(1);
    });

    it('should handle nested path parameters', () => {
      const nestedSpec = {
        paths: {
          '/users/{userId}/posts/{postId}/comments/{commentId}': {
            get: {
              operationId: 'getComment',
              responses: { '200': { description: 'Success' } }
            },
            put: {
              operationId: 'updateComment',
              responses: { '200': { description: 'Updated' } }
            }
          }
        }
      };

      const result = validateOperationIds(nestedSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(2);
      expect(result.totalPaths).toBe(1);
    });
  });

  describe('OpenAPI specification validation', () => {
    it('should validate required OpenAPI fields', () => {
      const minimalSpec = {
        openapi: '3.1.1',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {}
      };

      const result = validateOperationIds(minimalSpec);

      expect(result.totalOperations).toBe(0);
      expect(result.totalPaths).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle real Nitrado API structure', () => {
      const nitradoLikeSpec = {
        openapi: '3.1.1',
        info: {
          title: 'Nitrado API',
          version: '1.0.0'
        },
        paths: {
          '/company/stats': {
            get: {
              operationId: 'CompanyStatsGet',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/domain/{domain}/service': {
            put: {
              operationId: 'DomainServicePut',
              responses: { '200': { description: 'Success' } }
            },
            delete: {
              operationId: 'DomainServiceDelete',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/services/{id}/gameservers/games/minecraft': {
            get: {
              operationId: 'MinecraftGameserverDetails',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(nitradoLikeSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(4);
      expect(result.totalPaths).toBe(3);
    });

    it('should handle OpenAPI with no paths object', () => {
      const noPathsSpec = {
        openapi: '3.1.1',
        info: {
          title: 'Test API',
          version: '1.0.0'
        }
      };

      expect(() => validateOperationIds(noPathsSpec)).toThrow();
    });

    it('should handle malformed path objects', () => {
      const malformedSpec = {
        paths: {
          '/test': 'not an object'
        }
      };

      // This should not throw since we're just iterating over object entries
      const result = validateOperationIds(malformedSpec);
      expect(result.totalOperations).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle null operation IDs', () => {
      const nullIdSpec = {
        paths: {
          '/test': {
            get: {
              operationId: null,
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(nullIdSpec);

      expect(result.totalOperations).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle empty string operation IDs', () => {
      const emptyIdSpec = {
        paths: {
          '/test': {
            get: {
              operationId: '',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(emptyIdSpec);

      expect(result.totalOperations).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle numeric operation IDs', () => {
      const numericIdSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 123,
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            get: {
              operationId: 123, // Same numeric ID
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(numericIdSpec);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].operationId).toBe(123);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large number of operations efficiently', () => {
      const largeSpec = {
        paths: {}
      };

      // Generate 1000 unique operations
      for (let i = 0; i < 1000; i++) {
        largeSpec.paths[`/endpoint${i}`] = {
          get: {
            operationId: `operation${i}`,
            responses: { '200': { description: 'Success' } }
          }
        };
      }

      const startTime = Date.now();
      const result = validateOperationIds(largeSpec);
      const endTime = Date.now();

      expect(result.totalOperations).toBe(1000);
      expect(result.duplicates).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle special characters in operation IDs', () => {
      const specialCharSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 'operation-with-dashes',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            get: {
              operationId: 'operation_with_underscores',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test3': {
            get: {
              operationId: 'operationWithCamelCase',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(specialCharSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(3);
    });

    it('should handle Unicode characters in operation IDs', () => {
      const unicodeSpec = {
        paths: {
          '/test1': {
            get: {
              operationId: 'operationWithUnicode微服务',
              responses: { '200': { description: 'Success' } }
            }
          },
          '/test2': {
            get: {
              operationId: 'operationWithEmoji🚀',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(unicodeSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(2);
    });

    it('should handle deeply nested path structures', () => {
      const deepSpec = {
        paths: {
          '/level1/level2/level3/level4/level5': {
            get: {
              operationId: 'deepOperation',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const result = validateOperationIds(deepSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(1);
    });

    it('should handle operations with complex response structures', () => {
      const complexSpec = {
        paths: {
          '/test': {
            get: {
              operationId: 'complexOperation',
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '400': { description: 'Bad Request' },
                '401': { description: 'Unauthorized' },
                '403': { description: 'Forbidden' },
                '404': { description: 'Not Found' },
                '500': { description: 'Internal Server Error' }
              }
            }
          }
        }
      };

      const result = validateOperationIds(complexSpec);

      expect(result.duplicates).toHaveLength(0);
      expect(result.totalOperations).toBe(1);
    });
  });
});
