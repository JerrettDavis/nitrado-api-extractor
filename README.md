# Nitrado API Extractor & OpenAPI Converter

A clean, focused tool to extract API documentation data from the Nitrado API documentation endpoint and convert it to OpenAPI 3.1.1 specification.

## What it does

This tool fetches the API data from Nitrado's API documentation endpoint and:

1. Strips the `define()` wrapper
2. Parses the JSON content 
3. Saves the clean API data to `output/nitrado-api.json`
4. Converts the API data to OpenAPI 3.1.1 specification
5. Saves the OpenAPI spec to `output/nitrado-openapi.json`

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration (optional)
cp .env.example .env
```

## Usage

### Basic Usage

```bash
# Run the full extraction and OpenAPI conversion
npm start

# Or run just the OpenAPI conversion (if you already have the raw data)
npm run convert

# Validate the generated OpenAPI specification
npm run validate
```

### Command Line Options

```bash
# Show help
npm run help

# Use custom API URL
node converter.js --api-url https://custom.api.url/api_data.js

# Use custom output directory
node converter.js --output-dir ./custom-output

# Enable verbose logging
node converter.js --verbose

# Dry run (no files written)
node converter.js --dry-run
```

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Required: URL to fetch Nitrado API data
NITRADO_API_URL=https://doc.nitrado.net/api_data.js?v=1752345280167

# Optional: Output directory for generated files
NITRADO_OUTPUT_DIR=./output

# Optional: API server URL for OpenAPI specification
NITRADO_SERVER_URL=https://api.nitrado.net

# Optional: API metadata for OpenAPI specification
NITRADO_API_TITLE=Nitrado API
NITRADO_API_DESCRIPTION=Official Nitrado API for managing game servers, domains, and other services
NITRADO_API_VERSION=1.0.0

# Optional: Contact information for OpenAPI specification
NITRADO_CONTACT_NAME=Nitrado Support
NITRADO_CONTACT_URL=https://nitrado.net/support

# Optional: License information for OpenAPI specification
NITRADO_LICENSE_URL=https://nitrado.net/terms

# Optional: Enable verbose logging
NITRADO_VERBOSE=false

# Optional: Enable dry run mode (no files written)
NITRADO_DRY_RUN=false
```

## Scripts

- `npm start` - Full extraction and OpenAPI conversion
- `npm run extract` - Same as start  
- `npm run convert` - Convert existing API data to OpenAPI only
- `npm run validate` - Validate the generated OpenAPI specification
- `npm run test` - Run the test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run help` - Show command line help

## CI/CD Integration

This tool is designed for automated CI/CD pipelines:

### GitHub Actions

Two workflows are included:

1. **`.github/workflows/ci.yml`** - Runs tests on pushes and PRs
2. **`.github/workflows/extract-and-publish.yml`** - Extracts API data and publishes updates

### Configuration for CI/CD

Set the following secrets in your GitHub repository:

- `NITRADO_API_URL` - Custom API URL (optional)
- `NITRADO_API_TITLE` - Custom API title (optional)
- `NITRADO_API_VERSION` - Custom API version (optional)
- Other environment variables as needed

### Scheduled Updates

The extract-and-publish workflow runs every 6 hours to check for API updates and automatically commits changes when detected.

## Output

The tool extracts all API endpoints and saves them to two files:

### `output/nitrado-api.json`
Raw API data with the structure:

```json
{
  "api": [
    {
      "type": "get",
      "url": "/company/stats", 
      "title": "Get company stats",
      "name": "GetStats",
      "group": "Company",
      "version": "1.0.0",
      "success": { ... },
      "filename": "...",
      "groupTitle": "..."
    }
  ]
}
```

### `output/nitrado-openapi.json`
Complete OpenAPI 3.1.1 specification with:
- All API endpoints mapped to OpenAPI paths
- Proper parameter handling (path, query, header)
- Request/response schemas
- Authentication schemes
- Organized by tags/groups

