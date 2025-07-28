/**
 * API documentation system using OpenAPI/Swagger
 */

import swaggerJSDoc from 'swagger-jsdoc'

// OpenAPI specification
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Email Marketing Platform API',
    version: '1.0.0',
    description: 'Comprehensive RESTful API for the email marketing platform with multi-tenant support',
    contact: {
      name: 'API Support',
      email: 'api-support@emailplatform.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
      description: 'Development server'
    },
    {
      url: 'https://api.emailplatform.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for session-based authentication'
      }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful'
          },
          data: {
            description: 'Response data (varies by endpoint)'
          },
          message: {
            type: 'string',
            description: 'Success message'
          },
          error: {
            type: 'string',
            description: 'Error message if success is false'
          },
          meta: {
            type: 'object',
            description: 'Additional metadata (pagination, etc.)'
          }
        },
        required: ['success']
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items'
          },
          page: {
            type: 'integer',
            description: 'Current page number'
          },
          limit: {
            type: 'integer',
            description: 'Items per page'
          },
          totalPages: {
            type: 'integer',
            description: 'Total number of pages'
          },
          hasNextPage: {
            type: 'boolean',
            description: 'Whether there is a next page'
          },
          hasPrevPage: {
            type: 'boolean',
            description: 'Whether there is a previous page'
          }
        }
      },
      Campaign: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique campaign identifier'
          },
          name: {
            type: 'string',
            description: 'Campaign name'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          preheader: {
            type: 'string',
            nullable: true,
            description: 'Email preheader text'
          },
          content: {
            type: 'string',
            description: 'Email HTML content'
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'],
            description: 'Campaign status'
          },
          campaignType: {
            type: 'string',
            enum: ['REGULAR', 'AB_TEST', 'AUTOMATION', 'TRANSACTIONAL'],
            description: 'Type of campaign'
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Scheduled send time'
          },
          sentAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Actual send time'
          },
          fromName: {
            type: 'string',
            nullable: true,
            description: 'Sender name'
          },
          fromEmail: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Sender email address'
          },
          replyToEmail: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Reply-to email address'
          },
          trackOpens: {
            type: 'boolean',
            description: 'Whether to track email opens'
          },
          trackClicks: {
            type: 'boolean',
            description: 'Whether to track link clicks'
          },
          totalRecipients: {
            type: 'integer',
            description: 'Total number of recipients'
          },
          totalSent: {
            type: 'integer',
            description: 'Number of emails sent'
          },
          totalDelivered: {
            type: 'integer',
            description: 'Number of emails delivered'
          },
          totalOpened: {
            type: 'integer',
            description: 'Number of emails opened'
          },
          totalClicked: {
            type: 'integer',
            description: 'Number of emails clicked'
          },
          totalUnsubscribed: {
            type: 'integer',
            description: 'Number of unsubscribes'
          },
          totalBounced: {
            type: 'integer',
            description: 'Number of bounced emails'
          },
          totalComplained: {
            type: 'integer',
            description: 'Number of spam complaints'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            nullable: true,
            description: 'Campaign tags'
          },
          notes: {
            type: 'string',
            nullable: true,
            description: 'Campaign notes'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'name', 'subject', 'content', 'status', 'campaignType']
      },
      CreateCampaignRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Campaign name'
          },
          subject: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Email subject line'
          },
          preheader: {
            type: 'string',
            maxLength: 255,
            description: 'Email preheader text'
          },
          content: {
            type: 'string',
            description: 'Email HTML content'
          },
          campaignType: {
            type: 'string',
            enum: ['REGULAR', 'AB_TEST', 'AUTOMATION', 'TRANSACTIONAL'],
            description: 'Type of campaign'
          },
          fromName: {
            type: 'string',
            maxLength: 255,
            description: 'Sender name'
          },
          fromEmail: {
            type: 'string',
            format: 'email',
            description: 'Sender email address'
          },
          replyToEmail: {
            type: 'string',
            format: 'email',
            description: 'Reply-to email address'
          },
          trackOpens: {
            type: 'boolean',
            description: 'Whether to track email opens'
          },
          trackClicks: {
            type: 'boolean',
            description: 'Whether to track link clicks'
          },
          targetLists: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Target subscriber lists'
          },
          targetSegments: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Target subscriber segments'
          },
          templateId: {
            type: 'string',
            description: 'Email template ID'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Campaign tags'
          },
          notes: {
            type: 'string',
            description: 'Campaign notes'
          },
          scheduledAt: {
            type: 'string',
            format: 'date-time',
            description: 'Scheduled send time'
          }
        },
        required: ['name', 'subject']
      },
      Subscriber: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique subscriber identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Subscriber email address'
          },
          firstName: {
            type: 'string',
            nullable: true,
            description: 'First name'
          },
          lastName: {
            type: 'string',
            nullable: true,
            description: 'Last name'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED', 'INVALID'],
            description: 'Subscriber status'
          },
          customFields: {
            type: 'object',
            nullable: true,
            description: 'Custom field data'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'email', 'status']
      },
      List: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique list identifier'
          },
          name: {
            type: 'string',
            description: 'List name'
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'List description'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'name']
      },
      Automation: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique automation identifier'
          },
          name: {
            type: 'string',
            description: 'Automation name'
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'],
            description: 'Automation status'
          },
          triggerType: {
            type: 'string',
            description: 'Type of trigger'
          },
          triggerConfig: {
            type: 'object',
            description: 'Trigger configuration'
          },
          workflowData: {
            type: 'object',
            description: 'Workflow definition'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['id', 'name', 'status', 'triggerType']
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            description: 'Error message'
          },
          details: {
            description: 'Additional error details'
          }
        },
        required: ['success', 'error']
      }
    },
    parameters: {
      TenantId: {
        name: 'X-Tenant-ID',
        in: 'header',
        required: true,
        schema: {
          type: 'string'
        },
        description: 'Tenant identifier'
      },
      Page: {
        name: 'page',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number for pagination'
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        description: 'Number of items per page'
      }
    },
    responses: {
      Success: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiResponse'
            }
          }
        }
      },
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        },
        headers: {
          'X-RateLimit-Limit': {
            schema: {
              type: 'integer'
            },
            description: 'Request limit per time window'
          },
          'X-RateLimit-Remaining': {
            schema: {
              type: 'integer'
            },
            description: 'Remaining requests in current window'
          },
          'X-RateLimit-Reset': {
            schema: {
              type: 'integer'
            },
            description: 'Time when rate limit resets (Unix timestamp)'
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    }
  },
  security: [
    {
      ApiKeyAuth: []
    },
    {
      BearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'API authentication and key management'
    },
    {
      name: 'Campaigns',
      description: 'Email campaign management'
    },
    {
      name: 'Subscribers',
      description: 'Subscriber management'
    },
    {
      name: 'Lists',
      description: 'Subscriber list management'
    },
    {
      name: 'Segments',
      description: 'Subscriber segmentation'
    },
    {
      name: 'Automations',
      description: 'Email automation workflows'
    },
    {
      name: 'Analytics',
      description: 'Campaign and subscriber analytics'
    },
    {
      name: 'Forms',
      description: 'Subscription forms and lead generation'
    },
    {
      name: 'Domains',
      description: 'Sending domain management'
    },
    {
      name: 'Sending Servers',
      description: 'Email sending server configuration'
    },
    {
      name: 'Email Verification',
      description: 'Email validation and verification'
    },
    {
      name: 'Webhooks',
      description: 'Webhook management and events'
    },
    {
      name: 'Billing',
      description: 'Billing and subscription management'
    }
  ]
}

