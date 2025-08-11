/**
 * @swagger
 * /api/api-keys/{id}/refresh-tokens:
 *   get:
 *     summary: Get refresh tokens for API key
 *     description: Retrieve all active refresh tokens for a specific API key
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
 *         description: Refresh tokens retrieved successfully
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
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       usageCount:
 *                         type: number
 *                       ipAddress:
 *                         type: string
 *                         nullable: true
 *                       userAgent:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   delete:
 *     summary: Revoke all refresh tokens
 *     description: Revoke all active refresh tokens for a specific API key
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
 *         description: All refresh tokens revoked successfully
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
 * GET /api/api-keys/[id]/refresh-tokens
 * Get all active refresh tokens for an API key
 */
async function getRefreshTokens(request: NextRequest) {
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

    // Verify API key exists and belongs to tenant
    const apiKey = await ApiKeyService.getApiKeyById(tenantId, id);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Get active refresh tokens
    const refreshTokens = await JwtRefreshService.getActiveRefreshTokens(id);

    // Remove sensitive data before returning
    const sanitizedTokens = refreshTokens.map(token => ({
      id: token.id,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      usageCount: token.usageCount,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      createdAt: token.createdAt,
    }));

    return createSuccessResponse(
      sanitizedTokens,
      'Refresh tokens retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching refresh tokens:', error);
    return createErrorResponse('Failed to fetch refresh tokens', 500);
  }
}

/**
 * DELETE /api/api-keys/[id]/refresh-tokens
 * Revoke all refresh tokens for an API key
 */
async function revokeAllRefreshTokens(request: NextRequest) {
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

    // Verify API key exists and belongs to tenant
    const apiKey = await ApiKeyService.getApiKeyById(tenantId, id);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Revoke all refresh tokens
    const revokedCount = await JwtRefreshService.revokeAllRefreshTokensForApiKey(
      id,
      'Revoked by user request'
    );

    return createSuccessResponse(
      { revokedCount },
      `${revokedCount} refresh tokens revoked successfully`
    );
  } catch (error) {
    console.error('Error revoking refresh tokens:', error);
    return createErrorResponse('Failed to revoke refresh tokens', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getRefreshTokens, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.API_KEYS,
  Action.READ
);

export const DELETE = withPermission(
  createApiRoute(revokeAllRefreshTokens, {
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  }),
  Resource.API_KEYS,
  Action.UPDATE
);