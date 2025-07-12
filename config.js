const { program } = require('commander');
require('dotenv').config();

/**
 * Configuration utility for Nitrado API Extractor
 * Handles environment variables and command line arguments
 */
class Config {
  constructor() {
    this.setupCommandLine();
  }

  setupCommandLine() {
    program
      .name('nitrado-api-extractor')
      .description('Extract and convert Nitrado API documentation to OpenAPI 3.1.1')
      .version('1.0.0')
      .option('--api-url <url>', 'Nitrado API data URL', process.env.NITRADO_API_URL)
      .option('--output-dir <dir>', 'Output directory for generated files', process.env.NITRADO_OUTPUT_DIR || './output')
      .option('--server-url <url>', 'API server URL for OpenAPI spec', process.env.NITRADO_SERVER_URL || 'https://api.nitrado.net')
      .option('--api-title <title>', 'API title for OpenAPI spec', process.env.NITRADO_API_TITLE || 'Nitrado API')
      .option('--api-description <description>', 'API description for OpenAPI spec', process.env.NITRADO_API_DESCRIPTION)
      .option('--api-version <version>', 'API version for OpenAPI spec', process.env.NITRADO_API_VERSION || '1.0.0')
      .option('--contact-name <name>', 'Contact name for OpenAPI spec', process.env.NITRADO_CONTACT_NAME || 'Nitrado Support')
      .option('--contact-url <url>', 'Contact URL for OpenAPI spec', process.env.NITRADO_CONTACT_URL || 'https://nitrado.net/support')
      .option('--license-url <url>', 'License URL for OpenAPI spec', process.env.NITRADO_LICENSE_URL || 'https://nitrado.net/terms')
      .option('--verbose', 'Enable verbose logging', false)
      .option('--dry-run', 'Run without making actual API calls or writing files', false);
  }

  getConfig() {
    program.parse();
    const options = program.opts();

    const config = {
      apiDataUrl: options.apiUrl || process.env.NITRADO_API_URL,
      outputDir: options.outputDir || process.env.NITRADO_OUTPUT_DIR || './output',
      serverUrl: options.serverUrl || process.env.NITRADO_SERVER_URL || 'https://api.nitrado.net',
      apiTitle: options.apiTitle || process.env.NITRADO_API_TITLE || 'Nitrado API',
      apiDescription: options.apiDescription || process.env.NITRADO_API_DESCRIPTION || 'Official Nitrado API for managing game servers, domains, and other services',
      apiVersion: options.apiVersion || process.env.NITRADO_API_VERSION || '1.0.0',
      contactName: options.contactName || process.env.NITRADO_CONTACT_NAME || 'Nitrado Support',
      contactUrl: options.contactUrl || process.env.NITRADO_CONTACT_URL || 'https://nitrado.net/support',
      licenseUrl: options.licenseUrl || process.env.NITRADO_LICENSE_URL || 'https://nitrado.net/terms',
      verbose: options.verbose || process.env.NITRADO_VERBOSE === 'true',
      dryRun: options.dryRun || process.env.NITRADO_DRY_RUN === 'true'
    };

    // Validate required fields
    if (!config.apiDataUrl) {
      console.error('❌ API URL is required. Set NITRADO_API_URL environment variable or use --api-url flag.');
      process.exit(1);
    }

    return config;
  }

  static getConfigWithDefaults(overrides = {}) {
    const config = new Config();
    const baseConfig = config.getConfig();
    return { ...baseConfig, ...overrides };
  }
}

module.exports = Config;
