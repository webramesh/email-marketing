/**
 * JWT Refresh Token Service
 * Handles JWT token generation, validation, and refresh token rotation
 */

import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface JwtPayload {
  sub: string; // API Key ID
  tenantId: string;
  userId?: string;
  permissions: string[];
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  jti?: string; // JWT ID for refresh tokens
}

export interface RefreshTokenData {
  id: string;
  tokenHash: string;
  apiKeyId: string;
  expiresAt: Date;
  isRevoked: boolean;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
}

export class JwtRefreshService {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private static readonly MAX_REFRESH_TOKENS_PER_API_KEY = 5;

  /**
   * Generate a new JWT token pair (access + refresh)
   */
  static async generateTokenPair(
    apiKeyId: string,
    tenantId: string,
    userId: string | undefined,
    permissions: string[],
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<JwtTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiry = now + 15 * 60; // 15 minutes
    const refreshTokenExpiry = now + 7 * 24 * 60 * 60; // 7 days

    // Generate unique JWT ID for refresh token
    const jti = crypto.randomUUID();

    // Create access token
    const accessTokenPayload: JwtPayload = {
      sub: apiKeyId,
      tenantId,
      userId,
      permissions,
      type: 'access',
      iat: now,
      exp: accessTokenExpiry,
    };

    const accessToken = jwt.sign(accessTokenPayload, this.ACCESS_TOKEN_SECRET);

    // Create refresh token
    const refreshTokenPayload: JwtPayload = {
      sub: apiKeyId,
      tenantId,
      userId,
      permissions,
      type: 'refresh',
      iat: now,
      exp: refreshTokenExpiry,
      jti,
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.REFRESH_TOKEN_SECRET);

    // Store refresh token in database
    await this.storeRefreshToken(
      jti,
      refreshToken,
      apiKeyId,
      new Date(refreshTokenExpiry * 1000),
      metadata
    );

    // Clean up old refresh tokens
    await this.cleanupOldRefreshTokens(apiKeyId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };
  }

