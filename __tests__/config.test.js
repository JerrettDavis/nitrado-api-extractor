const Config = require('../config');

// Mock commander and dotenv
jest.mock('commander', () => ({
  program: {
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnThis(),
    opts: jest.fn().mockReturnValue({})
  }
}));

jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Config', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return default configuration when no environment variables are set', () => {
      // Set a valid API URL since it's now required
      process.env.NITRADO_API_URL = 'https://doc.nitrado.net/api_data.js?v=1752345280167';
      
      const config = new Config();
      const result = config.getConfig();

      expect(result.apiDataUrl).toBe('https://doc.nitrado.net/api_data.js?v=1752345280167');
      expect(result.outputDir).toBe('./output');
      expect(result.serverUrl).toBe('https://api.nitrado.net');
      expect(result.apiTitle).toBe('Nitrado API');
      expect(result.apiVersion).toBe('1.0.0');
      expect(result.verbose).toBe(false);
      expect(result.dryRun).toBe(false);
    });

    it('should use environment variables when set', () => {
      process.env.NITRADO_API_URL = 'https://env.api.url';
      process.env.NITRADO_OUTPUT_DIR = './env-output';
      process.env.NITRADO_SERVER_URL = 'https://env.server.url';
      process.env.NITRADO_API_TITLE = 'Env API';
      process.env.NITRADO_API_VERSION = '2.0.0';
      process.env.NITRADO_VERBOSE = 'true';
      process.env.NITRADO_DRY_RUN = 'true';

      const config = new Config();
      const result = config.getConfig();

      expect(result.apiDataUrl).toBe('https://env.api.url');
      expect(result.outputDir).toBe('./env-output');
      expect(result.serverUrl).toBe('https://env.server.url');
      expect(result.apiTitle).toBe('Env API');
      expect(result.apiVersion).toBe('2.0.0');
      expect(result.verbose).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should include all configuration fields', () => {
      const config = new Config();
      const result = config.getConfig();

      expect(result).toHaveProperty('apiDataUrl');
      expect(result).toHaveProperty('outputDir');
      expect(result).toHaveProperty('serverUrl');
      expect(result).toHaveProperty('apiTitle');
      expect(result).toHaveProperty('apiDescription');
      expect(result).toHaveProperty('apiVersion');
      expect(result).toHaveProperty('contactName');
      expect(result).toHaveProperty('contactUrl');
      expect(result).toHaveProperty('licenseUrl');
      expect(result).toHaveProperty('verbose');
      expect(result).toHaveProperty('dryRun');
    });

    it('should exit with error when apiDataUrl is not provided', () => {
      // Mock console.error and process.exit
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      // Mock commander to return empty options and no environment variables
      const { program } = require('commander');
      program.opts.mockReturnValue({});
      
      // Clear the environment variable
      delete process.env.NITRADO_API_URL;

      const config = new Config();
      config.getConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ API URL is required. Set NITRADO_API_URL environment variable or use --api-url flag.');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      // Restore original functions
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when apiDataUrl is empty string', () => {
      // Mock console.error and process.exit
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      // Mock commander to return empty apiUrl option
      const { program } = require('commander');
      program.opts.mockReturnValue({ apiUrl: '' });
      
      // Set environment variable to empty string
      process.env.NITRADO_API_URL = '';

      const config = new Config();
      config.getConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ API URL is required. Set NITRADO_API_URL environment variable or use --api-url flag.');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      // Restore original functions
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('getConfigWithDefaults', () => {
    it('should return merged configuration with overrides', () => {
      // Set a valid API URL since it's now required
      process.env.NITRADO_API_URL = 'https://test.api.url';
      
      const overrides = {
        apiTitle: 'Override API',
        apiVersion: '3.0.0'
      };

      const result = Config.getConfigWithDefaults(overrides);

      expect(result.apiTitle).toBe('Override API');
      expect(result.apiVersion).toBe('3.0.0');
      expect(result.outputDir).toBe('./output'); // Should keep default
    });

    it('should work with empty overrides', () => {
      // Set a valid API URL since it's now required
      process.env.NITRADO_API_URL = 'https://test.api.url';
      
      const result = Config.getConfigWithDefaults({});

      expect(result.apiTitle).toBe('Nitrado API');
      expect(result.apiVersion).toBe('1.0.0');
    });
  });
});
