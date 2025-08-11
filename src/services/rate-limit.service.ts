/**
 * Advanced Rate Limiting Service
 * Provides sophisticated rate limiting with multiple strategies
 */

import { prisma } from '@/lib/prisma';
import { ApiKey } from '@/services/api-key.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: any) => string;
}

export interface TenantRateLimit {
  tenantId: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export class RateLimitService {
  private static readonly DEFAULT_TENANT_LIMITS: TenantRateLimit = {
    tenantId: 'default',
    requestsPerMinute: 1000,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    burstLimit: 100,
  };

  /**
   * Check API key specific rate limits
   */
  static async checkApiKeyRateLimit(
    apiKey: ApiKey,
    clientIp: string,
    endpoint?: string
  ): Promise<RateLimitResult> {
    if (!apiKey.rateLimit) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const window = (apiKey.rateLimitWindow || 60) * 1000; // Convert to milliseconds
    const now = Date.now();
    const windowStart = now - window;

    // Create rate limit key
    const rateLimitKey = `api_key:${apiKey.id}:${clientIp}`;

    // Count recent requests
    const recentRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKeyId: apiKey.id,
        timestamp: { gte: new Date(windowStart) },
        ipAddress: clientIp,
        ...(endpoint && { endpoint }),
      },
    });

    const remaining = Math.max(0, apiKey.rateLimit - recentRequests);
    const allowed = recentRequests < apiKey.rateLimit;
    const resetTime = Math.ceil((now + window) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(window / 1000),
    };
  }

  /**
   * Check tenant-wide rate limits
   */
  static async checkTenantRateLimit(
    tenantId: string,
    clientIp: string,
    timeWindow: 'minute' | 'hour' | 'day' = 'minute'
  ): Promise<RateLimitResult> {
    const tenantLimits = await this.getTenantRateLimits(tenantId);
    
    let windowMs: number;
    let maxRequests: number;

    switch (timeWindow) {
      case 'minute':
        windowMs = 60 * 1000;
        maxRequests = tenantLimits.requestsPerMinute;
        break;
      case 'hour':
        windowMs = 60 * 60 * 1000;
        maxRequests = tenantLimits.requestsPerHour;
        break;
      case 'day':
        windowMs = 24 * 60 * 60 * 1000;
        maxRequests = tenantLimits.requestsPerDay;
        break;
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    // Count recent requests for the entire tenant
    const recentRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKey: { tenantId },
        timestamp: { gte: new Date(windowStart) },
      },
    });

    const remaining = Math.max(0, maxRequests - recentRequests);
    const allowed = recentRequests < maxRequests;
    const resetTime = Math.ceil((now + windowMs) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000),
    };
  }

  /**
   * Check burst rate limits (short-term high-frequency requests)
   */
  static async checkBurstRateLimit(
    tenantId: string,
    clientIp: string,
    burstWindowMs: number = 10000 // 10 seconds
  ): Promise<RateLimitResult> {
    const tenantLimits = await this.getTenantRateLimits(tenantId);
    const now = Date.now();
    const windowStart = now - burstWindowMs;

    // Count recent requests in burst window
    const recentRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKey: { tenantId },
        timestamp: { gte: new Date(windowStart) },
        ipAddress: clientIp,
      },
    });

    const remaining = Math.max(0, tenantLimits.burstLimit - recentRequests);
    const allowed = recentRequests < tenantLimits.burstLimit;
    const resetTime = Math.ceil((now + burstWindowMs) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil(burstWindowMs / 1000),
    };
  }

  /**
   * Comprehensive rate limit check combining multiple strategies
   */
  static async checkComprehensiveRateLimit(
    apiKey: ApiKey,
    clientIp: string,
    endpoint?: string
  ): Promise<{
    allowed: boolean;
    limits: {
      apiKey: RateLimitResult;
      tenant: RateLimitResult;
      burst: RateLimitResult;
    };
    mostRestrictive: RateLimitResult;
  }> {
    const [apiKeyLimit, tenantLimit, burstLimit] = await Promise.all([
      this.checkApiKeyRateLimit(apiKey, clientIp, endpoint),
      this.checkTenantRateLimit(apiKey.tenantId, clientIp),
      this.checkBurstRateLimit(apiKey.tenantId, clientIp),
    ]);

    // Find the most restrictive limit
    const limits = [apiKeyLimit, tenantLimit, burstLimit].filter(limit => limit.remaining >= 0);
    const mostRestrictive = limits.reduce((most, current) => {
      if (!most.allowed || (current.allowed && current.remaining < most.remaining)) {
        return current;
      }
      return most;
    }, limits[0] || { allowed: false, remaining: 0, resetTime: 0 });

    const allowed = apiKeyLimit.allowed && tenantLimit.allowed && burstLimit.allowed;

    return {
      allowed,
      limits: {
        apiKey: apiKeyLimit,
        tenant: tenantLimit,
        burst: burstLimit,
      },
      mostRestrictive,
    };
  }

  /**
   * Get tenant rate limits (with caching)
   */
  private static async getTenantRateLimits(tenantId: string): Promise<TenantRateLimit> {
    // In a real implementation, this would fetch from database or cache
    // For now, return default limits
    return {
      ...this.DEFAULT_TENANT_LIMITS,
      tenantId,
    };
  }

  /**
   * Update tenant rate limits
   */
  static async updateTenantRateLimits(
    tenantId: string,
    limits: Partial<Omit<TenantRateLimit, 'tenantId'>>
  ): Promise<TenantRateLimit> {
    // In a real implementation, this would update the database
    // For now, return the updated limits
    const currentLimits = await this.getTenantRateLimits(tenantId);
    return {
      ...currentLimits,
      ...limits,
    };
  }

  /**
   * Get rate limit statistics for a tenant
   */
  static async getTenantRateLimitStats(
    tenantId: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{
    totalRequests: number;
    rateLimitedRequests: number;
    topEndpoints: Array<{ endpoint: string; requests: number; rateLimited: number }>;
    topIps: Array<{ ip: string; requests: number; rateLimited: number }>;
    timeSeriesData: Array<{ timestamp: Date; requests: number; rateLimited: number }>;
  }> {
    let windowMs: number;
    switch (timeRange) {
      case 'hour':
        windowMs = 60 * 60 * 1000;
        break;
      case 'day':
        windowMs = 24 * 60 * 60 * 1000;
        break;
      case 'week':
        windowMs = 7 * 24 * 60 * 60 * 1000;
        break;
    }

    const startTime = new Date(Date.now() - windowMs);

    // Get total requests
    const totalRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKey: { tenantId },
        timestamp: { gte: startTime },
      },
    });

    // Get rate limited requests (status 429)
    const rateLimitedRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKey: { tenantId },
        timestamp: { gte: startTime },
        statusCode: 429,
      },
    });

    // Get top endpoints
    const endpointStats = await prisma.apiKeyUsage.groupBy({
      by: ['endpoint'],
      where: {
        apiKey: { tenantId },
        timestamp: { gte: startTime },
      },
      _count: { endpoint: true },
      orderBy: { _count: { endpoint: 'desc' } },
      take: 10,
    });

    const topEndpoints = await Promise.all(
      endpointStats.map(async (stat) => {
        const rateLimited = await prisma.apiKeyUsage.count({
          where: {
            apiKey: { tenantId },
            timestamp: { gte: startTime },
            endpoint: stat.endpoint,
            statusCode: 429,
          },
        });

        return {
          endpoint: stat.endpoint,
          requests: stat._count.endpoint,
          rateLimited,
        };
      })
    );

    // Get top IPs
    const ipStats = await prisma.apiKeyUsage.groupBy({
      by: ['ipAddress'],
      where: {
        apiKey: { tenantId },
        timestamp: { gte: startTime },
        ipAddress: { not: null },
      },
      _count: { ipAddress: true },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 10,
    });

    const topIps = await Promise.all(
      ipStats.map(async (stat) => {
        const rateLimited = await prisma.apiKeyUsage.count({
          where: {
            apiKey: { tenantId },
            timestamp: { gte: startTime },
            ipAddress: stat.ipAddress,
            statusCode: 429,
          },
        });

        return {
          ip: stat.ipAddress || 'unknown',
          requests: stat._count.ipAddress,
          rateLimited,
        };
      })
    );

    // Get time series data (simplified - in production, use proper time bucketing)
    const timeSeriesData = await prisma.apiKeyUsage.groupBy({
      by: ['timestamp'],
      where: {
        apiKey: { tenantId },
        timestamp: { gte: startTime },
      },
      _count: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const timeSeriesFormatted = await Promise.all(
      timeSeriesData.map(async (data) => {
        const rateLimited = await prisma.apiKeyUsage.count({
          where: {
            apiKey: { tenantId },
            timestamp: data.timestamp,
            statusCode: 429,
          },
        });

        return {
          timestamp: data.timestamp,
          requests: data._count.timestamp,
          rateLimited,
        };
      })
    );

    return {
      totalRequests,
      rateLimitedRequests,
      topEndpoints,
      topIps,
      timeSeriesData: timeSeriesFormatted,
    };
  }

  /**
   * Clean up old rate limit data
   */
  static async cleanupOldData(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.apiKeyUsage.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}