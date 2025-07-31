import { UserService } from '@/services/user.service';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  compareSync: jest.fn(),
}));

describe('Enhanced Authentication UX', () => {
  const mockUsers = [
    {
      id: 'user1',
      email: 'test@example.com',
      password: 'hashedpassword',
      name: 'Test User',
      role: 'USER',
      tenantId: 'tenant1',
      tenant: {
        id: 'tenant1',
        name: 'Tenant One',
        subdomain: 'tenant1',
        customDomain: null,
        subscriptionPlan: null,
      },
    },
    {
      id: 'user2',
      email: 'test@example.com',
      password: 'hashedpassword',
      name: 'Test User',
      role: 'ADMIN',
      tenantId: 'tenant2',
      tenant: {
        id: 'tenant2',
        name: 'Tenant Two',
        subdomain: 'tenant2',
        customDomain: 'custom.example.com',
        subscriptionPlan: null,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserService.findUserByEmail', () => {
    it('should find users by email across all tenants', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserService.findUserByEmail('test@example.com');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
        },
        include: {
          tenant: {
            include: {
              subscriptionPlan: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when no users found', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.user.findMany.mockResolvedValue([]);

      const result = await UserService.findUserByEmail('nonexistent@example.com');

      expect(result).toEqual([]);
    });
  });

  describe('UserService.getUserTenants', () => {
    it('should return available tenants for user', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserService.getUserTenants('test@example.com');

      expect(result).toEqual([mockUsers[0].tenant, mockUsers[1].tenant]);
    });
  });

  describe('UserService.validateCredentials', () => {
    it('should validate credentials for tenant-less login', async () => {
      const bcrypt = require('bcryptjs');
      const { prisma } = require('@/lib/prisma');

      prisma.user.findMany.mockResolvedValue(mockUsers);
      bcrypt.compareSync.mockReturnValue(true);

      const result = await UserService.validateCredentials('test@example.com', 'password');

      expect(result.isValid).toBe(true);
      expect(result.user).toEqual(mockUsers[0]); // First user (most recent)
      expect(result.availableTenants).toEqual([mockUsers[0].tenant, mockUsers[1].tenant]);
    });

    it('should validate credentials for specific tenant', async () => {
      const bcrypt = require('bcryptjs');
      const { prisma } = require('@/lib/prisma');

      prisma.user.findUnique.mockResolvedValue(mockUsers[1]);
      bcrypt.compareSync.mockReturnValue(true);

      const result = await UserService.validateCredentials(
        'test@example.com',
        'password',
        'tenant2'
      );

      expect(result.isValid).toBe(true);
      expect(result.user).toEqual(mockUsers[1]);
      expect(result.availableTenants).toBeUndefined();
    });

    it('should return error for invalid password', async () => {
      const bcrypt = require('bcryptjs');
      const { prisma } = require('@/lib/prisma');

      prisma.user.findMany.mockResolvedValue(mockUsers);
      bcrypt.compareSync.mockReturnValue(false);

      const result = await UserService.validateCredentials('test@example.com', 'wrongpassword');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid password');
    });

    it('should return error for non-existent user', async () => {
      const { prisma } = require('@/lib/prisma');

      prisma.user.findMany.mockResolvedValue([]);

      const result = await UserService.validateCredentials('nonexistent@example.com', 'password');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No account found with this email address');
    });
  });

  describe('UserService.getUserPrimaryTenant', () => {
    it('should return primary tenant (most recent)', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await UserService.getUserPrimaryTenant('test@example.com');

      expect(result).toEqual(mockUsers[0]);
    });

    it('should return null when no users found', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.user.findMany.mockResolvedValue([]);

      const result = await UserService.getUserPrimaryTenant('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });
});
