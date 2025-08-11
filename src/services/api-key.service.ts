/**
 * API Key Management Service
 */

import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  tenantId: string;
  permissions: string[];
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  isActive: boolean;
  rateLimit?: number | null;
  rateLimitWindow?: number | null;
  allowedIps?: string[] | null;
  allowedDomains?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: Date;
  rateLimit?: number; // Requests per minute
  rateLimitWindow?: number; // Window in seconds
  allowedIps?: string[]; // Array of allowed IP addresses/ranges
  allowedDomains?: string[]; // Array of allowed domains
}

export interface ApiKeyUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
}

export class ApiKeyService {
  private static readonly API_KEY_SECRET = process.env.API_KEY_SECRET || 'default-api-key-secret';

  /**
   * Create a new API key
   */
  static async createApiKey(
    tenantId: string,
    userId: string,
    data: CreateApiKeyRequest
  ): Promise<ApiKey> {
    // Generate unique key ID
    const keyId = crypto.randomUUID();

    // Create JWT token as API key
    const payload = {
      keyId,
      tenantId,
      userId,
      name: data.name,
      permissions: data.permissions,
      iat: Math.floor(Date.now() / 1000),
      ...(data.expiresAt && { exp: Math.floor(data.expiresAt.getTime() / 1000) }),
    };

    const apiKey = jwt.sign(payload, this.API_KEY_SECRET);

    // Store API key in database
    const dbApiKey = await prisma.apiKey.create({
      data: {
        id: keyId,
        name: data.name,
        keyHash: this.hashApiKey(apiKey),
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        rateLimit: data.rateLimit,
        rateLimitWindow: data.rateLimitWindow,
        allowedIps: data.allowedIps,
        allowedDomains: data.allowedDomains,
        tenantId,
        userId,
        isActive: true,
      },
    });

    return {
      ...dbApiKey,
      permissions: dbApiKey.permissions as string[],
      allowedIps: dbApiKey.allowedIps as string[] | null,
      allowedDomains: dbApiKey.allowedDomains as string[] | null,
      key: apiKey, // Return the actual key only on creation
    };
  }

