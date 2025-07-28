/**
 * @swagger
 * /api/webhooks/events:
 *   get:
 *     summary: Get available webhook events
 *     description: Retrieve all available webhook event types
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: List of available webhook events
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
 *                       type:
 *                         type: string
 *                         description: Event type identifier
 *                       name:
 *                         type: string
 *                         description: Human-readable event name
 *                       description:
 *                         type: string
 *                         description: Event description
 *                       category:
 *                         type: string
 *                         description: Event category
 */

import { NextRequest } from 'next/server'
import { WebhookService } from '@/services/webhook.service'
import { 
  createApiRoute, 
  createSuccessResponse, 
  createErrorResponse
} from '@/lib/api'

/**
 * GET /api/webhooks/events
 * Get available webhook events
 */
async function getWebhookEvents(request: NextRequest) {
  try {
    const events = WebhookService.getAvailableEvents()
    
    return createSuccessResponse(
      events,
      'Webhook events retrieved successfully'
    )
  } catch (error) {
    console.error('Error fetching webhook events:', error)
    return createErrorResponse('Failed to fetch webhook events', 500)
  }
}

// No RBAC needed for this endpoint as it's just metadata
export const GET = createApiRoute(getWebhookEvents, {
  auth: false,
  rateLimit: { windowMs: 60000, maxRequests: 100 }
})