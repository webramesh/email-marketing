/**
 * JWT Refresh Service Tests
 */

import { JwtRefreshService } from '../jwt-refresh.service';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    apiKey: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Type the mocked Prisma properly
const mockPrisma = {
  refreshToken: {
    create: prisma.refreshToken.create as jest.MockedFunction<typeof prisma.refreshToken.create>,
    findFirst: prisma.refreshToken.findFirst as jest.MockedFunction<typeof prisma.refreshToken.findFirst>,
    findMany: prisma.refreshToken.findMany as jest.MockedFunction<typeof prisma.refreshToken.findMany>,
    update: prisma.refreshToken.update as jest.MockedFunction<typeof prisma.refreshToken.update>,
    updateMany: prisma.refreshToken.updateMany as jest.MockedFunction<typeof prisma.refreshToken.updateMany>,
    count: prisma.refreshToken.count as jest.MockedFunction<typeof prisma.refreshToken.count>,
    groupBy: prisma.refreshToken.groupBy as jest.MockedFunction<any>,
  },
  apiKey: {
    findFirst: prisma.apiKey.findFirst as jest.MockedFunction<typeof prisma.apiKey.findFirst>,
  },
};

// Type the mocked JWT properly
const mockJwt = {
  sign: jwt.sign as jest.MockedFunction<(payload: any, secretOrPrivateKey: any, options?: any) => string>,
  verify: jwt.verify as jest.MockedFunction<(token: string, secretOrPublicKey: any, options?: any) => any>,
};