  /**
   * Get all API keys for a tenant
   */
  static async getApiKeys(tenantId: string): Promise<Omit<ApiKey, 'key'>[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      tenantId: key.tenantId,
      permissions: key.permissions as string[],
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      rateLimit: key.rateLimit,
      rateLimitWindow: key.rateLimitWindow,
      allowedIps: key.allowedIps as string[] | null,
      allowedDomains: key.allowedDomains as string[] | null,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  /**
   * Get API key by ID
   */
  static async getApiKeyById(tenantId: string, keyId: string): Promise<Omit<ApiKey, 'key'> | null> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        tenantId,
        isActive: true,
      },
    });

    if (!apiKey) return null;

    return {
      id: apiKey.id,
      name: apiKey.name,
      tenantId: apiKey.tenantId,
      permissions: apiKey.permissions as string[],
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      rateLimit: apiKey.rateLimit,
      rateLimitWindow: apiKey.rateLimitWindow,
      allowedIps: apiKey.allowedIps as string[] | null,
      allowedDomains: apiKey.allowedDomains as string[] | null,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  /**
   * Validate API key
   */
  static async validateApiKey(apiKey: string): Promise<ApiKey | null> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(apiKey, this.API_KEY_SECRET) as any;

      // Check if key exists in database and is active
      const dbApiKey = await prisma.apiKey.findFirst({
        where: {
          id: decoded.keyId,
          isActive: true,
        },
      });

      if (!dbApiKey) return null;

      // Check if key has expired
      if (dbApiKey.expiresAt && dbApiKey.expiresAt < new Date()) {
        await this.deactivateApiKey(dbApiKey.tenantId, dbApiKey.id);
        return null;
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: dbApiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        id: dbApiKey.id,
        name: dbApiKey.name,
        key: apiKey,
        tenantId: dbApiKey.tenantId,
        permissions: dbApiKey.permissions as string[],
        lastUsedAt: new Date(),
        expiresAt: dbApiKey.expiresAt,
        isActive: dbApiKey.isActive,
        rateLimit: dbApiKey.rateLimit,
        rateLimitWindow: dbApiKey.rateLimitWindow,
        allowedIps: dbApiKey.allowedIps as string[] | null,
        allowedDomains: dbApiKey.allowedDomains as string[] | null,
        createdAt: dbApiKey.createdAt,
        updatedAt: dbApiKey.updatedAt,
      };
    } catch (error) {
      console.error('API key validation error:', error);
      return null;
    }
  }

  /**
   * Update API key
   */
  static async updateApiKey(
    tenantId: string,
    keyId: string,
    data: Partial<Pick<CreateApiKeyRequest, 'name' | 'permissions' | 'expiresAt' | 'rateLimit' | 'rateLimitWindow' | 'allowedIps' | 'allowedDomains'>>
  ): Promise<Omit<ApiKey, 'key'> | null> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        tenantId,
        isActive: true,
      },
    });

    if (!apiKey) return null;

    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      tenantId: updatedKey.tenantId,
      permissions: updatedKey.permissions as string[],
      lastUsedAt: updatedKey.lastUsedAt,
      expiresAt: updatedKey.expiresAt,
      isActive: updatedKey.isActive,
      rateLimit: updatedKey.rateLimit,
      rateLimitWindow: updatedKey.rateLimitWindow,
      allowedIps: updatedKey.allowedIps as string[] | null,
      allowedDomains: updatedKey.allowedDomains as string[] | null,
      createdAt: updatedKey.createdAt,
      updatedAt: updatedKey.updatedAt,
    };
  }

  /**
   * Deactivate API key
   */
  static async deactivateApiKey(tenantId: string, keyId: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        tenantId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Delete API key permanently
   */
  static async deleteApiKey(tenantId: string, keyId: string): Promise<boolean> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        id: keyId,
        tenantId,
      },
    });

    return result.count > 0;
  }

  /**
   * Log API key usage
   */
  static async logApiKeyUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      requestSize?: number;
      responseSize?: number;
    }
  ): Promise<void> {
    try {
      await prisma.apiKeyUsage.create({
        data: {
          apiKeyId,
          endpoint,
          method,
          statusCode,
          responseTime,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          requestSize: metadata?.requestSize,
          responseSize: metadata?.responseSize,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log API key usage:', error);
    }
  }

  /**
   * Get API key usage statistics
   */
  static async getApiKeyUsage(
    tenantId: string,
    keyId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsByEndpoint: Record<string, number>;
    requestsByDay: Array<{ date: string; count: number }>;
  }> {
    const whereClause: any = {
      apiKey: {
        tenantId,
      },
    };

    if (keyId) {
      whereClause.apiKeyId = keyId;
    }

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp.gte = startDate;
      if (endDate) whereClause.timestamp.lte = endDate;
    }

    // Get usage statistics
    const [totalRequests, successfulRequests, failedRequests, avgResponseTime] = await Promise.all([
      prisma.apiKeyUsage.count({ where: whereClause }),
      prisma.apiKeyUsage.count({
        where: {
          ...whereClause,
          statusCode: { gte: 200, lt: 400 },
        },
      }),
      prisma.apiKeyUsage.count({
        where: {
          ...whereClause,
          statusCode: { gte: 400 },
        },
      }),
      prisma.apiKeyUsage.aggregate({
        where: whereClause,
        _avg: { responseTime: true },
      }),
    ]);

    // Get requests by endpoint
    const endpointStats = await prisma.apiKeyUsage.groupBy({
      by: ['endpoint'],
      where: whereClause,
      _count: { endpoint: true },
    });

    const requestsByEndpoint = endpointStats.reduce((acc, stat) => {
      acc[stat.endpoint] = stat._count.endpoint;
      return acc;
    }, {} as Record<string, number>);

    // Get requests by day
    const dailyStats = await prisma.apiKeyUsage.groupBy({
      by: ['timestamp'],
      where: whereClause,
      _count: { timestamp: true },
    });

    const requestsByDay = dailyStats.map(stat => ({
      date: stat.timestamp.toISOString().split('T')[0],
      count: stat._count.timestamp,
    }));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: avgResponseTime._avg.responseTime || 0,
      requestsByEndpoint,
      requestsByDay,
    };
  }

  /**
   * Hash API key for storage
   */
  private static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Check if API key has permission
   */
  static hasPermission(apiKey: ApiKey, permission: string): boolean {
    return apiKey.permissions.includes('*') || apiKey.permissions.includes(permission);
  }

  /**
   * Validate IP address against allowed IPs
   */
  static validateIpAddress(apiKey: ApiKey, clientIp: string): boolean {
    if (!apiKey.allowedIps || apiKey.allowedIps.length === 0) {
      return true; // No IP restrictions
    }

    return apiKey.allowedIps.some(allowedIp => {
      // Support CIDR notation and exact IP matching
      if (allowedIp.includes('/')) {
        // CIDR notation - simplified check (in production, use a proper CIDR library)
        const [network, prefixLength] = allowedIp.split('/');
        // For now, just check if the network part matches
        return clientIp.startsWith(network.split('.').slice(0, Math.ceil(parseInt(prefixLength) / 8)).join('.'));
      } else {
        // Exact IP match
        return clientIp === allowedIp;
      }
    });
  }

  /**
   * Validate domain against allowed domains
   */
  static validateDomain(apiKey: ApiKey, requestDomain: string): boolean {
    if (!apiKey.allowedDomains || apiKey.allowedDomains.length === 0) {
      return true; // No domain restrictions
    }

    return apiKey.allowedDomains.some(allowedDomain => {
      // Support wildcard domains
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        return requestDomain.endsWith(baseDomain);
      } else {
        return requestDomain === allowedDomain;
      }
    });
  }

  /**
   * Check API key rate limit
   */
  static async checkRateLimit(apiKey: ApiKey, clientIp: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    if (!apiKey.rateLimit) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const window = (apiKey.rateLimitWindow || 60) * 1000; // Convert to milliseconds
    const now = Date.now();
    const windowStart = now - window;

    // Count recent requests
    const recentRequests = await prisma.apiKeyUsage.count({
      where: {
        apiKeyId: apiKey.id,
        timestamp: { gte: new Date(windowStart) },
        ...(clientIp && { ipAddress: clientIp }),
      },
    });

    const remaining = Math.max(0, apiKey.rateLimit - recentRequests);
    const allowed = recentRequests < apiKey.rateLimit;
    const resetTime = Math.ceil((now + window) / 1000);

    return { allowed, remaining, resetTime };
  }

  /**
   * Get available permissions
   */
  static getAvailablePermissions(): Array<{ key: string; label: string; description: string }> {
    return [
      { key: '*', label: 'Full Access', description: 'Complete access to all API endpoints' },
      { key: 'campaigns:read', label: 'Read Campaigns', description: 'View campaign data' },
      {
        key: 'campaigns:write',
        label: 'Write Campaigns',
        description: 'Create and modify campaigns',
      },
      { key: 'campaigns:delete', label: 'Delete Campaigns', description: 'Delete campaigns' },
      { key: 'subscribers:read', label: 'Read Subscribers', description: 'View subscriber data' },
      {
        key: 'subscribers:write',
        label: 'Write Subscribers',
        description: 'Create and modify subscribers',
      },
      { key: 'subscribers:delete', label: 'Delete Subscribers', description: 'Delete subscribers' },
      { key: 'lists:read', label: 'Read Lists', description: 'View list data' },
      { key: 'lists:write', label: 'Write Lists', description: 'Create and modify lists' },
      { key: 'lists:delete', label: 'Delete Lists', description: 'Delete lists' },
      { key: 'segments:read', label: 'Read Segments', description: 'View segment data' },
      { key: 'segments:write', label: 'Write Segments', description: 'Create and modify segments' },
      { key: 'automations:read', label: 'Read Automations', description: 'View automation data' },
      {
        key: 'automations:write',
        label: 'Write Automations',
        description: 'Create and modify automations',
      },
      { key: 'analytics:read', label: 'Read Analytics', description: 'View analytics and reports' },
      { key: 'forms:read', label: 'Read Forms', description: 'View form data' },
      { key: 'forms:write', label: 'Write Forms', description: 'Create and modify forms' },
      { key: 'webhooks:read', label: 'Read Webhooks', description: 'View webhook configurations' },
      { key: 'webhooks:write', label: 'Write Webhooks', description: 'Create and modify webhooks' },
    ];
  }
}
