/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: Get all webhooks
 *     description: Retrieve all webhooks for the current tenant
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: List of webhooks
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
 *                       url:
 *                         type: string
 *                       events:
 *                         type: array
 *                         items:
 *                           type: string
 *                       isActive:
 *                         type: boolean
 *                       lastTriggeredAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   post:
 *     summary: Create new webhook
 *     description: Create a new webhook endpoint
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *               - events
 *             properties:
 *               name:
 *                 type: string
 *                 description: Webhook name
 *                 example: "Campaign Notifications"
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook endpoint URL
 *                 example: "https://example.com/webhooks/campaigns"
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of events to subscribe to
 *                 example: ["campaign.sent", "email.opened"]
 *               secret:
 *                 type: string
 *                 description: Secret for signature verification (optional)
 *     responses:
 *       201:
 *         description: Webhook created successfully
 */

import { NextRequest } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { WebhookService } from '@/services/webhook.service'
import { 
  createApiRoute, 
  createSuccessResponse, 
  createErrorResponse,
  requireTenantId
} from '@/lib/api'
import { z } from 'zod'

// Validation schemas
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Webhook name is required').max(255),
  url: z.string().url('Invalid URL format'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional()
})

/**
 * GET /api/webhooks
 * Get all webhooks for the current tenant
 */
async function getWebhooks(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    const webhooks = await WebhookService.getWebhooks(tenantId)
    
    return createSuccessResponse(
      webhooks,
      'Webhooks retrieved successfully'
    )
  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return createErrorResponse('Failed to fetch webhooks', 500)
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook
 */
async function createWebhook(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    const body = await request.json()
    const validatedData = createWebhookSchema.parse(body)
    
    const webhook = await WebhookService.createWebhook(tenantId, validatedData)
    
    return createSuccessResponse(
      webhook,
      'Webhook created successfully',
      201
    )
  } catch (error: any) {
    console.error('Error creating webhook:', error)
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues)
    }
    
    if (error.message.includes('Invalid')) {
      return createErrorResponse(error.message, 400)
    }
    
    return createErrorResponse('Failed to create webhook', 500)
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getWebhooks, {
    rateLimit: { windowMs: 60000, maxRequests: 100 }
  }),
  Resource.WEBHOOKS,
  Action.READ
)

export const POST = withPermission(
  createApiRoute(createWebhook, {
    rateLimit: { windowMs: 60000, maxRequests: 10 }
  }),
  Resource.WEBHOOKS,
  Action.CREATE
)