import { prisma } from '@/lib/prisma';
import { UserService } from './user.service';
import type { Account, User, Tenant } from '@/generated/prisma';

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  image?: string;
  provider: string;
}

export interface OAuthAccountData {
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

/**
 * OAuth Service
 * Handles OAuth authentication, account linking, and social login
 */
export class OAuthService {
  /**
   * Find existing OAuth account by provider and provider account ID
   */
  static async findOAuthAccount(
    provider: string,
    providerAccountId: string
  ): Promise<Account | null> {
    try {
      return await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
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
    } catch (error) {
      console.error('Error finding OAuth account:', error);
      return null;
    }
  }

  /**
   * Find user's OAuth accounts
   */
  static async getUserOAuthAccounts(userId: string): Promise<Account[]> {
    try {
      return await prisma.account.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: {
          linkedAt: 'desc',
        },
      });
    } catch (error) {
      console.error('Error getting user OAuth accounts:', error);
      return [];
    }
  }

  /**
   * Link OAuth account to existing user
   */
  static async linkOAuthAccount(
    userId: string,
    accountData: OAuthAccountData,
    profile: OAuthProfile,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<Account | null> {
    try {
      // Check if account is already linked to another user
      const existingAccount = await this.findOAuthAccount(
        accountData.provider,
        accountData.providerAccountId
      );

      if (existingAccount && existingAccount.userId !== userId) {
        throw new Error('OAuth account is already linked to another user');
      }

      if (existingAccount && existingAccount.userId === userId) {
        // Update existing account
        return await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            refresh_token: accountData.refresh_token,
            access_token: accountData.access_token,
            expires_at: accountData.expires_at,
            token_type: accountData.token_type,
            scope: accountData.scope,
            id_token: accountData.id_token,
            session_state: accountData.session_state,
            email: profile.email,
            name: profile.name,
            image: profile.image,
            lastUsedAt: new Date(),
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
          },
        });
      }

      // Create new account link
      return await prisma.account.create({
        data: {
          userId,
          type: accountData.type,
          provider: accountData.provider,
          providerAccountId: accountData.providerAccountId,
          refresh_token: accountData.refresh_token,
          access_token: accountData.access_token,
          expires_at: accountData.expires_at,
          token_type: accountData.token_type,
          scope: accountData.scope,
          id_token: accountData.id_token,
          session_state: accountData.session_state,
          email: profile.email,
          name: profile.name,
          image: profile.image,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      });
    } catch (error) {
      console.error('Error linking OAuth account:', error);
      return null;
    }
  }

  /**
   * Unlink OAuth account from user
   */
  static async unlinkOAuthAccount(
    userId: string,
    provider: string
  ): Promise<boolean> {
    try {
      const account = await prisma.account.findFirst({
        where: {
          userId,
          provider,
          isActive: true,
        },
      });

      if (!account) {
        return false;
      }

      // Soft delete by marking as inactive
      await prisma.account.update({
        where: { id: account.id },
        data: { isActive: false },
      });

      return true;
    } catch (error) {
      console.error('Error unlinking OAuth account:', error);
      return false;
    }
  }

  /**
   * Handle OAuth sign-in - either link to existing user or create new user
   */
  static async handleOAuthSignIn(
    profile: OAuthProfile,
    accountData: OAuthAccountData,
    tenantId?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{
    success: boolean;
    user?: User & { tenant: Tenant };
    availableTenants?: Tenant[];
    isNewUser?: boolean;
    error?: string;
  }> {
    try {
      // First, check if OAuth account already exists
      const existingAccount = await this.findOAuthAccount(
        accountData.provider,
        accountData.providerAccountId
      );

      if (existingAccount) {
        // Update account tokens and return user
        await this.linkOAuthAccount(
          existingAccount.userId,
          accountData,
          profile,
          metadata
        );

        const user = await UserService.getUserById(existingAccount.userId);
        if (!user) {
          return { success: false, error: 'User not found' };
        }

        // Get available tenants for the user
        const availableTenants = await UserService.getUserTenants(profile.email);

        return {
          success: true,
          user,
          availableTenants: availableTenants.length > 1 ? availableTenants : undefined,
          isNewUser: false,
        };
      }

      // Check if user exists with this email
      const existingUsers = await UserService.findUserByEmail(profile.email);

      if (existingUsers.length > 0) {
        // User exists - link OAuth account to the primary user
        const primaryUser = existingUsers[0];

        const linkedAccount = await this.linkOAuthAccount(
          primaryUser.id,
          accountData,
          profile,
          metadata
        );

        if (!linkedAccount) {
          return { success: false, error: 'Failed to link OAuth account' };
        }

        // Get available tenants
        const availableTenants = existingUsers.map(u => u.tenant);

        return {
          success: true,
          user: primaryUser,
          availableTenants: availableTenants.length > 1 ? availableTenants : undefined,
          isNewUser: false,
        };
      }

      // New user - need tenant context
      if (!tenantId) {
        return {
          success: false,
          error: 'Tenant context required for new user registration',
        };
      }

      // Create new user with OAuth account
      const bcrypt = require('bcryptjs');
      const randomPassword = bcrypt.hashSync(
        Math.random().toString(36).slice(-8),
        12
      );

      const newUser = await UserService.createUserTenantMapping(
        profile.email,
        tenantId,
        {
          name: profile.name,
          password: randomPassword,
          role: 'USER',
        }
      );

      if (!newUser) {
        return { success: false, error: 'Failed to create user' };
      }

      // Link OAuth account to new user
      const linkedAccount = await this.linkOAuthAccount(
        newUser.id,
        accountData,
        profile,
        metadata
      );

      if (!linkedAccount) {
        return { success: false, error: 'Failed to link OAuth account to new user' };
      }

      return {
        success: true,
        user: newUser,
        isNewUser: true,
      };
    } catch (error) {
      console.error('Error handling OAuth sign-in:', error);
      return { success: false, error: 'OAuth authentication failed' };
    }
  }

  /**
   * Get OAuth account by user and provider
   */
  static async getOAuthAccount(
    userId: string,
    provider: string
  ): Promise<Account | null> {
    try {
      return await prisma.account.findFirst({
        where: {
          userId,
          provider,
          isActive: true,
        },
      });
    } catch (error) {
      console.error('Error getting OAuth account:', error);
      return null;
    }
  }

  /**
   * Check if user has OAuth account for provider
   */
  static async hasOAuthAccount(
    userId: string,
    provider: string
  ): Promise<boolean> {
    const account = await this.getOAuthAccount(userId, provider);
    return !!account;
  }

  /**
   * Get all available OAuth providers for user
   */
  static async getUserOAuthProviders(userId: string): Promise<string[]> {
    try {
      const accounts = await this.getUserOAuthAccounts(userId);
      return accounts.map(account => account.provider);
    } catch (error) {
      console.error('Error getting user OAuth providers:', error);
      return [];
    }
  }

  /**
   * Update OAuth account last used timestamp
   */
  static async updateOAuthAccountUsage(
    provider: string,
    providerAccountId: string
  ): Promise<void> {
    try {
      await prisma.account.updateMany({
        where: {
          provider,
          providerAccountId,
          isActive: true,
        },
        data: {
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error updating OAuth account usage:', error);
    }
  }
}