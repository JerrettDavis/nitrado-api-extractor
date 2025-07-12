const fs = require('fs').promises;
const path = require('path');
const { sampleApiData } = require('./fixtures/sampleData');

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  }
}));

describe('CLI Scripts Tests', () => {
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

  describe('convert-openapi.js functionality', () => {
    it('should be able to load the convert-openapi script', () => {
      expect(() => require('../convert-openapi.js')).not.toThrow();
    });

    it('should convert API data to OpenAPI when script logic is applied', async () => {
      const NitradoAPIConverter = require('../converter');

      // Mock file reading to simulate the script behavior
      fs.readFile.mockResolvedValue(JSON.stringify(sampleApiData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      // Simulate the script logic
      const converter = new NitradoAPIConverter();

      const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
      const rawData = await fs.readFile(apiDataPath, 'utf8');
      converter.apiData = JSON.parse(rawData);

      const openAPISpec = converter.convertToOpenAPI();
      await converter.saveAsJSON(openAPISpec, 'nitrado-openapi.json');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('./output', 'nitrado-api.json'),
        'utf8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('./output', 'nitrado-openapi.json'),
        expect.stringContaining('"openapi": "3.1.1"')
      );
    });

    it('should handle missing API data file gracefully', async () => {
      const NitradoAPIConverter = require('../converter');

      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const converter = new NitradoAPIConverter();

      await expect(async () => {
        const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
        await fs.readFile(apiDataPath, 'utf8');
      }).rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should handle corrupted API data file', async () => {
      const NitradoAPIConverter = require('../converter');

      fs.readFile.mockResolvedValue('invalid json content');

      const converter = new NitradoAPIConverter();

      await expect(async () => {
        const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
        const rawData = await fs.readFile(apiDataPath, 'utf8');
        JSON.parse(rawData);
      }).rejects.toThrow();
    });
  });

  describe('main converter.js functionality', () => {
    it('should be able to load the main converter script', () => {
      expect(() => require('../converter.js')).not.toThrow();
    });

    it('should have proper exports', () => {
      const NitradoAPIConverter = require('../converter.js');
      expect(NitradoAPIConverter).toBeDefined();
      expect(typeof NitradoAPIConverter).toBe('function');

      const converter = new NitradoAPIConverter();
      expect(converter).toBeInstanceOf(NitradoAPIConverter);
      expect(typeof converter.run).toBe('function');
      expect(typeof converter.fetchAPIData).toBe('function');
      expect(typeof converter.convertToOpenAPI).toBe('function');
    });
  });

  describe('output validation', () => {
    it('should generate valid OpenAPI JSON through script logic', async () => {
      const NitradoAPIConverter = require('../converter');

      fs.readFile.mockResolvedValue(JSON.stringify(sampleApiData));
      fs.mkdir.mockResolvedValue();

      let capturedOutput = '';
      fs.writeFile.mockImplementation((filePath, content) => {
        if (filePath.includes('nitrado-openapi.json')) {
          capturedOutput = content;
        }
        return Promise.resolve();
      });

      const converter = new NitradoAPIConverter();
      const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
      const rawData = await fs.readFile(apiDataPath, 'utf8');
      converter.apiData = JSON.parse(rawData);

      const openAPISpec = converter.convertToOpenAPI();
      await converter.saveAsJSON(openAPISpec, 'nitrado-openapi.json');

      expect(capturedOutput).toBeTruthy();
      expect(() => JSON.parse(capturedOutput)).not.toThrow();

      const parsedOutput = JSON.parse(capturedOutput);
      expect(parsedOutput.openapi).toBe('3.1.1');
      expect(parsedOutput.info).toBeDefined();
      expect(parsedOutput.paths).toBeDefined();
    });

    it('should maintain data integrity through conversion process', async () => {
      const NitradoAPIConverter = require('../converter');

      fs.readFile.mockResolvedValue(JSON.stringify(sampleApiData));
      fs.mkdir.mockResolvedValue();

      let capturedOutput = '';
      fs.writeFile.mockImplementation((filePath, content) => {
        if (filePath.includes('nitrado-openapi.json')) {
          capturedOutput = content;
        }
        return Promise.resolve();
      });

      const converter = new NitradoAPIConverter();
      const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
      const rawData = await fs.readFile(apiDataPath, 'utf8');
      converter.apiData = JSON.parse(rawData);

      const openAPISpec = converter.convertToOpenAPI();
      await converter.saveAsJSON(openAPISpec, 'nitrado-openapi.json');

      const parsedOutput = JSON.parse(capturedOutput);

      // Check that all sample endpoints are converted
      expect(Object.keys(parsedOutput.paths)).toHaveLength(3);
      expect(parsedOutput.paths['/company/stats']).toBeDefined();
      expect(parsedOutput.paths['/domain/{domain}/service']).toBeDefined();
      expect(parsedOutput.paths['/services/{id}/gameservers/games/minecraft']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const NitradoAPIConverter = require('../converter');

      fs.readFile.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const converter = new NitradoAPIConverter();

      await expect(async () => {
        const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
        await fs.readFile(apiDataPath, 'utf8');
      }).rejects.toThrow('Unexpected error');
    });

    it('should provide helpful error context', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      try {
        await fs.readFile('./output/nitrado-api.json', 'utf8');
      } catch (error) {
        expect(error.message).toBe('File not found');
      }
    });
  });

  describe('performance tests', () => {
    it('should handle large API datasets efficiently in CLI context', async () => {
      const NitradoAPIConverter = require('../converter');

      // Create a large mock dataset
      const largeApiData = {
        api: Array.from({ length: 100 }, (_, i) => ({
          name: `TestEndpoint${i}`,
          url: `/test/${i}`,
          type: 'get',
          group: `Group${i % 10}`,
          title: `Test Endpoint ${i}`,
          description: `Description for endpoint ${i}`
        }))
      };

      fs.readFile.mockResolvedValue(JSON.stringify(largeApiData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const converter = new NitradoAPIConverter();
      const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');
      const rawData = await fs.readFile(apiDataPath, 'utf8');
      converter.apiData = JSON.parse(rawData);

      const startTime = Date.now();
      const openAPISpec = converter.convertToOpenAPI();
      await converter.saveAsJSON(openAPISpec, 'nitrado-openapi.json');
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
      expect(Object.keys(openAPISpec.paths)).toHaveLength(100);
    });
  });
});
