/**
 * @swagger
 * /api/analytics/rate-limits:
 *   get:
 *     summary: Get rate limit analytics
 *     description: Retrieve comprehensive rate limiting analytics for the tenant
 *     tags: [Analytics]
 *     parameters:
 *       - name: timeRange
 *         in: query
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: day
 *         description: Time range for analytics
 *     responses:
 *       200:
 *         description: Rate limit analytics retrieved successfully
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
 *                     rateLimitedRequests:
 *                       type: number
 *                     rateLimitedPercentage:
 *                       type: number
 *                     topEndpoints:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           endpoint:
 *                             type: string
 *                           requests:
 *                             type: number
 *                           rateLimited:
 *                             type: number
 *                     topIps:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ip:
 *                             type: string
 *                           requests:
 *                             type: number
 *                           rateLimited:
 *                             type: number
 *                     timeSeriesData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           requests:
 *                             type: number
 *                           rateLimited:
 *                             type: number
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { RateLimitService } from '@/services/rate-limit.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
  validateQueryParams,
} from '@/lib/api';
import { z } from 'zod';

// Validation schema for query parameters
const analyticsQuerySchema = z.object({
  timeRange: z.enum(['hour', 'day', 'week']).default('day'),
});

/**
 * GET /api/analytics/rate-limits
 * Get rate limit analytics for the tenant
 */
async function getRateLimitAnalytics(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);
    const { timeRange } = validateQueryParams(request, analyticsQuerySchema);

    // Get rate limit statistics
    const stats = await RateLimitService.getTenantRateLimitStats(tenantId, timeRange);

    // Calculate additional metrics
    const rateLimitedPercentage = stats.totalRequests > 0 
      ? (stats.rateLimitedRequests / stats.totalRequests) * 100 
      : 0;

    const analytics = {
      ...stats,
      rateLimitedPercentage: Math.round(rateLimitedPercentage * 100) / 100,
    };

    return createSuccessResponse(
      analytics,
      'Rate limit analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching rate limit analytics:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid query parameters', 400, error.issues);
    }

    return createErrorResponse('Failed to fetch rate limit analytics', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getRateLimitAnalytics, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.ANALYTICS,
  Action.READ
);