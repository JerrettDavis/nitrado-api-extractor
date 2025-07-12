#!/usr/bin/env node

const NitradoAPIConverter = require('./converter');
const Config = require('./config');

/**
 * Convert existing API data to OpenAPI format
 */
async function convertOnly() {
  const config = new Config().getConfig();
  const converter = new NitradoAPIConverter(config);

  try {
    // Try to load existing API data
    const fs = require('fs').promises;
    const path = require('path');

    const apiDataPath = path.join(converter.outputDir, 'nitrado-api.json');

    if (config.verbose) {
      console.log(`📂 Loading API data from: ${apiDataPath}`);
    }

    const rawData = await fs.readFile(apiDataPath, 'utf8');
    converter.apiData = JSON.parse(rawData);

    console.log('📂 Loaded existing API data');
    console.log('🔄 Converting to OpenAPI 3.1.1 specification...');

    if (config.dryRun) {
      console.log('🧪 Dry run mode - no files will be written');
      const openAPISpec = converter.convertToOpenAPI();
      console.log('✅ OpenAPI conversion completed (dry run)!');
      console.log(`📊 Generated OpenAPI spec with ${Object.keys(openAPISpec.paths).length} paths`);
      return;
    }

    // Convert to OpenAPI
    const openAPISpec = converter.convertToOpenAPI();
    await converter.saveAsJSON(openAPISpec, 'nitrado-openapi.json');

    console.log('✅ OpenAPI conversion completed!');
    console.log(`📊 Generated OpenAPI spec with ${Object.keys(openAPISpec.paths).length} paths`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (config.verbose) {
      console.error('Stack trace:', error.stack);
    }
    console.log('💡 Run the full converter first: npm run extract');
    process.exit(1);
  }
}

convertOnly();