// Swagger options
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    './src/app/api/**/*.ts', // Path to the API files
    './src/lib/api/**/*.ts'  // Path to API utilities
  ]
}

// Generate swagger specification
export const swaggerSpec = swaggerJSDoc(swaggerOptions)

// API documentation metadata
export const apiDocumentation = {
  title: 'Email Marketing Platform API Documentation',
  description: 'Comprehensive API documentation for the email marketing platform',
  version: '1.0.0',
  spec: swaggerSpec
}

// Helper function to generate OpenAPI documentation for a route
export function generateRouteDoc(
  path: string,
  method: string,
  summary: string,
  description: string,
  tags: string[],
  parameters?: any[],
  requestBody?: any,
  responses?: any
) {
  return {
    [path]: {
      [method.toLowerCase()]: {
        summary,
        description,
        tags,
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            $ref: '#/components/parameters/TenantId'
          },
          ...(parameters || [])
        ],
        ...(requestBody && { requestBody }),
        responses: {
          '200': {
            $ref: '#/components/responses/Success'
          },
          '400': {
            $ref: '#/components/responses/BadRequest'
          },
          '401': {
            $ref: '#/components/responses/Unauthorized'
          },
          '403': {
            $ref: '#/components/responses/Forbidden'
          },
          '404': {
            $ref: '#/components/responses/NotFound'
          },
          '429': {
            $ref: '#/components/responses/TooManyRequests'
          },
          '500': {
            $ref: '#/components/responses/InternalServerError'
          },
          ...(responses || {})
        }
      }
    }
  }
}