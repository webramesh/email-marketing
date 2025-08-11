/**
 * @swagger
 * /api/auth/token/generate:
 *   post:
 *     summary: Generate JWT token pair
 *     description: Generate a new access token and refresh token pair for an API key
 *     tags: [Authentication]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Token pair generated successfully
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
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token
 *                     refreshToken:
 *                       type: string
 *                       description: JWT refresh token
 *                     expiresIn:
 *                       type: number
 *                       description: Access token expiry in seconds
 *                     refreshExpiresIn:
 *                       type: number
 *                       description: Refresh token expiry in seconds
 *       401:
 *         description: Invalid API key
 *       403:
 *         description: API key lacks required permissions
 */

import { NextRequest } from 'next/server';
import { JwtRefreshService } from '@/services/jwt-refresh.service';
import { ApiKeyService } from '@/services/api-key.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
} from '@/lib/api';

/**
 * POST /api/auth/token/generate
 * Generate JWT token pair for API key
 */
async function generateTokenPair(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);
    const apiKeyId = request.headers.get('X-API-Key-ID');

    if (!apiKeyId) {
      return createErrorResponse('API key ID is required', 400);
    }

    // Get API key details
    const apiKey = await ApiKeyService.getApiKeyById(tenantId, apiKeyId);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Extract client metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('cf-connecting-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const deviceFingerprint = JwtRefreshService.generateDeviceFingerprint(userAgent, ipAddress);

    // Generate token pair
    const tokenPair = await JwtRefreshService.generateTokenPair(
      apiKey.id,
      apiKey.tenantId,
      undefined, // userId not available for API keys
      apiKey.permissions,
      {
        ipAddress,
        userAgent,
        deviceFingerprint,
      }
    );

    return createSuccessResponse(
      tokenPair,
      'Token pair generated successfully'
    );
  } catch (error) {
    console.error('Error generating token pair:', error);
    return createErrorResponse('Failed to generate token pair', 500);
  }
}

export const POST = createApiRoute(generateTokenPair, {
  rateLimit: { windowMs: 60000, maxRequests: 5 }, // 5 requests per minute
});