  /**
   * Refresh an access token using a refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<JwtTokenPair | null> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.REFRESH_TOKEN_SECRET) as JwtPayload;

      if (decoded.type !== 'refresh' || !decoded.jti) {
        throw new Error('Invalid refresh token type');
      }

      // Check if refresh token exists and is valid in database
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          tokenHash: this.hashToken(refreshToken),
          isRevoked: false,
        },
        include: {
          apiKey: true,
        },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        // Token not found or expired
        if (storedToken) {
          await this.revokeRefreshToken(storedToken.id, 'Token expired');
        }
        return null;
      }

      // Validate API key is still active
      if (!storedToken.apiKey.isActive) {
        await this.revokeRefreshToken(storedToken.id, 'API key deactivated');
        return null;
      }

      // Check for token reuse (security measure)
      if (storedToken.lastUsedAt && storedToken.usageCount > 0) {
        // This refresh token has been used before - potential security issue
        // Revoke all refresh tokens for this API key
        await this.revokeAllRefreshTokensForApiKey(
          storedToken.apiKeyId,
          'Potential token reuse detected'
        );
        return null;
      }

      // Update usage tracking
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      });

      // Generate new token pair with rotation
      const newTokenPair = await this.generateTokenPair(
        storedToken.apiKeyId,
        decoded.tenantId,
        decoded.userId,
        decoded.permissions,
        metadata
      );

      // Revoke the old refresh token (rotation)
      await this.revokeRefreshToken(storedToken.id, 'Token rotated');

      return newTokenPair;
    } catch (error) {
      console.error('Refresh token validation error:', error);
      return null;
    }
  }

  /**
   * Validate an access token
   */
  static async validateAccessToken(accessToken: string): Promise<JwtPayload | null> {
    try {
      const decoded = jwt.verify(accessToken, this.ACCESS_TOKEN_SECRET) as JwtPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid access token type');
      }

      // Verify API key is still active
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: decoded.sub,
          isActive: true,
        },
      });

      if (!apiKey) {
        return null;
      }

      // Check if API key has expired
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('Access token validation error:', error);
      return null;
    }
  }

  /**
   * Revoke a specific refresh token
   */
  static async revokeRefreshToken(tokenId: string, reason?: string): Promise<boolean> {
    try {
      const result = await prisma.refreshToken.update({
        where: { id: tokenId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      return !!result;
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for an API key
   */
  static async revokeAllRefreshTokensForApiKey(
    apiKeyId: string,
    reason?: string
  ): Promise<number> {
    try {
      const result = await prisma.refreshToken.updateMany({
        where: {
          apiKeyId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      return result.count;
    } catch (error) {
      console.error('Error revoking refresh tokens:', error);
      return 0;
    }
  }

  /**
   * Get all active refresh tokens for an API key
   */
  static async getActiveRefreshTokens(apiKeyId: string): Promise<RefreshTokenData[]> {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        apiKeyId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map(token => ({
      id: token.id,
      tokenHash: token.tokenHash,
      apiKeyId: token.apiKeyId,
      expiresAt: token.expiresAt,
      isRevoked: token.isRevoked,
      ipAddress: token.ipAddress || undefined,
      userAgent: token.userAgent || undefined,
      deviceFingerprint: token.deviceFingerprint || undefined,
      lastUsedAt: token.lastUsedAt || undefined,
      usageCount: token.usageCount,
      createdAt: token.createdAt,
    }));
  }

  /**
   * Store refresh token in database
   */
  private static async storeRefreshToken(
    jti: string,
    refreshToken: string,
    apiKeyId: string,
    expiresAt: Date,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        id: jti,
        tokenHash: this.hashToken(refreshToken),
        apiKeyId,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        deviceFingerprint: metadata?.deviceFingerprint,
      },
    });
  }

  /**
   * Clean up old refresh tokens (keep only the most recent ones)
   */
  private static async cleanupOldRefreshTokens(apiKeyId: string): Promise<void> {
    // Get all active refresh tokens for this API key
    const tokens = await prisma.refreshToken.findMany({
      where: {
        apiKeyId,
        isRevoked: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // If we have more than the maximum allowed, revoke the oldest ones
    if (tokens.length > this.MAX_REFRESH_TOKENS_PER_API_KEY) {
      const tokensToRevoke = tokens.slice(this.MAX_REFRESH_TOKENS_PER_API_KEY);
      
      await prisma.refreshToken.updateMany({
        where: {
          id: { in: tokensToRevoke.map(t => t.id) },
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'Exceeded maximum refresh tokens per API key',
        },
      });
    }

    // Clean up expired tokens
    await prisma.refreshToken.updateMany({
      where: {
        apiKeyId,
        expiresAt: { lt: new Date() },
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'Token expired',
      },
    });
  }

  /**
   * Hash a token for secure storage
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate device fingerprint from request metadata
   */
  static generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
    const data = `${userAgent || 'unknown'}:${ipAddress || 'unknown'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get refresh token statistics for an API key
   */
  static async getRefreshTokenStats(apiKeyId: string): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    recentUsage: Array<{ date: string; count: number }>;
  }> {
    const [totalTokens, activeTokens, revokedTokens, expiredTokens] = await Promise.all([
      prisma.refreshToken.count({ where: { apiKeyId } }),
      prisma.refreshToken.count({
        where: { apiKeyId, isRevoked: false, expiresAt: { gt: new Date() } },
      }),
      prisma.refreshToken.count({ where: { apiKeyId, isRevoked: true } }),
      prisma.refreshToken.count({
        where: { apiKeyId, expiresAt: { lt: new Date() } },
      }),
    ]);

    // Get recent usage (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsage = await prisma.refreshToken.groupBy({
      by: ['createdAt'],
      where: {
        apiKeyId,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { createdAt: true },
    });

    const recentUsageFormatted = recentUsage.map(usage => ({
      date: usage.createdAt.toISOString().split('T')[0],
      count: usage._count.createdAt,
    }));

    return {
      totalTokens,
      activeTokens,
      revokedTokens,
      expiredTokens,
      recentUsage: recentUsageFormatted,
    };
  }
}