/**
 * @swagger
 * /api/webhooks/{id}/test:
 *   post:
 *     summary: Test webhook
 *     description: Send a test event to the webhook endpoint
 *     tags: [Webhooks]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: Test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       description: Whether the test was successful
 *                     status:
 *                       type: integer
 *                       description: HTTP status code returned by webhook
 *                     responseTime:
 *                       type: integer
 *                       description: Response time in milliseconds
 *                     error:
 *                       type: string
 *                       description: Error message if test failed
 *       404:
 *         description: Webhook not found
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { WebhookService } from '@/services/webhook.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
} from '@/lib/api';

/**
 * POST /api/webhooks/[id]/test
 * Test webhook endpoint
 */
async function testWebhook(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const webhooksIndex = pathSegments.findIndex(segment => segment === 'webhooks');
    const id = pathSegments[webhooksIndex + 1];

    if (!id) {
      return createErrorResponse('Webhook ID is required', 400);
    }

    const result = await WebhookService.testWebhook(tenantId, id);

    return createSuccessResponse(
      result,
      result.success ? 'Webhook test successful' : 'Webhook test failed'
    );
  } catch (error: any) {
    console.error('Error testing webhook:', error);

    if (error.message === 'Webhook not found') {
      return createErrorResponse('Webhook not found', 404);
    }

    return createErrorResponse('Failed to test webhook', 500);
  }
}

// Apply RBAC middleware
export const POST = withPermission(
  createApiRoute(testWebhook, {
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  }),
  Resource.WEBHOOKS,
  Action.UPDATE
);
