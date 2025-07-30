import { SecurityAuditService, AuditAction, SecurityRiskLevel } from '../security-audit.service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock crypto functions
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash'),
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hmac'),
  })),
  randomBytes: jest.fn(() => Buffer.from('mocked-random-bytes')),
}));

describe('SecurityAuditService', () => {
  let auditService: SecurityAuditService;
  const mockTenantId = 'test-tenant-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    auditService = SecurityAuditService.getInstance();
    jest.clearAllMocks();
  });

  describe('logAuditEvent', () => {
    it('should log a basic audit event successfully', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        userId: mockUserId,
        action: AuditAction.LOGIN_SUCCESS,
        resource: 'authentication',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        metadata: { loginMethod: 'email' },
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
        ...mockAuditEntry,
      });

      const auditId = await auditService.logAuditEvent(mockAuditEntry);

      expect(auditId).toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockUserId,
          action: AuditAction.LOGIN_SUCCESS,
          resource: 'authentication',
          ipAddress: '192.168.1.xxx', // Should be masked
          userAgent: expect.stringContaining('Mozilla/5.0 Test Browser'),
          metadata: expect.objectContaining({
            loginMethod: 'email',
            riskLevel: SecurityRiskLevel.LOW,
            integrityHash: 'mocked-hmac',
          }),
        }),
      });
    });

    it('should mask sensitive data in audit logs', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        userId: mockUserId,
        action: AuditAction.DATA_UPDATED,
        resource: 'user',
        changes: {
          email: 'user@example.com',
          password: 'secret123',
          apiKey: 'sk_test_123456',
          normalField: 'normal value',
        },
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
        ...mockAuditEntry,
      });

      await auditService.logAuditEvent(mockAuditEntry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: {
            email: 'user@example.com',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
            normalField: 'normal value',
          },
        }),
      });
    });

    it('should handle high-risk events with additional logging', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        userId: mockUserId,
        action: AuditAction.LOGIN_FAILED,
        resource: 'authentication',
        riskLevel: SecurityRiskLevel.HIGH,
        ipAddress: '192.168.1.1',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
        ...mockAuditEntry,
      });

      // Mock console.warn to verify security event logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await auditService.logAuditEvent(mockAuditEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        'SECURITY_EVENT:',
        expect.objectContaining({
          eventType: 'HIGH_RISK_AUDIT_EVENT',
          severity: SecurityRiskLevel.HIGH,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should create emergency log when audit logging fails', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        action: AuditAction.DATA_ACCESSED,
        resource: 'test',
      };

      const mockError = new Error('Database connection failed');
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(auditService.logAuditEvent(mockAuditEntry)).rejects.toThrow(mockError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AUDIT_LOGGING_EMERGENCY:',
        expect.objectContaining({
          tenantId: mockTenantId,
          action: AuditAction.DATA_ACCESSED,
          error: 'Database connection failed',
        })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events with proper structure', async () => {
      const mockSecurityEvent = {
        tenantId: mockTenantId,
        userId: mockUserId,
        eventType: 'SUSPICIOUS_LOGIN',
        severity: SecurityRiskLevel.MEDIUM,
        description: 'Login from unusual location',
        ipAddress: '10.0.0.1',
        metadata: { location: 'Unknown' },
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await auditService.logSecurityEvent(mockSecurityEvent);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'SECURITY_EVENT:',
        expect.objectContaining({
          eventType: 'SUSPICIOUS_LOGIN',
          severity: SecurityRiskLevel.MEDIUM,
          description: 'Login from unusual location',
          ipAddress: '10.0.0.xxx', // Should be masked
        })
      );

      expect(prisma.auditLog.create).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should send critical alerts for critical security events', async () => {
      const mockCriticalEvent = {
        tenantId: mockTenantId,
        eventType: 'DATA_BREACH_DETECTED',
        severity: SecurityRiskLevel.CRITICAL,
        description: 'Potential data breach detected',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await auditService.logSecurityEvent(mockCriticalEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'CRITICAL_SECURITY_ALERT:',
        expect.objectContaining({
          eventType: 'DATA_BREACH_DETECTED',
          severity: SecurityRiskLevel.CRITICAL,
        })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail with proper filtering', async () => {
      const mockAuditEntries = [
        {
          id: 'audit-1',
          action: AuditAction.LOGIN_SUCCESS,
          resource: 'authentication',
          userId: mockUserId,
          createdAt: new Date(),
          metadata: { integrityHash: 'hash1' },
        },
        {
          id: 'audit-2',
          action: AuditAction.DATA_ACCESSED,
          resource: 'user',
          userId: mockUserId,
          createdAt: new Date(),
          metadata: { integrityHash: 'hash2' },
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditEntries);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(2);

      const result = await auditService.getAuditTrail({
        tenantId: mockTenantId,
        userId: mockUserId,
        limit: 10,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          userId: mockUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
        select: expect.any(Object),
      });
    });

    it('should handle pagination correctly', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(150);

      const result = await auditService.getAuditTrail({
        tenantId: mockTenantId,
        limit: 50,
        offset: 100,
      });

      expect(result.hasMore).toBe(false); // 100 + 50 >= 150
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 100,
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await auditService.getAuditTrail({
        tenantId: mockTenantId,
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
        select: expect.any(Object),
      });
    });
  });

  describe('getSecurityMetrics', () => {
    it('should return comprehensive security metrics', async () => {
      const timeRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
      };

      // Mock the various count queries
      (prisma.auditLog.count as jest.Mock)
        .mockResolvedValueOnce(1000) // totalEvents
        .mockResolvedValueOnce(5)    // securityViolations
        .mockResolvedValueOnce(25)   // failedLogins
        .mockResolvedValueOnce(3)    // suspiciousActivity
        .mockResolvedValueOnce(8);   // highRiskEvents

      // Mock groupBy queries
      (prisma.auditLog.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { userId: 'user1', _count: { userId: 10 } },
          { userId: 'user2', _count: { userId: 5 } },
        ])
        .mockResolvedValueOnce([
          { ipAddress: '192.168.1.1', _count: { ipAddress: 15 } },
          { ipAddress: '10.0.0.1', _count: { ipAddress: 8 } },
        ]);

      const metrics = await auditService.getSecurityMetrics(mockTenantId, timeRange);

      expect(metrics).toEqual({
        totalEvents: 1000,
        securityViolations: 5,
        failedLogins: 25,
        suspiciousActivity: 3,
        highRiskEvents: 8,
        topRiskyUsers: [
          { userId: 'user1', riskScore: 10 },
          { userId: 'user2', riskScore: 5 },
        ],
        topRiskyIPs: [
          { ipAddress: '192.168.1.1', eventCount: 15 },
          { ipAddress: '10.0.0.1', eventCount: 8 },
        ],
      });
    });
  });

  describe('IP address masking', () => {
    it('should mask IPv4 addresses correctly', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        action: AuditAction.DATA_ACCESSED,
        resource: 'test',
        ipAddress: '192.168.1.100',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
      });

      await auditService.logAuditEvent(mockAuditEntry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.xxx',
        }),
      });
    });

    it('should mask IPv6 addresses correctly', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        action: AuditAction.DATA_ACCESSED,
        resource: 'test',
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
      });

      await auditService.logAuditEvent(mockAuditEntry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx',
        }),
      });
    });
  });

  describe('Suspicious activity detection', () => {
    it('should detect rapid failed logins', async () => {
      const mockAuditEntry = {
        tenantId: mockTenantId,
        action: AuditAction.LOGIN_FAILED,
        resource: 'authentication',
        ipAddress: '192.168.1.1',
      };

      // Mock 5 failed logins in the last 5 minutes
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(5);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-123',
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await auditService.logAuditEvent(mockAuditEntry);

      // Should log suspicious activity
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'SECURITY_EVENT:',
        expect.objectContaining({
          eventType: 'SUSPICIOUS_ACTIVITY_DETECTED',
          description: expect.stringContaining('rapid_failed_logins'),
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });
});