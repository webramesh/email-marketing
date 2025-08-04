import { PasswordSecurityService } from '../password-security.service';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('PasswordSecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength(
        'MyStr0ng!P@ssw0rd123',
        { email: 'test@example.com', name: 'Test User' }
      );

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject a weak password', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength('weak', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(30);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should reject common passwords', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength('password123', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain(
        'Password is too common. Please choose a more unique password'
      );
    });

    it('should reject passwords containing personal information', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength('TestUser123!', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password should not contain personal information');
    });

    it('should detect sequential characters', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength('MyPassword123456!', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.warnings).toContain('Avoid sequential characters');
    });

    it('should detect repeating characters', async () => {
      const result = await PasswordSecurityService.validatePasswordStrength('MyPasswordaaa!', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.warnings).toContain('Avoid repeating characters');
    });
  });

  describe('checkPasswordHistory', () => {
    it('should detect password reuse', async () => {
      const userId = 'user-123';
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      (mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>)
        .mockResolvedValueOnce({
          tenantId: 'tenant-123',
        } as any)
        .mockResolvedValueOnce({
          password: hashedPassword, // Current password matches the new password
        } as any);

      (
        mockPrisma.passwordHistory.findMany as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.findMany
        >
      ).mockResolvedValue([]);

      const result = await PasswordSecurityService.checkPasswordHistory(userId, password);

      expect(result).toBe(true);
    });

    it('should allow new passwords', async () => {
      const userId = 'user-123';
      const password = 'NewPassword123!';
      const oldHashedPassword = await bcrypt.hash('OldPassword123!', 12);

      (mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>)
        .mockResolvedValueOnce({
          tenantId: 'tenant-123',
        } as any)
        .mockResolvedValueOnce({
          password: oldHashedPassword,
        } as any);

      (
        mockPrisma.passwordHistory.findMany as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.findMany
        >
      ).mockResolvedValue([{ passwordHash: oldHashedPassword }] as any);

      const result = await PasswordSecurityService.checkPasswordHistory(userId, password);

      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password with valid input', async () => {
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewStr0ng!P@ssw0rd456';
      const hashedCurrentPassword = await bcrypt.hash(currentPassword, 12);

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        password: hashedCurrentPassword,
        tenantId: 'tenant-123',
        email: 'test@example.com',
        name: 'Test User',
        firstName: null,
        lastName: null,
        isCompromised: false,
        mustChangePassword: false,
      } as any);

      (
        mockPrisma.passwordHistory.findMany as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.findMany
        >
      ).mockResolvedValue([]);
      (
        mockPrisma.user.update as jest.MockedFunction<typeof mockPrisma.user.update>
      ).mockResolvedValue({} as any);
      (
        mockPrisma.passwordHistory.create as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.create
        >
      ).mockResolvedValue({} as any);

      const result = await PasswordSecurityService.changePassword(
        userId,
        currentPassword,
        newPassword,
        { ipAddress: '127.0.0.1', userAgent: 'test' }
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          mustChangePassword: false,
          isCompromised: false,
          compromisedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      });
    });

    it('should reject incorrect current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'WrongPassword';
      const newPassword = 'NewStr0ng!P@ssw0rd456';
      const hashedCurrentPassword = await bcrypt.hash('CorrectPassword123!', 12);

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        password: hashedCurrentPassword,
        tenantId: 'tenant-123',
        email: 'test@example.com',
        name: 'Test User',
        firstName: null,
        lastName: null,
        isCompromised: false,
        mustChangePassword: false,
      } as any);

      const result = await PasswordSecurityService.changePassword(
        userId,
        currentPassword,
        newPassword,
        { ipAddress: '127.0.0.1', userAgent: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should allow forced password change without current password verification', async () => {
      const userId = 'user-123';
      const currentPassword = '';
      const newPassword = 'NewStr0ng!P@ssw0rd456';

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        password: 'any-hash',
        tenantId: 'tenant-123',
        email: 'test@example.com',
        name: 'Test User',
        firstName: null,
        lastName: null,
        isCompromised: false,
        mustChangePassword: true, // Forced change
      } as any);

      (
        mockPrisma.passwordHistory.findMany as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.findMany
        >
      ).mockResolvedValue([]);
      (
        mockPrisma.user.update as jest.MockedFunction<typeof mockPrisma.user.update>
      ).mockResolvedValue({} as any);
      (
        mockPrisma.passwordHistory.create as jest.MockedFunction<
          typeof mockPrisma.passwordHistory.create
        >
      ).mockResolvedValue({} as any);

      const result = await PasswordSecurityService.changePassword(
        userId,
        currentPassword,
        newPassword,
        { ipAddress: '127.0.0.1', userAgent: 'test' }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('handleFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      const userId = 'user-123';

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        failedLoginAttempts: 2,
        tenantId: 'tenant-123',
      } as any);

      (
        mockPrisma.user.update as jest.MockedFunction<typeof mockPrisma.user.update>
      ).mockResolvedValue({} as any);

      const result = await PasswordSecurityService.handleFailedLogin(userId);

      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(2); // 5 max - 3 attempts = 2 remaining
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 3,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should lock account after max failed attempts', async () => {
      const userId = 'user-123';

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        failedLoginAttempts: 4, // One less than max (5)
        tenantId: 'tenant-123',
      } as any);

      (
        mockPrisma.user.update as jest.MockedFunction<typeof mockPrisma.user.update>
      ).mockResolvedValue({} as any);

      const result = await PasswordSecurityService.handleFailedLogin(userId);

      expect(result.isLocked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('isPasswordExpired', () => {
    it('should detect expired password', async () => {
      const userId = 'user-123';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        passwordExpiresAt: pastDate,
        mustChangePassword: false,
      } as any);

      const result = await PasswordSecurityService.isPasswordExpired(userId);

      expect(result).toBe(true);
    });

    it('should detect forced password change', async () => {
      const userId = 'user-123';

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        passwordExpiresAt: null,
        mustChangePassword: true,
      } as any);

      const result = await PasswordSecurityService.isPasswordExpired(userId);

      expect(result).toBe(true);
    });

    it('should return false for valid password', async () => {
      const userId = 'user-123';
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      (
        mockPrisma.user.findUnique as jest.MockedFunction<typeof mockPrisma.user.findUnique>
      ).mockResolvedValue({
        passwordExpiresAt: futureDate,
        mustChangePassword: false,
      } as any);

      const result = await PasswordSecurityService.isPasswordExpired(userId);

      expect(result).toBe(false);
    });
  });

  describe('markPasswordAsCompromised', () => {
    it('should mark password as compromised and create security event', async () => {
      const userId = 'user-123';
      const reason = 'Found in data breach';

      (
        mockPrisma.user.update as jest.MockedFunction<typeof mockPrisma.user.update>
      ).mockResolvedValue({} as any);
      (
        mockPrisma.securityEvent.create as jest.MockedFunction<
          typeof mockPrisma.securityEvent.create
        >
      ).mockResolvedValue({} as any);

      await PasswordSecurityService.markPasswordAsCompromised(userId, reason);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isCompromised: true,
          compromisedAt: expect.any(Date),
          mustChangePassword: true,
          updatedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          userId,
          eventType: 'PASSWORD_RESET_REQUEST',
          severity: 'HIGH',
          description: `Password marked as compromised: ${reason}`,
          metadata: { reason },
        },
      });
    });
  });
});
