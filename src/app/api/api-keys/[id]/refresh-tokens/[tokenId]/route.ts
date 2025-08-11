/**
 * @swagger
 * /api/api-keys/{id}/refresh-tokens/{tokenId}:
 *   delete:
 *     summary: Revoke specific refresh token
 *     description: Revoke a specific refresh token by its ID
 *     tags: [Authentication]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *       - name: tokenId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token ID
 *     responses:
 *       200:
 *         description: Refresh token revoked successfully
 *       404:
 *         description: API key or refresh token not found
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { JwtRefreshService } from '@/services/jwt-refresh.service';
import { ApiKeyService } from '@/services/api-key.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
} from '@/lib/api';

/**
 * DELETE /api/api-keys/[id]/refresh-tokens/[tokenId]
 * Revoke a specific refresh token
 */
async function revokeRefreshToken(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    // Extract IDs from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const apiKeysIndex = pathSegments.findIndex(segment => segment === 'api-keys');
    const apiKeyId = pathSegments[apiKeysIndex + 1];
    const tokenId = pathSegments[apiKeysIndex + 3]; // refresh-tokens/[tokenId]

    if (!apiKeyId || !tokenId) {
      return createErrorResponse('API key ID and token ID are required', 400);
    }

    // Verify API key exists and belongs to tenant
    const apiKey = await ApiKeyService.getApiKeyById(tenantId, apiKeyId);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Revoke the specific refresh token
    const success = await JwtRefreshService.revokeRefreshToken(
      tokenId,
      'Revoked by user request'
    );

    if (!success) {
      return createErrorResponse('Refresh token not found', 404);
    }

    return createSuccessResponse(
      null,
      'Refresh token revoked successfully'
    );
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    return createErrorResponse('Failed to revoke refresh token', 500);
  }
}

// Apply RBAC middleware to route handlers
export const DELETE = withPermission(
  createApiRoute(revokeRefreshToken, {
    rateLimit: { windowMs: 60000, maxRequests: 20 },
  }),
  Resource.API_KEYS,
  Action.UPDATE
);