describe('JwtRefreshService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh token pair', async () => {
      const apiKeyId = 'test-api-key-id';
      const tenantId = 'test-tenant-id';
      const userId = 'test-user-id';
      const permissions = ['campaigns:read', 'subscribers:write'];

      // Mock JWT sign
      mockJwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      // Mock Prisma operations
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'mock-jti',
        tokenHash: 'mock-hash',
        apiKeyId,
        expiresAt: new Date(),
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        deviceFingerprint: 'test-fingerprint',
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.refreshToken.findMany.mockResolvedValue([]);

      const result = await JwtRefreshService.generateTokenPair(
        apiKeyId,
        tenantId,
        userId,
        permissions,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          deviceFingerprint: 'test-fingerprint',
        }
      );

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60, // 15 minutes
        refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days
      });

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should clean up old refresh tokens', async () => {
      const apiKeyId = 'test-api-key-id';
      const tenantId = 'test-tenant-id';
      const permissions = ['campaigns:read'];

      // Mock existing tokens (more than max allowed)
      const existingTokens = Array.from({ length: 7 }, (_, i) => ({
        id: `token-${i}`,
        tokenHash: `hash-${i}`,
        apiKeyId,
        expiresAt: new Date(),
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
        ipAddress: null,
        userAgent: null,
        deviceFingerprint: null,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(),
      }));

      mockJwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      mockPrisma.refreshToken.create.mockResolvedValue(existingTokens[0]);
      mockPrisma.refreshToken.findMany.mockResolvedValue(existingTokens);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await JwtRefreshService.generateTokenPair(apiKeyId, tenantId, undefined, permissions);

      // Should revoke old tokens beyond the limit
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: expect.any(Array) },
        },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
          revokedReason: 'Exceeded maximum refresh tokens per API key',
        },
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        sub: 'api-key-id',
        tenantId: 'tenant-id',
        userId: 'user-id',
        permissions: ['campaigns:read'],
        type: 'refresh' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        jti: 'jwt-id',
      };

      const mockStoredToken = {
        id: 'jwt-id',
        tokenHash: 'token-hash',
        apiKeyId: 'api-key-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
        ipAddress: null,
        userAgent: null,
        deviceFingerprint: null,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        apiKey: {
          id: 'api-key-id',
          name: 'Test API Key',
          keyHash: 'key-hash',
          permissions: ['campaigns:read'],
          lastUsedAt: null,
          expiresAt: null,
          isActive: true,
          userId: null,
          rateLimit: null,
          rateLimitWindow: null,
          allowedIps: null,
          allowedDomains: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId: 'tenant-id',
        },
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue(mockStoredToken);
      mockJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);

      const result = await JwtRefreshService.refreshAccessToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 15 * 60,
        refreshExpiresIn: 7 * 24 * 60 * 60,
      });

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'jwt-id' },
        data: {
          lastUsedAt: expect.any(Date),
          usageCount: { increment: 1 },
        },
      });
    });

    it('should return null for invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await JwtRefreshService.refreshAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should revoke all tokens on potential reuse', async () => {
      const refreshToken = 'reused-refresh-token';
      const mockPayload = {
        sub: 'api-key-id',
        tenantId: 'tenant-id',
        permissions: ['campaigns:read'],
        type: 'refresh' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        jti: 'jwt-id',
      };

      const mockStoredToken = {
        id: 'jwt-id',
        tokenHash: 'token-hash',
        apiKeyId: 'api-key-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
        ipAddress: null,
        userAgent: null,
        deviceFingerprint: null,
        lastUsedAt: new Date(), // Token has been used before
        usageCount: 1, // Usage count > 0
        createdAt: new Date(),
        updatedAt: new Date(),
        apiKey: {
          id: 'api-key-id',
          name: 'Test API Key',
          keyHash: 'key-hash',
          permissions: ['campaigns:read'],
          lastUsedAt: null,
          expiresAt: null,
          isActive: true,
          userId: null,
          rateLimit: null,
          rateLimitWindow: null,
          allowedIps: null,
          allowedDomains: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId: 'tenant-id',
        },
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await JwtRefreshService.refreshAccessToken(refreshToken);

      expect(result).toBeNull();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          apiKeyId: 'api-key-id',
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
          revokedReason: 'Potential token reuse detected',
        },
      });
    });
  });

  describe('validateAccessToken', () => {
    it('should validate valid access token', async () => {
      const accessToken = 'valid-access-token';
      const mockPayload = {
        sub: 'api-key-id',
        tenantId: 'tenant-id',
        permissions: ['campaigns:read'],
        type: 'access' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      };

      const mockApiKey = {
        id: 'api-key-id',
        name: 'Test API Key',
        keyHash: 'key-hash',
        permissions: ['campaigns:read'],
        lastUsedAt: null,
        expiresAt: null,
        isActive: true,
        userId: null,
        rateLimit: null,
        rateLimitWindow: null,
        allowedIps: null,
        allowedDomains: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: 'tenant-id',
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockPrisma.apiKey.findFirst.mockResolvedValue(mockApiKey);

      const result = await JwtRefreshService.validateAccessToken(accessToken);

      expect(result).toEqual(mockPayload);
    });

    it('should return null for invalid access token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await JwtRefreshService.validateAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for inactive API key', async () => {
      const accessToken = 'valid-access-token';
      const mockPayload = {
        sub: 'api-key-id',
        tenantId: 'tenant-id',
        permissions: ['campaigns:read'],
        type: 'access' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockPrisma.apiKey.findFirst.mockResolvedValue(null); // API key not found or inactive

      const result = await JwtRefreshService.validateAccessToken(accessToken);

      expect(result).toBeNull();
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('should generate consistent fingerprint for same inputs', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const ipAddress = '192.168.1.1';

      const fingerprint1 = JwtRefreshService.generateDeviceFingerprint(userAgent, ipAddress);
      const fingerprint2 = JwtRefreshService.generateDeviceFingerprint(userAgent, ipAddress);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32); // MD5 hash length
    });

    it('should handle undefined inputs', () => {
      const fingerprint = JwtRefreshService.generateDeviceFingerprint();

      expect(fingerprint).toBeDefined();
      expect(fingerprint).toHaveLength(32);
    });
  });

  describe('getRefreshTokenStats', () => {
    it('should return refresh token statistics', async () => {
      const apiKeyId = 'test-api-key-id';

      mockPrisma.refreshToken.count
        .mockResolvedValueOnce(10) // totalTokens
        .mockResolvedValueOnce(5)  // activeTokens
        .mockResolvedValueOnce(3)  // revokedTokens
        .mockResolvedValueOnce(2); // expiredTokens

      mockPrisma.refreshToken.groupBy.mockResolvedValue([
        { createdAt: new Date('2023-01-01'), _count: { createdAt: 2 } },
        { createdAt: new Date('2023-01-02'), _count: { createdAt: 3 } },
      ]);

      const result = await JwtRefreshService.getRefreshTokenStats(apiKeyId);

      expect(result).toEqual({
        totalTokens: 10,
        activeTokens: 5,
        revokedTokens: 3,
        expiredTokens: 2,
        recentUsage: [
          { date: '2023-01-01', count: 2 },
          { date: '2023-01-02', count: 3 },
        ],
      });
    });
  });
});