import { OAuthService } from '../oauth.service';
import { UserService } from '../user.service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock UserService
jest.mock('../user.service');

describe('OAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOAuthAccount', () => {
    it('should find OAuth account by provider and provider account ID', async () => {
      const mockAccount = {
        id: 'account-1',
        provider: 'google',
        providerAccountId: 'google-123',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tenant: { id: 'tenant-1', name: 'Test Tenant' },
        },
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);

      const result = await OAuthService.findOAuthAccount('google', 'google-123');

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: 'google-123',
          },
        },
        include: {
          user: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should return null if account not found', async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await OAuthService.findOAuthAccount('google', 'google-123');

      expect(result).toBeNull();
    });
  });

  describe('linkOAuthAccount', () => {
    it('should create new OAuth account link', async () => {
      const userId = 'user-1';
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 3600,
      };
      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
      };

      const mockCreatedAccount = {
        id: 'account-1',
        userId,
        ...accountData,
        email: profile.email,
        name: profile.name,
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.account.create as jest.Mock).mockResolvedValue(mockCreatedAccount);

      const result = await OAuthService.linkOAuthAccount(userId, accountData, profile);

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: accountData.type,
          provider: accountData.provider,
          providerAccountId: accountData.providerAccountId,
          access_token: accountData.access_token,
          refresh_token: accountData.refresh_token,
          expires_at: accountData.expires_at,
          token_type: undefined,
          scope: undefined,
          id_token: undefined,
          session_state: undefined,
          email: profile.email,
          name: profile.name,
          image: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockCreatedAccount);
    });

    it('should update existing OAuth account', async () => {
      const userId = 'user-1';
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
        access_token: 'new-access-token',
      };
      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
      };

      const existingAccount = {
        id: 'account-1',
        userId,
        provider: 'google',
        providerAccountId: 'google-123',
      };

      const updatedAccount = {
        ...existingAccount,
        access_token: 'new-access-token',
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(existingAccount);
      (prisma.account.update as jest.Mock).mockResolvedValue(updatedAccount);

      const result = await OAuthService.linkOAuthAccount(userId, accountData, profile);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: existingAccount.id },
        data: expect.objectContaining({
          access_token: 'new-access-token',
          email: profile.email,
          name: profile.name,
          lastUsedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(updatedAccount);
    });

    it('should throw error if account is linked to another user', async () => {
      const userId = 'user-1';
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
      };
      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        provider: 'google',
      };

      const existingAccount = {
        id: 'account-1',
        userId: 'different-user',
        provider: 'google',
        providerAccountId: 'google-123',
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(existingAccount);

      const result = await OAuthService.linkOAuthAccount(userId, accountData, profile);

      expect(result).toBeNull();
    });
  });

  describe('handleOAuthSignIn', () => {
    it('should handle existing OAuth account sign-in', async () => {
      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
      };
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
      };

      const existingAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-123',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(existingAccount);
      (UserService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (UserService.getUserTenants as jest.Mock).mockResolvedValue([mockUser.tenant]);

      const result = await OAuthService.handleOAuthSignIn(profile, accountData);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.isNewUser).toBe(false);
    });

    it('should handle new user OAuth sign-in with tenant', async () => {
      const profile = {
        id: 'google-123',
        email: 'newuser@example.com',
        name: 'New User',
        provider: 'google',
      };
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
      };
      const tenantId = 'tenant-1';

      const mockNewUser = {
        id: 'user-2',
        email: 'newuser@example.com',
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);
      (UserService.findUserByEmail as jest.Mock).mockResolvedValue([]);
      (UserService.createUserTenantMapping as jest.Mock).mockResolvedValue(mockNewUser);
      (prisma.account.create as jest.Mock).mockResolvedValue({
        id: 'account-2',
        userId: 'user-2',
      });

      const result = await OAuthService.handleOAuthSignIn(profile, accountData, tenantId);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockNewUser);
      expect(result.isNewUser).toBe(true);
    });

    it('should fail for new user without tenant context', async () => {
      const profile = {
        id: 'google-123',
        email: 'newuser@example.com',
        provider: 'google',
      };
      const accountData = {
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
      };

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);
      (UserService.findUserByEmail as jest.Mock).mockResolvedValue([]);

      const result = await OAuthService.handleOAuthSignIn(profile, accountData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context required for new user registration');
    });
  });

  describe('unlinkOAuthAccount', () => {
    it('should unlink OAuth account by marking as inactive', async () => {
      const userId = 'user-1';
      const provider = 'google';

      const existingAccount = {
        id: 'account-1',
        userId,
        provider,
        isActive: true,
      };

      (prisma.account.findFirst as jest.Mock).mockResolvedValue(existingAccount);
      (prisma.account.update as jest.Mock).mockResolvedValue({
        ...existingAccount,
        isActive: false,
      });

      const result = await OAuthService.unlinkOAuthAccount(userId, provider);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: existingAccount.id },
        data: { isActive: false },
      });
      expect(result).toBe(true);
    });

    it('should return false if account not found', async () => {
      const userId = 'user-1';
      const provider = 'google';

      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await OAuthService.unlinkOAuthAccount(userId, provider);

      expect(result).toBe(false);
    });
  });
});