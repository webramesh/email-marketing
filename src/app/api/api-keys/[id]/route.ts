/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Get API key by ID
 *     description: Retrieve a specific API key by its ID
 *     tags: [Authentication]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key details
 *       404:
 *         description: API key not found
 *   put:
 *     summary: Update API key
 *     description: Update an existing API key
 *     tags: [Authentication]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: API key name
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permissions
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date
 *     responses:
 *       200:
 *         description: API key updated successfully
 *       404:
 *         description: API key not found
 *   delete:
 *     summary: Delete API key
 *     description: Permanently delete an API key
 *     tags: [Authentication]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *       404:
 *         description: API key not found
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { ApiKeyService } from '@/services/api-key.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
} from '@/lib/api';
import { z } from 'zod';

// Validation schemas
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/api-keys/[id]
 * Get API key by ID
 */
async function getApiKey(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const apiKeysIndex = pathSegments.findIndex(segment => segment === 'api-keys');
    const id = pathSegments[apiKeysIndex + 1];

    if (!id) {
      return createErrorResponse('API key ID is required', 400);
    }

    const apiKey = await ApiKeyService.getApiKeyById(tenantId, id);

    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    return createSuccessResponse(apiKey, 'API key retrieved successfully');
  } catch (error) {
    console.error('Error fetching API key:', error);
    return createErrorResponse('Failed to fetch API key', 500);
  }
}

/**
 * PUT /api/api-keys/[id]
 * Update API key
 */
async function updateApiKey(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const apiKeysIndex = pathSegments.findIndex(segment => segment === 'api-keys');
    const id = pathSegments[apiKeysIndex + 1];

    if (!id) {
      return createErrorResponse('API key ID is required', 400);
    }

    const body = await request.json();
    const validatedData = updateApiKeySchema.parse(body);

    // Convert expiresAt string to Date if provided
    const updateData = {
      ...validatedData,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
    };

    const apiKey = await ApiKeyService.updateApiKey(tenantId, id, updateData);

    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    return createSuccessResponse(apiKey, 'API key updated successfully');
  } catch (error) {
    console.error('Error updating API key:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues);
    }

    return createErrorResponse('Failed to update API key', 500);
  }
}

/**
 * DELETE /api/api-keys/[id]
 * Delete API key
 */
async function deleteApiKey(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const apiKeysIndex = pathSegments.findIndex(segment => segment === 'api-keys');
    const id = pathSegments[apiKeysIndex + 1];

    if (!id) {
      return createErrorResponse('API key ID is required', 400);
    }

    const success = await ApiKeyService.deleteApiKey(tenantId, id);

    if (!success) {
      return createErrorResponse('API key not found', 404);
    }

    return createSuccessResponse(null, 'API key deleted successfully');
  } catch (error) {
    console.error('Error deleting API key:', error);
    return createErrorResponse('Failed to delete API key', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getApiKey, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.API_KEYS,
  Action.READ
);

export const PUT = withPermission(
  createApiRoute(updateApiKey, {
    rateLimit: { windowMs: 60000, maxRequests: 20 },
  }),
  Resource.API_KEYS,
  Action.UPDATE
);

export const DELETE = withPermission(
  createApiRoute(deleteApiKey, {
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  }),
  Resource.API_KEYS,
  Action.DELETE
);
