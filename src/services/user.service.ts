import { prisma } from '@/lib/prisma';
import { User, Tenant } from '@/generated/prisma';

export interface UserWithTenant extends User {
  tenant: Tenant;
}

/**
 * User Service
 * Handles user operations including tenant-less user lookup
 */
export class UserService {
  /**
   * Find user by email across all tenants
   * Used for tenant-less login where we need to detect the user's tenant
   */
  static async findUserByEmail(email: string): Promise<UserWithTenant[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          email: email.toLowerCase().trim(),
        },
        include: {
          tenant: {
            include: {
              subscriptionPlan: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Most recent first
        },
      });

      return users;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return [];
    }
  }

  /**
   * Find user by email and tenant ID
   * Used for traditional login with tenant context
   */
  static async findUserByEmailAndTenant(
    email: string,
    tenantId: string
  ): Promise<UserWithTenant | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email_tenantId: {
            email: email.toLowerCase().trim(),
            tenantId,
          },
        },
        include: {
          tenant: {
            include: {
              subscriptionPlan: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      console.error('Error finding user by email and tenant:', error);
      return null;
    }
  }

  /**
   * Get user's available tenants
   * Returns all tenants where the user has an account
   */
  static async getUserTenants(email: string): Promise<Tenant[]> {
    try {
      const users = await this.findUserByEmail(email);
      return users.map(user => user.tenant);
    } catch (error) {
      console.error('Error getting user tenants:', error);
      return [];
    }
  }

  /**
   * Check if user exists in specific tenant
   */
  static async userExistsInTenant(email: string, tenantId: string): Promise<boolean> {
    try {
      const user = await this.findUserByEmailAndTenant(email, tenantId);
      return !!user;
    } catch (error) {
      console.error('Error checking user existence in tenant:', error);
      return false;
    }
  }

  /**
   * Get user's primary tenant (most recently created account)
   */
  static async getUserPrimaryTenant(email: string): Promise<UserWithTenant | null> {
    try {
      const users = await this.findUserByEmail(email);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error getting user primary tenant:', error);
      return null;
    }
  }

  /**
   * Create user-to-tenant mapping for automatic tenant detection
   */
  static async createUserTenantMapping(
    email: string,
    tenantId: string,
    userData: {
      name?: string;
      password: string;
      role?: 'ADMIN' | 'USER' | 'SUPPORT';
    }
  ): Promise<UserWithTenant | null> {
    try {
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: userData.name,
          password: userData.password,
          role: userData.role || 'USER',
          tenantId,
        },
        include: {
          tenant: {
            include: {
              subscriptionPlan: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      console.error('Error creating user tenant mapping:', error);
      return null;
    }
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Get user by ID with tenant information
   */
  static async getUserById(userId: string): Promise<UserWithTenant | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenant: {
            include: {
              subscriptionPlan: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Validate user credentials and return user with tenant info
   */
  static async validateCredentials(
    email: string,
    password: string,
    tenantId?: string
  ): Promise<{
    isValid: boolean;
    user?: UserWithTenant;
    availableTenants?: Tenant[];
    error?: string;
  }> {
    try {
      const bcrypt = require('bcryptjs');

      if (tenantId) {
        // Traditional login with tenant ID
        const user = await this.findUserByEmailAndTenant(email, tenantId);

        if (!user) {
          return {
            isValid: false,
            error: 'User not found in specified tenant',
          };
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);

        if (!isPasswordValid) {
          return {
            isValid: false,
            error: 'Invalid password',
          };
        }

        return {
          isValid: true,
          user,
        };
      } else {
        // Tenant-less login - find all user accounts
        const users = await this.findUserByEmail(email);

        if (users.length === 0) {
          return {
            isValid: false,
            error: 'No account found with this email address',
          };
        }

        // Check password against all user accounts
        let validUser: UserWithTenant | undefined;

        for (const user of users) {
          const isPasswordValid = bcrypt.compareSync(password, user.password);
          if (isPasswordValid) {
            validUser = user;
            break;
          }
        }

        if (!validUser) {
          return {
            isValid: false,
            error: 'Invalid password',
          };
        }

        // If user has multiple tenants, return the primary one but include available tenants
        const availableTenants = users.map(u => u.tenant);

        return {
          isValid: true,
          user: validUser,
          availableTenants: availableTenants.length > 1 ? availableTenants : undefined,
        };
      }
    } catch (error) {
      console.error('Error validating credentials:', error);
      return {
        isValid: false,
        error: 'Authentication failed',
      };
    }
  }
}
