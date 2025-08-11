/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: Get all API keys
 *     description: Retrieve all API keys for the current tenant
 *     tags: [Authentication]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   post:
 *     summary: Create new API key
 *     description: Create a new API key for the current tenant
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 description: API key name
 *                 example: "Production API Key"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permissions
 *                 example: ["campaigns:read", "subscribers:read"]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date (optional)
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     key:
 *                       type: string
 *                       description: The actual API key (only returned on creation)
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                 message:
 *                   type: string
 *                   example: "API key created successfully"
 */

import { NextRequest } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { ApiKeyService } from '@/services/api-key.service'
import { 
  createApiRoute, 
  createSuccessResponse, 
  createErrorResponse,
  requireTenantId,
  getUserId,
  validateQueryParams,
  paginationSchema
} from '@/lib/api'
import { z } from 'zod'

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(255),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  expiresAt: z.string().datetime('Invalid date format').optional(),
  rateLimit: z.number().min(1).max(10000).optional(),
  rateLimitWindow: z.number().min(1).max(3600).optional(),
  allowedIps: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
})

/**
 * GET /api/api-keys
 * Get all API keys for the current tenant
 */
async function getApiKeys(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    // Validate query parameters
    const { page, limit } = validateQueryParams(request, paginationSchema)
    
    const apiKeys = await ApiKeyService.getApiKeys(tenantId)
    
    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedKeys = apiKeys.slice(startIndex, endIndex)
    
    return createSuccessResponse(
      paginatedKeys,
      'API keys retrieved successfully',
      200,
      {
        total: apiKeys.length,
        page,
        limit,
        totalPages: Math.ceil(apiKeys.length / limit)
      }
    )
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return createErrorResponse('Failed to fetch API keys', 500)
  }
}

/**
 * POST /api/api-keys
 * Create a new API key
 */
async function createApiKey(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    const userId = getUserId(request)
    
    if (!userId) {
      return createErrorResponse('User ID is required', 400)
    }
    
    const body = await request.json()
    const validatedData = createApiKeySchema.parse(body)
    
    // Convert expiresAt string to Date if provided
    const apiKeyData = {
      ...validatedData,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined
    }
    
    const apiKey = await ApiKeyService.createApiKey(tenantId, userId, apiKeyData)
    
    return createSuccessResponse(
      apiKey,
      'API key created successfully',
      201
    )
  } catch (error) {
    console.error('Error creating API key:', error)
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues)
    }
    
    return createErrorResponse('Failed to create API key', 500)
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getApiKeys, {
    rateLimit: { windowMs: 60000, maxRequests: 100 }
  }),
  Resource.API_KEYS,
  Action.READ
)

export const POST = withPermission(
  createApiRoute(createApiKey, {
    rateLimit: { windowMs: 60000, maxRequests: 10 }
  }),
  Resource.API_KEYS,
  Action.CREATE
)