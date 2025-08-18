import { UserOnboardingService } from '../user-onboarding.service';
import { prisma } from '@/lib/prisma';
import { UserRole, UserInvitationStatus, EmailVerificationStatus } from '@/generated/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailVerification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userInvitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    userOnboarding: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminCompanyVerification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      update: jest.fn(),
    },
    packagePurchase: {
      create: jest.fn(),
    },
    package: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: () => 'mock-token' })),
  createHash: jest.fn(() => ({ update: jest.fn(() => ({ digest: () => 'mock-hash' })) })),
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'hashed-password'),
}));

describe('UserOnboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmailVerification', () => {
    it('should send email verification successfully', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'verification-id',
        email: 'test@example.com',
        tokenHash: 'mock-hash',
        expiresAt: new Date(),
      });

      (prisma.emailVerification.create as jest.Mock) = mockCreate;

      const result = await UserOnboardingService.sendEmailVerification(
        'test@example.com',
        'tenant-id',
        'REGISTRATION'
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          tenantId: 'tenant-id',
          verificationType: 'REGISTRATION',
          status: EmailVerificationStatus.PENDING,
        }),
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockVerification = {
        id: 'verification-id',
        email: 'test@example.com',
        userId: 'user-id',
        verificationType: 'REGISTRATION',
      };

      (prisma.emailVerification.findFirst as jest.Mock).mockResolvedValue(mockVerification);
      (prisma.emailVerification.update as jest.Mock).mockResolvedValue(mockVerification);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await UserOnboardingService.verifyEmail('mock-token', 'tenant-id');

      expect(result.success).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(result.userId).toBe('user-id');
    });

    it('should fail with invalid token', async () => {
      (prisma.emailVerification.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await UserOnboardingService.verifyEmail('invalid-token', 'tenant-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired verification token');
    });
  });

  describe('createUserInvitation', () => {
    it('should create user invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-id',
        email: 'test@example.com',
        role: UserRole.USER,
        tenantId: 'tenant-id',
        invitedBy: 'admin-id',
      };

      (prisma.userInvitation.create as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await UserOnboardingService.createUserInvitation({
        email: 'test@example.com',
        role: UserRole.USER,
        tenantId: 'tenant-id',
        invitedBy: 'admin-id',
      });

      expect(result).toHaveProperty('invitationId', 'invitation-id');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-id',
        email: 'test@example.com',
        role: UserRole.USER,
        tenantId: 'tenant-id',
        packageId: null,
        tenant: { id: 'tenant-id', name: 'Test Tenant' },
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
      };

      (prisma.userInvitation.findFirst as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userInvitation.update as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.userOnboarding.create as jest.Mock).mockResolvedValue({
        id: 'onboarding-id',
        currentStep: 1,
        totalSteps: 3,
      });

      const result = await UserOnboardingService.acceptInvitation('mock-token', {
        name: 'Test User',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-id');
      expect(result.tenantId).toBe('tenant-id');
    });

    it('should fail with invalid invitation', async () => {
      (prisma.userInvitation.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await UserOnboardingService.acceptInvitation('invalid-token', {
        name: 'Test User',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired invitation');
    });
  });

  describe('startOnboardingFlow', () => {
    it('should start onboarding flow successfully', async () => {
      const mockOnboarding = {
        id: 'onboarding-id',
        currentStep: 1,
        totalSteps: 3,
      };

      (prisma.userOnboarding.create as jest.Mock).mockResolvedValue(mockOnboarding);

      const result = await UserOnboardingService.startOnboardingFlow(
        'user-id',
        'tenant-id',
        'USER_REGISTRATION'
      );

      expect(result.onboardingId).toBe('onboarding-id');
      expect(result.currentStep).toBe(1);
      expect(result.totalSteps).toBe(3);
    });
  });

  describe('updateOnboardingStep', () => {
    it('should update onboarding step successfully', async () => {
      const mockOnboarding = {
        id: 'onboarding-id',
        currentStep: 1,
        totalSteps: 3,
        stepData: {},
      };

      (prisma.userOnboarding.findUnique as jest.Mock).mockResolvedValue(mockOnboarding);
      (prisma.userOnboarding.update as jest.Mock).mockResolvedValue({
        ...mockOnboarding,
        currentStep: 2,
      });

      const result = await UserOnboardingService.updateOnboardingStep(
        'onboarding-id',
        { profileData: 'test' },
        true
      );

      expect(result.success).toBe(true);
      expect(result.currentStep).toBe(2);
      expect(result.isCompleted).toBe(false);
    });
  });

  describe('submitAdminCompanyVerification', () => {
    it('should submit verification request successfully', async () => {
      const mockVerification = {
        id: 'verification-id',
        tenantId: 'tenant-id',
        companyName: 'Test Company',
      };

      (prisma.adminCompanyVerification.create as jest.Mock).mockResolvedValue(mockVerification);

      const result = await UserOnboardingService.submitAdminCompanyVerification({
        tenantId: 'tenant-id',
        companyName: 'Test Company',
        businessType: 'LLC',
        contactEmail: 'admin@testcompany.com',
        businessAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US',
        },
      });

      expect(result.verificationId).toBe('verification-id');
    });
  });

  describe('processAdminCompanyVerification', () => {
    it('should approve verification successfully', async () => {
      const mockVerification = {
        id: 'verification-id',
        tenantId: 'tenant-id',
        companyName: 'Test Company',
        contactEmail: 'admin@testcompany.com',
        tenant: { id: 'tenant-id', name: 'Test Company' },
      };

      const mockUser = {
        id: 'admin-id',
        tenantId: 'tenant-id',
        role: UserRole.ADMIN,
      };

      (prisma.adminCompanyVerification.findUnique as jest.Mock).mockResolvedValue(mockVerification);
      (prisma.adminCompanyVerification.update as jest.Mock).mockResolvedValue(mockVerification);
      (prisma.tenant.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userOnboarding.create as jest.Mock).mockResolvedValue({
        id: 'onboarding-id',
        currentStep: 1,
        totalSteps: 5,
      });

      const result = await UserOnboardingService.processAdminCompanyVerification(
        'verification-id',
        'APPROVED',
        'superadmin-id',
        'Company looks good'
      );

      expect(result.success).toBe(true);
    });
  });
});