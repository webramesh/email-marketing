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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: Date;
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
        tenantId,
        userId,
        isActive: true,
      },
    });

    return {
      ...dbApiKey,
      permissions: dbApiKey.permissions as string[],
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
    data: Partial<Pick<CreateApiKeyRequest, 'name' | 'permissions' | 'expiresAt'>>
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
    responseTime: number
  ): Promise<void> {
    try {
      await prisma.apiKeyUsage.create({
        data: {
          apiKeyId,
          endpoint,
          method,
          statusCode,
          responseTime,
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
