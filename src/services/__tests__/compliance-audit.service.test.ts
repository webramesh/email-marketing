// Mock Next.js dependencies first
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/audit-middleware', () => ({
  AuditMiddleware: {
    extractAuditContext: jest.fn(),
  },
  createAuditContext: jest.fn(),
}));

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    consentRecord: {
      findMany: jest.fn(),
    },
    gdprRequest: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../security-audit.service');
jest.mock('../gdpr-compliance.service');

import { ComplianceAuditService, ComplianceReportType } from '../compliance-audit.service';
import { SecurityAuditService } from '../security-audit.service';
import { GdprComplianceService } from '../gdpr-compliance.service';
import { prisma } from '@/lib/prisma';

describe('ComplianceAuditService', () => {
  let service: ComplianceAuditService;
  let mockSecurityAuditService: jest.Mocked<SecurityAuditService>;
  let mockGdprService: jest.Mocked<GdprComplianceService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSecurityAuditService = {
      logAuditEvent: jest.fn().mockResolvedValue('audit_123'),
    } as any;

    mockGdprService = {
      createGdprRequest: jest.fn().mockResolvedValue({
        id: 'gdpr_request_123',
        verificationToken: 'token_123',
      }),
      verifyGdprRequest: jest.fn().mockResolvedValue(true),
      recordConsent: jest.fn().mockResolvedValue({}),
      withdrawConsent: jest.fn().mockResolvedValue({}),
    } as any;

    (SecurityAuditService.getInstance as jest.Mock).mockReturnValue(mockSecurityAuditService);
    (GdprComplianceService.getInstance as jest.Mock).mockReturnValue(mockGdprService);

    service = ComplianceAuditService.getInstance();
  });

  describe('logUserAction', () => {
    it('should log user action with comprehensive audit trail', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ id: 'audit_123' });
      (prisma.auditLog.create as jest.Mock).mockImplementation(mockCreate);

      const actionData = {
        tenantId: 'tenant_123',
        userId: 'user_123',
        action: 'USER_UPDATED',
        resource: 'user',
        resourceId: 'user_123',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session_123',
        metadata: { source: 'web' },
      };

      const result = await service.logUserAction(actionData);

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant_123',
          userId: 'user_123',
          action: 'USER_UPDATED',
          resource: 'user',
          resourceId: 'user_123',
          ipAddress: '192.168.xxx.xxx', // Should be masked
          changes: {
            oldValues: { name: 'Old Name' },
            newValues: { name: 'New Name' },
          },
          metadata: expect.objectContaining({
            source: 'web',
            sessionId: 'session_123',
            integrityHash: expect.any(String),
            originalTimestamp: expect.any(String),
            auditVersion: '2.0',
          }),
        }),
      });

      expect(mockSecurityAuditService.logAuditEvent).toHaveBeenCalled();
    });

    it('should sanitize sensitive data in old and new values', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ id: 'audit_123' });
      (prisma.auditLog.create as jest.Mock).mockImplementation(mockCreate);

      const actionData = {
        tenantId: 'tenant_123',
        userId: 'user_123',
        action: 'PASSWORD_CHANGED',
        resource: 'user',
        oldValues: { password: 'oldpassword123' },
        newValues: { password: 'newpassword123' },
      };

      await service.logUserAction(actionData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: {
            oldValues: { password: '[REDACTED]' },
            newValues: { password: '[REDACTED]' },
          },
        }),
      });
    });
  });

  describe('exportUserData', () => {
    it('should export comprehensive user data', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        mfaEnabled: false,
        userSessions: [],
        sessionActivities: [],
        profileHistory: [],
        passwordHistory: [],
        accounts: [],
        assignedTickets: [],
        requestedTickets: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gdprRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.consentRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.exportUserData(
        'tenant_123',
        'user_123',
        'admin_123',
        'JSON'
      );

      expect(result).toEqual({
        exportId: expect.any(String),
        downloadUrl: expect.stringContaining('https://exports.example.com/'),
        expiresAt: expect.any(Date),
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123', tenantId: 'tenant_123' },
        include: expect.any(Object),
      });
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.exportUserData('tenant_123', 'nonexistent_user', 'admin_123', 'JSON')
      ).rejects.toThrow('User not found');
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data with anonymization', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.updateMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await service.deleteUserData(
        'tenant_123',
        'user_123',
        'admin_123',
        { anonymize: true, retainAuditLogs: true, hardDelete: false }
      );

      expect(result).toEqual({
        deletionId: expect.any(String),
        deletedRecords: 0,
        anonymizedRecords: expect.any(Number),
        affectedTables: expect.any(Array),
      });

      // Verify user was found
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123', tenantId: 'tenant_123' },
      });
    });

    it('should perform hard delete when requested', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.delete as jest.Mock).mockResolvedValue(mockUser);
      (prisma.auditLog.updateMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await service.deleteUserData(
        'tenant_123',
        'user_123',
        'admin_123',
        { hardDelete: true, retainAuditLogs: true }
      );

      expect(result.deletedRecords).toBe(1);
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user_123', tenantId: 'tenant_123' },
      });
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate audit trail report', async () => {
      const mockAuditLogs = [
        {
          id: 'audit_1',
          action: 'USER_CREATED',
          resource: 'user',
          metadata: { riskLevel: 'LOW' },
          createdAt: new Date(),
        },
        {
          id: 'audit_2',
          action: 'PAYMENT_PROCESSED',
          resource: 'payment',
          metadata: { riskLevel: 'HIGH' },
          createdAt: new Date(),
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditLogs);

      const result = await service.generateComplianceReport(
        'tenant_123',
        ComplianceReportType.AUDIT_TRAIL,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'admin_123',
        'JSON'
      );

      expect(result).toEqual({
        id: expect.any(String),
        tenantId: 'tenant_123',
        reportType: ComplianceReportType.AUDIT_TRAIL,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        generatedAt: expect.any(Date),
        generatedBy: 'admin_123',
        format: 'JSON',
        downloadUrl: expect.stringContaining('https://reports.example.com/'),
        expiresAt: expect.any(Date),
        data: expect.objectContaining({
          summary: expect.objectContaining({
            totalEvents: 2,
            riskLevels: expect.any(Object),
            topActions: expect.any(Array),
            topResources: expect.any(Array),
            complianceScore: expect.any(Number),
            issues: expect.any(Array),
          }),
          details: expect.any(Object),
          metadata: expect.any(Object),
        }),
      });
    });
  });

  describe('cleanupOldAuditLogs', () => {
    it('should cleanup old audit logs with proper retention', async () => {
      const mockOldLogs = [
        { id: 'audit_1', action: 'USER_CREATED' },
        { id: 'audit_2', action: 'GDPR_DATA_DELETION' },
        { id: 'audit_3', action: 'LOGIN_SUCCESS' },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockOldLogs);
      (prisma.auditLog.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await service.cleanupOldAuditLogs('tenant_123', 365);

      expect(result).toEqual({
        deletedCount: 2,
        anonymizedCount: 1,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_123',
          createdAt: { lt: expect.any(Date) },
        },
        select: { id: true, action: true },
      });
    });
  });

  describe('getPrivacySettings', () => {
    it('should return user privacy settings', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        emailNotifications: { marketing: true },
        smsNotifications: false,
        pushNotifications: true,
        updatedAt: new Date(),
      };

      const mockConsentRecords = [
        {
          consentType: 'MARKETING_EMAILS',
          status: 'GIVEN',
        },
      ];

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.consentRecord.findMany as jest.Mock).mockResolvedValue(mockConsentRecords);

      const result = await service.getPrivacySettings('tenant_123', 'user_123');

      expect(result).toEqual({
        id: 'privacy_user_123',
        tenantId: 'tenant_123',
        userId: 'user_123',
        dataProcessingConsent: true,
        marketingConsent: true,
        analyticsConsent: true,
        thirdPartySharing: false,
        dataRetentionPreference: 2555,
        rightToBeForgettenRequested: false,
        dataPortabilityRequested: false,
        communicationPreferences: {
          email: true,
          sms: false,
          push: true,
        },
        updatedAt: mockUser.updatedAt,
      });
    });
  });

  describe('updatePrivacySettings', () => {
    it('should update privacy settings and handle consent changes', async () => {
      const mockCurrentSettings = {
        id: 'privacy_user_123',
        tenantId: 'tenant_123',
        userId: 'user_123',
        dataProcessingConsent: false,
        marketingConsent: false,
        analyticsConsent: true,
        thirdPartySharing: false,
        dataRetentionPreference: 2555,
        rightToBeForgettenRequested: false,
        dataPortabilityRequested: false,
        communicationPreferences: {
          email: false,
          sms: false,
          push: true,
        },
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
      };

      jest.spyOn(service, 'getPrivacySettings').mockResolvedValue(mockCurrentSettings);
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser) // First call in getPrivacySettings
        .mockResolvedValueOnce(mockUser); // Second call in updatePrivacySettings

      const updates = {
        dataProcessingConsent: true,
        marketingConsent: true,
      };

      const result = await service.updatePrivacySettings(
        'tenant_123',
        'user_123',
        updates,
        'user_123'
      );

      expect(result.dataProcessingConsent).toBe(true);
      expect(result.marketingConsent).toBe(true);

      // Verify the user update was called
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});