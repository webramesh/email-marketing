import { SecurityMonitoringService, ThreatType } from '@/services/security-monitoring.service';
import { SecurityRiskLevel } from '@/services/security-audit.service';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    loginAttempt: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    securityThreat: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
    ipRestriction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    geolocationRestriction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    securityAlert: {
      create: jest.fn(),
    },
    userSession: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    sessionActivity: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('@/lib/geoip', () => ({
  geoip: {
    lookup: jest.fn(),
  },
}));

jest.mock('@/lib/session-management', () => ({
  getClientIP: jest.fn(() => '192.168.1.1'),
  logSecurityEvent: jest.fn(),
  analyzeSessionSecurity: jest.fn(() => ({
    riskScore: 10,
    isBlocked: false,
    factors: [],
  })),
}));

jest.mock('@/services/security-audit.service', () => ({
  SecurityAuditService: {
    getInstance: jest.fn(() => ({
      logAuditEvent: jest.fn(),
    })),
  },
  AuditAction: {
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    SECURITY_VIOLATION: 'SECURITY_VIOLATION',
    SYSTEM_CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',
  },
  SecurityRiskLevel: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
}));

describe('SecurityMonitoringService', () => {
  let securityMonitoringService: SecurityMonitoringService;
  let mockRequest: NextRequest;

  beforeEach(() => {
    securityMonitoringService = SecurityMonitoringService.getInstance();
    mockRequest = {
      headers: new Headers({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-forwarded-for': '192.168.1.1',
      }),
      nextUrl: { pathname: '/api/auth/signin' },
    } as NextRequest;

    jest.clearAllMocks();
  });

  describe('monitorLoginAttempt', () => {
    it('should allow valid login attempt', async () => {
      const { prisma } = require('@/lib/prisma');
      const { geoip } = require('@/lib/geoip');

      // Mock no restrictions
      prisma.ipRestriction.findFirst.mockResolvedValue(null);
      prisma.geolocationRestriction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'user1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        tenantId: 'tenant1',
      });
      prisma.loginAttempt.count.mockResolvedValue(2); // Below brute force threshold
      prisma.sessionActivity.findMany.mockResolvedValue([]); // No rapid IP changes
      prisma.loginAttempt.findMany.mockResolvedValue([]); // No account enumeration

      geoip.lookup.mockResolvedValue({
        country: 'United States',
        countryCode: 'US',
      });

      const result = await securityMonitoringService.monitorLoginAttempt(
        'test@example.com',
        'password123',
        mockRequest,
        'tenant1'
      );

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should block IP-restricted addresses', async () => {
      const { prisma } = require('@/lib/prisma');

      prisma.ipRestriction.findFirst.mockResolvedValue({
        type: 'BLOCK',
        reason: 'Suspicious activity',
      });

      const result = await securityMonitoringService.monitorLoginAttempt(
        'test@example.com',
        'password123',
        mockRequest,
        'tenant1'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Suspicious activity');
      expect(result.riskScore).toBe(100);
    });

    it('should block locked accounts', async () => {
      const { prisma } = require('@/lib/prisma');

      prisma.ipRestriction.findFirst.mockResolvedValue(null);
      prisma.geolocationRestriction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'user1',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60000), // Locked for 1 minute
        tenantId: 'tenant1',
      });

      const result = await securityMonitoringService.monitorLoginAttempt(
        'test@example.com',
        'password123',
        mockRequest,
        'tenant1'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('locked');
      expect(result.lockoutUntil).toBeDefined();
    });

    it('should detect brute force attacks', async () => {
      const { prisma } = require('@/lib/prisma');

      prisma.ipRestriction.findFirst.mockResolvedValue(null);
      prisma.geolocationRestriction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'user1',
        failedLoginAttempts: 0,
        lockedUntil: null,
        tenantId: 'tenant1',
      });
      prisma.loginAttempt.count.mockResolvedValue(15); // Above brute force threshold
      prisma.securityThreat.create.mockResolvedValue({ id: 'threat1' });

      const result = await securityMonitoringService.monitorLoginAttempt(
        'test@example.com',
        'password123',
        mockRequest,
        'tenant1'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many login attempts');
      expect(result.riskScore).toBe(95);
      expect(prisma.securityThreat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ThreatType.BRUTE_FORCE_ATTACK,
            severity: SecurityRiskLevel.HIGH,
          }),
        })
      );
    });
  });

  describe('handleFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      const { prisma } = require('@/lib/prisma');
      const { geoip } = require('@/lib/geoip');

      prisma.user.findFirst.mockResolvedValue({
        id: 'user1',
        failedLoginAttempts: 2,
        tenantId: 'tenant1',
      });

      geoip.lookup.mockResolvedValue({
        country: 'United States',
        countryCode: 'US',
      });

      await securityMonitoringService.handleFailedLogin(
        'test@example.com',
        mockRequest,
        'INVALID_PASSWORD',
        'tenant1'
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          failedLoginAttempts: 3,
          lockedUntil: null,
        },
      });

      expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          success: false,
          failureReason: 'INVALID_PASSWORD',
        }),
      });
    });

    it('should lock account after max failed attempts', async () => {
      const { prisma } = require('@/lib/prisma');

      prisma.user.findFirst.mockResolvedValue({
        id: 'user1',
        failedLoginAttempts: 4, // One less than max
        tenantId: 'tenant1',
      });

      await securityMonitoringService.handleFailedLogin(
        'test@example.com',
        mockRequest,
        'INVALID_PASSWORD',
        'tenant1'
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        },
      });

      expect(prisma.securityThreat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ThreatType.MULTIPLE_FAILED_LOGINS,
            severity: SecurityRiskLevel.HIGH,
          }),
        })
      );
    });
  });

  describe('handleSuccessfulLogin', () => {
    it('should reset failed login attempts', async () => {
      const { prisma } = require('@/lib/prisma');
      const { geoip } = require('@/lib/geoip');

      geoip.lookup.mockResolvedValue({
        country: 'United States',
        countryCode: 'US',
      });

      // Mock recent sessions for location check
      prisma.userSession.findMany.mockResolvedValue([
        {
          location: { country: 'United States' },
        },
      ]);

      await securityMonitoringService.handleSuccessfulLogin(
        'user1',
        'test@example.com',
        mockRequest,
        'tenant1'
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        },
      });

      expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          success: true,
        }),
      });
    });

    it('should detect unusual location access', async () => {
      const { prisma } = require('@/lib/prisma');
      const { geoip } = require('@/lib/geoip');

      geoip.lookup.mockResolvedValue({
        country: 'Russia',
        countryCode: 'RU',
      });

      // Mock recent sessions from different country
      prisma.userSession.findMany.mockResolvedValue([
        {
          location: { country: 'United States' },
        },
      ]);

      prisma.user.findUnique.mockResolvedValue({
        tenantId: 'tenant1',
        email: 'test@example.com',
      });

      await securityMonitoringService.handleSuccessfulLogin(
        'user1',
        'test@example.com',
        mockRequest,
        'tenant1'
      );

      expect(prisma.securityThreat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ThreatType.UNUSUAL_LOCATION_ACCESS,
            severity: SecurityRiskLevel.MEDIUM,
            description: expect.stringContaining('Russia'),
          }),
        })
      );
    });
  });

  describe('getSecurityMetrics', () => {
    it('should return comprehensive security metrics', async () => {
      const { prisma } = require('@/lib/prisma');

      // Mock database responses
      prisma.loginAttempt.count
        .mockResolvedValueOnce(100) // total attempts
        .mockResolvedValueOnce(20) // failed attempts
        .mockResolvedValueOnce(80) // successful attempts
        .mockResolvedValueOnce(5); // blocked attempts

      prisma.securityThreat.count
        .mockResolvedValueOnce(3) // active threats
        .mockResolvedValueOnce(7); // resolved threats

      prisma.securityThreat.groupBy.mockResolvedValue([
        { type: ThreatType.BRUTE_FORCE_ATTACK, _count: { type: 5 } },
        { type: ThreatType.UNUSUAL_LOCATION_ACCESS, _count: { type: 3 } },
      ]);

      prisma.loginAttempt.groupBy.mockResolvedValue([
        { ipAddress: '192.168.1.100', _count: { ipAddress: 10 } },
        { ipAddress: '10.0.0.1', _count: { ipAddress: 8 } },
      ]);

      prisma.loginAttempt.findMany.mockResolvedValue([
        { location: { country: 'United States' } },
        { location: { country: 'Canada' } },
        { location: { country: 'United States' } },
      ]);

      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const metrics = await securityMonitoringService.getSecurityMetrics(
        'tenant1',
        dateRange
      );

      expect(metrics).toEqual({
        totalLoginAttempts: 100,
        failedLoginAttempts: 20,
        successfulLogins: 80,
        blockedAttempts: 5,
        activeThreats: 3,
        resolvedThreats: 7,
        topThreatTypes: [
          { type: ThreatType.BRUTE_FORCE_ATTACK, count: 5 },
          { type: ThreatType.UNUSUAL_LOCATION_ACCESS, count: 3 },
        ],
        topRiskyIPs: [
          { ipAddress: '192.168.1.100', attempts: 10 },
          { ipAddress: '10.0.0.1', attempts: 8 },
        ],
        loginsByCountry: [
          { country: 'United States', attempts: 2 },
          { country: 'Canada', attempts: 1 },
        ],
        riskScoreDistribution: expect.any(Array),
      });
    });
  });

  describe('addIPRestriction', () => {
    it('should create IP restriction', async () => {
      const { prisma } = require('@/lib/prisma');

      await securityMonitoringService.addIPRestriction(
        '192.168.1.100',
        'BLOCK',
        'tenant1',
        'Suspicious activity detected',
        'admin1',
        new Date('2024-12-31')
      );

      expect(prisma.ipRestriction.create).toHaveBeenCalledWith({
        data: {
          ipAddress: '192.168.1.100',
          type: 'BLOCK',
          tenantId: 'tenant1',
          reason: 'Suspicious activity detected',
          createdBy: 'admin1',
          expiresAt: new Date('2024-12-31'),
        },
      });
    });
  });

  describe('addGeolocationRestriction', () => {
    it('should create geolocation restriction', async () => {
      const { prisma } = require('@/lib/prisma');

      await securityMonitoringService.addGeolocationRestriction(
        'RU',
        'BLOCK',
        'tenant1',
        'High-risk country',
        'admin1'
      );

      expect(prisma.geolocationRestriction.create).toHaveBeenCalledWith({
        data: {
          countryCode: 'RU',
          type: 'BLOCK',
          tenantId: 'tenant1',
          reason: 'High-risk country',
          createdBy: 'admin1',
        },
      });
    });
  });

  describe('resolveSecurityThreat', () => {
    it('should mark threat as resolved', async () => {
      const { prisma } = require('@/lib/prisma');

      await securityMonitoringService.resolveSecurityThreat(
        'threat1',
        'admin1',
        'False positive - legitimate user'
      );

      expect(prisma.securityThreat.update).toHaveBeenCalledWith({
        where: { id: 'threat1' },
        data: {
          isActive: false,
          resolvedAt: expect.any(Date),
          metadata: {
            resolvedBy: 'admin1',
            resolution: 'False positive - legitimate user',
          },
        },
      });
    });
  });

  describe('getActiveThreats', () => {
    it('should return active threats for tenant', async () => {
      const { prisma } = require('@/lib/prisma');

      const mockThreats = [
        {
          id: 'threat1',
          type: ThreatType.BRUTE_FORCE_ATTACK,
          severity: SecurityRiskLevel.HIGH,
          description: 'Brute force attack detected',
          userId: 'user1',
          tenantId: 'tenant1',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          location: { country: 'Unknown' },
          metadata: { attemptCount: 15 },
          isActive: true,
          detectedAt: new Date('2024-01-15T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      prisma.securityThreat.findMany.mockResolvedValue(mockThreats);

      const threats = await securityMonitoringService.getActiveThreats('tenant1');

      expect(threats).toHaveLength(1);
      expect(threats[0]).toEqual({
        id: 'threat1',
        type: ThreatType.BRUTE_FORCE_ATTACK,
        severity: SecurityRiskLevel.HIGH,
        description: 'Brute force attack detected',
        userId: 'user1',
        tenantId: 'tenant1',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        location: { country: 'Unknown' },
        metadata: { attemptCount: 15 },
        isActive: true,
        detectedAt: new Date('2024-01-15T10:00:00Z'),
        resolvedAt: undefined,
      });
    });
  });
});

describe('SecurityMonitoringService - Edge Cases', () => {
  let securityMonitoringService: SecurityMonitoringService;

  beforeEach(() => {
    securityMonitoringService = SecurityMonitoringService.getInstance();
    jest.clearAllMocks();
  });

  it('should handle database errors gracefully', async () => {
    const { prisma } = require('@/lib/prisma');
    const mockRequest = {
      headers: new Headers({ 'user-agent': 'test' }),
      nextUrl: { pathname: '/test' },
    } as NextRequest;

    // Reset all mocks first
    jest.clearAllMocks();
    
    prisma.ipRestriction.findFirst.mockRejectedValue(new Error('Database error'));

    // The service should handle the error and not throw
    await expect(securityMonitoringService.monitorLoginAttempt(
      'test@example.com',
      'password',
      mockRequest
    )).resolves.not.toThrow();
  });

  it('should handle missing location data', async () => {
    const { prisma } = require('@/lib/prisma');
    const { geoip } = require('@/lib/geoip');
    const mockRequest = {
      headers: new Headers({ 'user-agent': 'test' }),
      nextUrl: { pathname: '/test' },
    } as NextRequest;

    // Reset all mocks first
    jest.clearAllMocks();
    
    // Mock successful database calls
    prisma.ipRestriction.findFirst.mockResolvedValue(null);
    prisma.geolocationRestriction.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.loginAttempt.count.mockResolvedValue(0);
    prisma.sessionActivity.findMany.mockResolvedValue([]);
    
    geoip.lookup.mockResolvedValue(null);

    const result = await securityMonitoringService.monitorLoginAttempt(
      'test@example.com',
      'password',
      mockRequest
    );

    expect(result.allowed).toBe(true);
  });

  it('should detect automated user agents', async () => {
    const { prisma } = require('@/lib/prisma');
    const mockRequest = {
      headers: new Headers({ 'user-agent': 'python-requests/2.25.1' }),
      nextUrl: { pathname: '/test' },
    } as NextRequest;

    prisma.ipRestriction.findFirst.mockResolvedValue(null);
    prisma.geolocationRestriction.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.loginAttempt.count.mockResolvedValue(0);
    prisma.securityThreat.create.mockResolvedValue({ id: 'threat1' });

    await securityMonitoringService.monitorLoginAttempt(
      'test@example.com',
      'password',
      mockRequest
    );

    expect(prisma.securityThreat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ThreatType.AUTOMATED_ATTACK,
          severity: SecurityRiskLevel.MEDIUM,
        }),
      })
    );
  });
});