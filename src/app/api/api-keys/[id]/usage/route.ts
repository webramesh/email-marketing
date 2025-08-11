/**
 * @swagger
 * /api/api-keys/{id}/usage:
 *   get:
 *     summary: Get API key usage analytics
 *     description: Retrieve detailed usage analytics for a specific API key
 *     tags: [Authentication]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (YYYY-MM-DD)
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Usage analytics retrieved successfully
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
 *                     totalRequests:
 *                       type: number
 *                     successfulRequests:
 *                       type: number
 *                     failedRequests:
 *                       type: number
 *                     averageResponseTime:
 *                       type: number
 *                     requestsByEndpoint:
 *                       type: object
 *                     requestsByDay:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           count:
 *                             type: number
 *                     refreshTokenStats:
 *                       type: object
 *                       properties:
 *                         totalTokens:
 *                           type: number
 *                         activeTokens:
 *                           type: number
 *                         revokedTokens:
 *                           type: number
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { ApiKeyService } from '@/services/api-key.service';
import { JwtRefreshService } from '@/services/jwt-refresh.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
  validateQueryParams,
} from '@/lib/api';
import { z } from 'zod';

// Validation schema for query parameters
const usageQuerySchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

/**
 * GET /api/api-keys/[id]/usage
 * Get usage analytics for an API key
 */
async function getApiKeyUsage(request: NextRequest) {
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

    // Validate query parameters
    const { startDate, endDate } = validateQueryParams(request, usageQuerySchema);

    // Verify API key exists and belongs to tenant
    const apiKey = await ApiKeyService.getApiKeyById(tenantId, id);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Get usage statistics
    const [usageStats, refreshTokenStats] = await Promise.all([
      ApiKeyService.getApiKeyUsage(tenantId, id, startDate, endDate),
      JwtRefreshService.getRefreshTokenStats(id),
    ]);

    const analytics = {
      ...usageStats,
      refreshTokenStats,
    };

    return createSuccessResponse(
      analytics,
      'Usage analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching API key usage:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid query parameters', 400, error.issues);
    }

    return createErrorResponse('Failed to fetch usage analytics', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getApiKeyUsage, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.API_KEYS,
  Action.READ
);