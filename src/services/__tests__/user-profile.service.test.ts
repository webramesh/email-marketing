import { UserProfileService } from '../user-profile.service';
import { ProfileChangeType } from '@/generated/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userProfileHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sessionActivity: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock session management
jest.mock('@/lib/session-management', () => ({
  invalidateAllUserSessions: jest.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { invalidateAllUserSessions } from '@/lib/session-management';

// Get the mocked instances
const mockPrisma = jest.mocked(prisma);
const mockInvalidateAllUserSessions = jest.mocked(invalidateAllUserSessions);

// Create explicit bcrypt mocks to avoid TypeScript issues
const mockBcryptCompare = jest.fn();
const mockBcryptHash = jest.fn();

// Override the mocked bcrypt with our explicit mocks
(bcrypt.compare as jest.Mock) = mockBcryptCompare;
(bcrypt.hash as jest.Mock) = mockBcryptHash;

describe('UserProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile with tenant information', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        tenant: {
          id: 'tenant-1',
          name: 'Test Tenant',
          subdomain: 'test',
          customDomain: null,
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await UserProfileService.getUserProfile('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await UserProfileService.getUserProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const mockCurrentUser = {
      id: 'user-1',
      firstName: 'Old',
      lastName: 'Name',
      bio: 'Old bio',
      emailNotifications: { campaigns: true, system: true, security: true },
      pushNotifications: true,
      smsNotifications: false,
    };

    const mockContext = {
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should update profile and track changes', async () => {
      const profileData = {
        firstName: 'New',
        lastName: 'Name',
        bio: 'New bio',
      };

      const updatedUser = { ...mockCurrentUser, ...profileData };

      mockPrisma.user.findUnique.mockResolvedValue(mockCurrentUser as any);
      mockPrisma.user.update.mockResolvedValue(updatedUser as any);
      mockPrisma.userProfileHistory.create.mockResolvedValue({} as any);

      const result = await UserProfileService.updateProfile('user-1', profileData, mockContext);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'New',
          bio: 'New bio',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.userProfileHistory.create).toHaveBeenCalledTimes(2);
    });

    it('should return success without changes if no fields changed', async () => {
      const profileData = {
        firstName: 'Old',
        lastName: 'Name',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockCurrentUser as any);

      const result = await UserProfileService.updateProfile('user-1', profileData, mockContext);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockCurrentUser);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.userProfileHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const mockUser = {
      id: 'user-1',
      password: 'hashed-old-password',
    };

    const mockContext = {
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should change password successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockBcryptCompare.mockResolvedValue(true);
      mockBcryptHash.mockResolvedValue('hashed-new-password');
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.userProfileHistory.create.mockResolvedValue({} as any);

      const result = await UserProfileService.changePassword(
        'user-1',
        'old-password',
        'new-password',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockBcryptCompare).toHaveBeenCalledWith('old-password', 'hashed-old-password');
      expect(mockBcryptHash).toHaveBeenCalledWith('new-password', 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'hashed-new-password',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.userProfileHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          changeType: ProfileChangeType.PASSWORD_CHANGE,
          fieldName: 'password',
          oldValue: '[REDACTED]',
          newValue: '[REDACTED]',
          changedBy: undefined,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        },
      });
    });

    it('should fail if current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockBcryptCompare.mockResolvedValue(false);

      const result = await UserProfileService.changePassword(
        'user-1',
        'wrong-password',
        'new-password',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivateAccount', () => {
    const mockContext = {
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should deactivate account and invalidate sessions', async () => {
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.userProfileHistory.create.mockResolvedValue({} as any);
      mockInvalidateAllUserSessions.mockResolvedValue(2);

      const result = await UserProfileService.deactivateAccount(
        'user-1',
        'User requested deactivation',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
          deactivationReason: 'User requested deactivation',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.userProfileHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          changeType: ProfileChangeType.ACCOUNT_DEACTIVATION,
          fieldName: 'isActive',
          oldValue: 'true',
          newValue: 'false',
          changedBy: undefined,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: { reason: 'User requested deactivation' },
        },
      });
      expect(mockInvalidateAllUserSessions).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getActivityTimeline', () => {
    it('should return combined activity timeline', async () => {
      const mockProfileChanges = [
        {
          id: 'change-1',
          changeType: 'PROFILE_UPDATE',
          fieldName: 'firstName',
          oldValue: 'Old',
          newValue: 'New',
          ipAddress: '127.0.0.1',
          createdAt: new Date('2023-01-01'),
          metadata: null,
        },
      ];

      const mockLoginActivities = [
        {
          id: 'activity-1',
          action: 'login',
          ipAddress: '127.0.0.1',
          location: { city: 'New York', country: 'US' },
          metadata: null,
          createdAt: new Date('2023-01-02'),
        },
      ];

      mockPrisma.userProfileHistory.findMany.mockResolvedValue(mockProfileChanges as any);
      mockPrisma.sessionActivity.findMany.mockResolvedValue(mockLoginActivities as any);

      const result = await UserProfileService.getActivityTimeline('user-1', 50, 0);

      expect(result.activities).toHaveLength(2);
      expect(result.activities[0].type).toBe('login_activity');
      expect(result.activities[0].description).toBe('Signed in');
      expect(result.activities[1].type).toBe('profile_change');
      expect(result.activities[1].description).toBe('Updated first name');
      expect(result.total).toBe(2);
    });
  });
});
