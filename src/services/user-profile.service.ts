import { prisma } from '@/lib/prisma';
import { User, ProfileChangeType } from '@/generated/prisma';
import bcrypt from 'bcryptjs';

export interface UserProfileData {
  firstName?: string;
  lastName?: string;
  name?: string;
  bio?: string;
  phoneNumber?: string;
  timezone?: string;
  language?: string;
  dateFormat?: string;
  timeFormat?: string;
  emailNotifications?: {
    campaigns: boolean;
    system: boolean;
    security: boolean;
  };
  pushNotifications?: boolean;
  smsNotifications?: boolean;
}

export interface ProfileUpdateContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  changedBy?: string; // For admin changes
}

/**
 * User Profile Service
 * Handles user profile management, preferences, and history tracking
 */
export class UserProfileService {
  /**
   * Get user profile with full details
   */
  static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              customDomain: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile with change tracking
   */
  static async updateProfile(
    userId: string,
    profileData: UserProfileData,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Get current user data for comparison
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      // Prepare update data
      const updateData: any = {};
      const changes: Array<{
        fieldName: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      // Track profile field changes
      const profileFields = [
        'firstName',
        'lastName',
        'name',
        'bio',
        'phoneNumber',
        'timezone',
        'language',
        'dateFormat',
        'timeFormat',
      ] as const;

      profileFields.forEach(field => {
        if (profileData[field] !== undefined) {
          const oldValue = currentUser[field];
          const newValue = profileData[field];

          if (oldValue !== newValue) {
            updateData[field] = newValue;
            changes.push({
              fieldName: field,
              oldValue: oldValue || null,
              newValue: newValue || null,
            });
          }
        }
      });

      // Handle notification preferences
      if (profileData.emailNotifications) {
        const oldNotifications = currentUser.emailNotifications as any;
        const newNotifications = profileData.emailNotifications;

        if (JSON.stringify(oldNotifications) !== JSON.stringify(newNotifications)) {
          updateData.emailNotifications = newNotifications;
          changes.push({
            fieldName: 'emailNotifications',
            oldValue: JSON.stringify(oldNotifications),
            newValue: JSON.stringify(newNotifications),
          });
        }
      }

      if (profileData.pushNotifications !== undefined) {
        if (currentUser.pushNotifications !== profileData.pushNotifications) {
          updateData.pushNotifications = profileData.pushNotifications;
          changes.push({
            fieldName: 'pushNotifications',
            oldValue: String(currentUser.pushNotifications),
            newValue: String(profileData.pushNotifications),
          });
        }
      }

      if (profileData.smsNotifications !== undefined) {
        if (currentUser.smsNotifications !== profileData.smsNotifications) {
          updateData.smsNotifications = profileData.smsNotifications;
          changes.push({
            fieldName: 'smsNotifications',
            oldValue: String(currentUser.smsNotifications),
            newValue: String(profileData.smsNotifications),
          });
        }
      }

      if (changes.length === 0) {
        return { success: true, user: currentUser };
      }

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      // Record profile changes in history
      await Promise.all(
        changes.map(change =>
          prisma.userProfileHistory.create({
            data: {
              userId,
              changeType: ProfileChangeType.PROFILE_UPDATE,
              fieldName: change.fieldName,
              oldValue: change.oldValue,
              newValue: change.newValue,
              changedBy: context.changedBy,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
          })
        )
      );

      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  }

  /**
   * Upload and update profile picture
   */
  static async updateProfilePicture(
    userId: string,
    pictureUrl: string,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePicture: true },
      });

      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          profilePicture: pictureUrl,
          updatedAt: new Date(),
        },
      });

      // Record profile picture change
      await prisma.userProfileHistory.create({
        data: {
          userId,
          changeType: ProfileChangeType.PROFILE_PICTURE_UPLOAD,
          fieldName: 'profilePicture',
          oldValue: currentUser.profilePicture,
          newValue: pictureUrl,
          changedBy: context.changedBy,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating profile picture:', error);
      return { success: false, error: 'Failed to update profile picture' };
    }
  }

  /**
   * Remove profile picture
   */
  static async removeProfilePicture(
    userId: string,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePicture: true },
      });

      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          profilePicture: null,
          updatedAt: new Date(),
        },
      });

      // Record profile picture removal
      await prisma.userProfileHistory.create({
        data: {
          userId,
          changeType: ProfileChangeType.PROFILE_PICTURE_REMOVE,
          fieldName: 'profilePicture',
          oldValue: currentUser.profilePicture,
          newValue: null,
          changedBy: context.changedBy,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error removing profile picture:', error);
      return { success: false, error: 'Failed to remove profile picture' };
    }
  }

  /**
   * Change user password with enhanced security
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const { PasswordSecurityService } = await import('./password-security.service');
      
      // Use the enhanced password security service
      const result = await PasswordSecurityService.changePassword(
        userId,
        currentPassword,
        newPassword,
        {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          changedBy: context.changedBy,
        }
      );

      if (result.success) {
        // Record password change in profile history
        await prisma.userProfileHistory.create({
          data: {
            userId,
            changeType: ProfileChangeType.PASSWORD_CHANGE,
            fieldName: 'password',
            oldValue: '[REDACTED]',
            newValue: '[REDACTED]',
            changedBy: context.changedBy,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      }

      return result;
    } catch (error) {
      console.error('Error changing password:', error);
      return { success: false, error: 'Failed to change password' };
    }
  }

  /**
   * Deactivate user account
   */
  static async deactivateAccount(
    userId: string,
    reason: string,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: reason,
          updatedAt: new Date(),
        },
      });

      // Record account deactivation
      await prisma.userProfileHistory.create({
        data: {
          userId,
          changeType: ProfileChangeType.ACCOUNT_DEACTIVATION,
          fieldName: 'isActive',
          oldValue: 'true',
          newValue: 'false',
          changedBy: context.changedBy,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { reason },
        },
      });

      // Invalidate all user sessions
      const { invalidateAllUserSessions } = await import('@/lib/session-management');
      await invalidateAllUserSessions(userId);

      return { success: true };
    } catch (error) {
      console.error('Error deactivating account:', error);
      return { success: false, error: 'Failed to deactivate account' };
    }
  }

  /**
   * Reactivate user account
   */
  static async reactivateAccount(
    userId: string,
    context: ProfileUpdateContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          reactivatedAt: new Date(),
          deactivationReason: null,
          updatedAt: new Date(),
        },
      });

      // Record account reactivation
      await prisma.userProfileHistory.create({
        data: {
          userId,
          changeType: ProfileChangeType.ACCOUNT_REACTIVATION,
          fieldName: 'isActive',
          oldValue: 'false',
          newValue: 'true',
          changedBy: context.changedBy,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error reactivating account:', error);
      return { success: false, error: 'Failed to reactivate account' };
    }
  }

  /**
   * Get user profile history
   */
  static async getProfileHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    history: Array<{
      id: string;
      changeType: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string | null;
      ipAddress: string | null;
      createdAt: Date;
      metadata?: any;
    }>;
    total: number;
  }> {
    try {
      const [history, total] = await Promise.all([
        prisma.userProfileHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            changeType: true,
            fieldName: true,
            oldValue: true,
            newValue: true,
            changedBy: true,
            ipAddress: true,
            createdAt: true,
            metadata: true,
          },
        }),
        prisma.userProfileHistory.count({
          where: { userId },
        }),
      ]);

      return { history, total };
    } catch (error) {
      console.error('Error getting profile history:', error);
      return { history: [], total: 0 };
    }
  }

  /**
   * Get user login history from session activities
   */
  static async getLoginHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    history: Array<{
      id: string;
      action: string;
      ipAddress: string;
      userAgent: string | null;
      location: any;
      riskScore: number | null;
      isBlocked: boolean;
      createdAt: Date;
      session?: {
        deviceName: string | null;
        deviceType: string | null;
        browser: string | null;
        os: string | null;
      };
    }>;
    total: number;
  }> {
    try {
      const [historyData, total] = await Promise.all([
        prisma.sessionActivity.findMany({
          where: {
            userId,
            action: {
              in: ['login', 'logout', 'session_created', 'session_terminated'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            session: {
              select: {
                deviceName: true,
                deviceType: true,
                browser: true,
                os: true,
              },
            },
          },
        }),
        prisma.sessionActivity.count({
          where: {
            userId,
            action: {
              in: ['login', 'logout', 'session_created', 'session_terminated'],
            },
          },
        }),
      ]);

      const history = historyData.map(item => ({
        ...item,
        session: item.session || undefined,
      }));

      return { history, total };
    } catch (error) {
      console.error('Error getting login history:', error);
      return { history: [], total: 0 };
    }
  }

  /**
   * Get user activity timeline (combined profile changes and login activities)
   */
  static async getActivityTimeline(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    activities: Array<{
      id: string;
      type: 'profile_change' | 'login_activity';
      action: string;
      description: string;
      ipAddress: string | null;
      location?: any;
      metadata?: any;
      createdAt: Date;
    }>;
    total: number;
  }> {
    try {
      // Get profile changes
      const profileChanges = await prisma.userProfileHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          changeType: true,
          fieldName: true,
          oldValue: true,
          newValue: true,
          ipAddress: true,
          createdAt: true,
          metadata: true,
        },
      });

      // Get login activities
      const loginActivities = await prisma.sessionActivity.findMany({
        where: {
          userId,
          action: {
            in: ['login', 'logout', 'session_created', 'session_terminated', 'failed_login'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          ipAddress: true,
          location: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Combine and sort activities
      const activities = [
        ...profileChanges.map(change => ({
          id: change.id,
          type: 'profile_change' as const,
          action: change.changeType,
          description: this.getProfileChangeDescription(change),
          ipAddress: change.ipAddress,
          metadata: change.metadata,
          createdAt: change.createdAt,
        })),
        ...loginActivities.map(activity => ({
          id: activity.id,
          type: 'login_activity' as const,
          action: activity.action,
          description: this.getLoginActivityDescription(activity.action),
          ipAddress: activity.ipAddress,
          location: activity.location,
          metadata: activity.metadata,
          createdAt: activity.createdAt,
        })),
      ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      const total = profileChanges.length + loginActivities.length;

      return { activities, total };
    } catch (error) {
      console.error('Error getting activity timeline:', error);
      return { activities: [], total: 0 };
    }
  }

  /**
   * Helper method to generate profile change descriptions
   */
  private static getProfileChangeDescription(change: any): string {
    switch (change.changeType) {
      case 'PROFILE_UPDATE':
        return `Updated ${change.fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
      case 'PASSWORD_CHANGE':
        return 'Changed password';
      case 'EMAIL_CHANGE':
        return 'Changed email address';
      case 'PREFERENCES_UPDATE':
        return 'Updated preferences';
      case 'ACCOUNT_DEACTIVATION':
        return 'Account deactivated';
      case 'ACCOUNT_REACTIVATION':
        return 'Account reactivated';
      case 'PROFILE_PICTURE_UPLOAD':
        return 'Uploaded profile picture';
      case 'PROFILE_PICTURE_REMOVE':
        return 'Removed profile picture';
      default:
        return 'Profile updated';
    }
  }

  /**
   * Helper method to generate login activity descriptions
   */
  private static getLoginActivityDescription(action: string): string {
    switch (action) {
      case 'login':
        return 'Signed in';
      case 'logout':
        return 'Signed out';
      case 'session_created':
        return 'New session created';
      case 'session_terminated':
        return 'Session terminated';
      case 'failed_login':
        return 'Failed sign in attempt';
      default:
        return action.replace('_', ' ');
    }
  }
}
