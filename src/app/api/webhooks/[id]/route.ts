/**
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     summary: Get webhook by ID
 *     description: Retrieve a specific webhook by its ID
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
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 *   put:
 *     summary: Update webhook
 *     description: Update an existing webhook
 *     tags: [Webhooks]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Webhook name
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook endpoint URL
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of events to subscribe to
 *               secret:
 *                 type: string
 *                 description: Secret for signature verification
 *               isActive:
 *                 type: boolean
 *                 description: Whether the webhook is active
 *     responses:
 *       200:
 *         description: Webhook updated successfully
 *       404:
 *         description: Webhook not found
 *   delete:
 *     summary: Delete webhook
 *     description: Permanently delete a webhook
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
 *         description: Webhook deleted successfully
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
import { z } from 'zod';

// Validation schemas
const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/webhooks/[id]
 * Get webhook by ID
 */
async function getWebhook(request: NextRequest) {
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

    const webhook = await WebhookService.getWebhookById(tenantId, id);

    if (!webhook) {
      return createErrorResponse('Webhook not found', 404);
    }

    return createSuccessResponse(webhook, 'Webhook retrieved successfully');
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return createErrorResponse('Failed to fetch webhook', 500);
  }
}

/**
 * PUT /api/webhooks/[id]
 * Update webhook
 */
async function updateWebhook(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = updateWebhookSchema.parse(body);

    const webhook = await WebhookService.updateWebhook(tenantId, id, validatedData);

    if (!webhook) {
      return createErrorResponse('Webhook not found', 404);
    }

    return createSuccessResponse(webhook, 'Webhook updated successfully');
  } catch (error: any) {
    console.error('Error updating webhook:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues);
    }

    if (error.message.includes('Invalid')) {
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Failed to update webhook', 500);
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete webhook
 */
async function deleteWebhook(request: NextRequest) {
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

    const success = await WebhookService.deleteWebhook(tenantId, id);

    if (!success) {
      return createErrorResponse('Webhook not found', 404);
    }

    return createSuccessResponse(null, 'Webhook deleted successfully');
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return createErrorResponse('Failed to delete webhook', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getWebhook, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.WEBHOOKS,
  Action.READ
);

export const PUT = withPermission(
  createApiRoute(updateWebhook, {
    rateLimit: { windowMs: 60000, maxRequests: 20 },
  }),
  Resource.WEBHOOKS,
  Action.UPDATE
);

export const DELETE = withPermission(
  createApiRoute(deleteWebhook, {
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  }),
  Resource.WEBHOOKS,
  Action.DELETE
);
