// Sample API data for testing
const sampleApiData = {
  api: [
    {
      type: 'get',
      url: '/company/stats',
      title: 'Get company stats',
      name: 'GetStats',
      group: 'Company',
      version: '1.0.0',
      success: {
        examples: [
          {
            title: 'Success-Response',
            content: 'HTTP/1.1 200 OK\n{\n    "status": "success",\n    "data": {\n        "employee_count": 50\n    }\n}',
            type: 'json'
          }
        ]
      },
      filename: 'app/controllers/company_controller.rb',
      groupTitle: 'Company'
    },
    {
      type: 'post',
      url: '/domain/:domain/service',
      title: 'Add to Service',
      name: 'Add_to_Service',
      group: 'Domain',
      deprecated: {
        content: 'Feature no longer available'
      },
      description: '<p>Add a domain to a service (e.g. a Webspace).</p>',
      version: '1.0.0',
      parameter: {
        fields: {
          Parameter: [
            {
              group: 'Parameter',
              type: 'Integer',
              optional: false,
              field: 'service_id',
              description: '<p>the id of the service</p>'
            }
          ]
        }
      },
      success: {
        examples: [
          {
            title: 'Success-Response',
            content: 'HTTP/1.1 200 OK\n{\n   "status":"success",\n   "message": "Added domain to service."\n}',
            type: 'json'
          }
        ]
      },
      filename: 'app/controllers/domain_controller.rb',
      groupTitle: 'Domain',
      header: {
        fields: {
          Header: [
            {
              group: 'Header',
              type: 'String',
              optional: true,
              field: 'Authorization',
              defaultValue: 'Bearer NTFmNTQ5M2VjYjVkMzVkNWNkYjViYzIx........',
              description: '<p>Provide your access token here, alternatively you can pass it as GET Parameter.</p>'
            }
          ]
        }
      },
      error: {
        fields: {
          'Error 4xx': [
            {
              group: 'Error 4xx',
              optional: false,
              field: '401',
              description: '<p>The provided access token is not valid (anymore).</p>'
            }
          ]
        }
      }
    },
    {
      type: 'get',
      url: '/services/:id/gameservers/games/minecraft',
      title: 'Details',
      name: 'Details',
      group: 'Game_Minecraft',
      version: '1.0.0',
      success: {
        examples: [
          {
            title: 'Success-Response',
            content: 'HTTP/1.1 200 OK\n{\n    "status": "success",\n    "data": {\n        "server_details": "..."\n    }\n}',
            type: 'json'
          }
        ]
      },
      filename: 'app/controllers/minecraft_controller.rb',
      groupTitle: 'Game_Minecraft'
    }
  ]
};

// Sample raw API response (with define wrapper)
const sampleRawApiResponse = `define(${JSON.stringify(sampleApiData)});`;

// Sample OpenAPI specification for validation
const sampleOpenApiSpec = {
  openapi: '3.1.1',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths: {
    '/test': {
      get: {
        operationId: 'testOperation',
        responses: {
          '200': {
            description: 'Success'
          }
        }
      }
    }
  }
};

module.exports = {
  sampleApiData,
  sampleRawApiResponse,
  sampleOpenApiSpec
};
