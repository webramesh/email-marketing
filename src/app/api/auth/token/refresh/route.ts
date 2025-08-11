/**
 * @swagger
 * /api/auth/token/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange a refresh token for a new access token and refresh token pair
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to exchange
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                       description: New access token
 *                     refreshToken:
 *                       type: string
 *                       description: New refresh token
 *                     expiresIn:
 *                       type: number
 *                       description: Access token expiry in seconds
 *                     refreshExpiresIn:
 *                       type: number
 *                       description: Refresh token expiry in seconds
 *       401:
 *         description: Invalid or expired refresh token
 *       400:
 *         description: Invalid request data
 */

import { NextRequest } from 'next/server';
import { JwtRefreshService } from '@/services/jwt-refresh.service';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api';
import { z } from 'zod';

// Validation schema
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/token/refresh
 * Refresh access token using refresh token
 */
async function refreshToken(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = refreshTokenSchema.parse(body);

    // Extract client metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('cf-connecting-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const deviceFingerprint = JwtRefreshService.generateDeviceFingerprint(userAgent, ipAddress);

    // Refresh the token
    const tokenPair = await JwtRefreshService.refreshAccessToken(
      validatedData.refreshToken,
      {
        ipAddress,
        userAgent,
        deviceFingerprint,
      }
    );

    if (!tokenPair) {
      return createErrorResponse('Invalid or expired refresh token', 401);
    }

    return createSuccessResponse(
      tokenPair,
      'Token refreshed successfully'
    );
  } catch (error) {
    console.error('Error refreshing token:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues);
    }

    return createErrorResponse('Failed to refresh token', 500);
  }
}

export const POST = createApiRoute(refreshToken, {
  auth: false, // No auth required for token refresh
  rateLimit: { windowMs: 60000, maxRequests: 10 }, // 10 requests per minute
});