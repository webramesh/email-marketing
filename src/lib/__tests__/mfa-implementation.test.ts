import {
  generateTOTPSetup,
  verifyTOTP,
  enableMFA,
  disableMFA,
  isMFAEnabled,
  generateEmailOTP,
  verifyEmailOTP,
  verifyMFAToken,
  getMFAStatus,
} from '../mfa';
import { PrismaClient } from '@/generated/prisma';

// Mock Prisma
jest.mock('@/generated/prisma', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn().mockImplementation(() => ({
        then: jest.fn().mockImplementation(callback => callback(null)),
      })),
      update: jest.fn().mockImplementation(() => ({
        then: jest.fn().mockImplementation(callback => callback(null)),
      })),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock authenticator
jest.mock('otplib', () => {
  return {
    authenticator: {
      generateSecret: jest.fn(() => 'TESTSECRET123456'),
      keyuri: jest.fn(
        () => 'otpauth://totp/Test:user@example.com?secret=TESTSECRET123456&issuer=Test'
      ),
      verify: jest.fn(),
      options: {},
    },
  };
});

// Mock QRCode
jest.mock('qrcode', () => {
  return {
    toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,test')),
  };
});

describe('MFA Implementation', () => {
  const mockPrisma = new PrismaClient();
  const mockUser = {
    id: 'user1',
    email: 'user@example.com',
    tenantId: 'tenant1',
    mfaEnabled: true,
    mfaSecret: 'TESTSECRET123456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    jest
      .spyOn(mockPrisma.user, 'findUnique')
      .mockImplementation(() => Promise.resolve(mockUser) as any);
    jest
      .spyOn(mockPrisma.user, 'update')
      .mockImplementation(() => Promise.resolve(mockUser) as any);
    require('otplib').authenticator.verify.mockReturnValue(true);
  });

  describe('TOTP Setup and Verification', () => {
    test('should generate TOTP setup data', async () => {
      const result = await generateTOTPSetup('user1', 'user@example.com', 'Test Tenant');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes.length).toBe(8);
    });

    test('should verify TOTP token', () => {
      const result = verifyTOTP('TESTSECRET123456', '123456');
      expect(result).toBe(true);

      require('otplib').authenticator.verify.mockReturnValue(false);
      const invalidResult = verifyTOTP('TESTSECRET123456', '000000');
      expect(invalidResult).toBe(false);
    });

    test('should enable MFA', async () => {
      const result = await enableMFA('user1', 'tenant1', 'TESTSECRET123456', '123456');

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'user1',
          tenantId: 'tenant1',
        },
        data: {
          mfaEnabled: true,
          mfaSecret: 'TESTSECRET123456',
        },
      });
    });

    test('should disable MFA', async () => {
      const result = await disableMFA('user1', 'tenant1');

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'user1',
          tenantId: 'tenant1',
        },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
        },
      });
    });
  });

  describe('Email OTP', () => {
    test('should generate and verify email OTP', async () => {
      const email = 'user@example.com';
      const tenantId = 'tenant1';

      // Generate OTP
      const otp = await generateEmailOTP(email, tenantId);
      expect(otp).toHaveLength(6);

      // Verify valid OTP
      const validResult = await verifyEmailOTP(email, tenantId, otp);
      expect(validResult).toBe(true);

      // Verify invalid OTP
      const invalidResult = await verifyEmailOTP(email, tenantId, '000000');
      expect(invalidResult).toBe(false);
    });
  });

  describe('MFA Status and Verification', () => {
    test('should check if MFA is enabled', async () => {
      const result = await isMFAEnabled('user1', 'tenant1');
      expect(result).toBe(true);

      jest
        .spyOn(mockPrisma.user, 'findUnique')
        .mockImplementation(() => Promise.resolve({ ...mockUser, mfaEnabled: false }) as any);
      const disabledResult = await isMFAEnabled('user1', 'tenant1');
      expect(disabledResult).toBe(false);
    });

    test('should get MFA status', async () => {
      const result = await getMFAStatus('user1', 'tenant1');

      expect(result).toEqual({
        enabled: true,
        methods: {
          totp: true,
          email: true,
        },
      });

      jest
        .spyOn(mockPrisma.user, 'findUnique')
        .mockImplementation(
          () => Promise.resolve({ ...mockUser, mfaEnabled: false, mfaSecret: null }) as any
        );
      const disabledResult = await getMFAStatus('user1', 'tenant1');

      expect(disabledResult).toEqual({
        enabled: false,
        methods: {
          totp: false,
          email: false,
        },
      });
    });

    test('should verify MFA token', async () => {
      // Verify TOTP
      const totpResult = await verifyMFAToken('user1', 'tenant1', '123456', 'totp');
      expect(totpResult).toBe(true);

      // Verify Email OTP (will fail because we haven't generated one)
      const emailResult = await verifyMFAToken('user1', 'tenant1', '123456', 'email');
      expect(emailResult).toBe(false);

      // Generate and verify Email OTP
      const email = 'user@example.com';
      const otp = await generateEmailOTP(email, 'tenant1');
      const validEmailResult = await verifyMFAToken('user1', 'tenant1', otp, 'email');
      expect(validEmailResult).toBe(true);
    });
  });
});
