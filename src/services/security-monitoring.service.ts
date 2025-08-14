import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { SecurityAuditService, AuditAction, SecurityRiskLevel } from './security-audit.service';
import { logSecurityEvent, analyzeSessionSecurity, getClientIP } from '@/lib/session-management';
import { NextRequest } from 'next/server';
import { geoip } from '@/lib/geoip';

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  location?: any;
  riskScore: number;
  blockedBySystem: boolean;
  createdAt: Date;
}

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: SecurityRiskLevel;
  description: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: any;
  metadata?: Record<string, any>;
  isActive: boolean;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface IPRestriction {
  id: string;
  tenantId: string;
  ipAddress: string;
  type: 'ALLOW' | 'BLOCK';
  reason?: string;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface GeolocationRestriction {
  id: string;
  tenantId: string;
  countryCode: string;
  type: 'ALLOW' | 'BLOCK';
  reason?: string;
  createdBy: string;
  createdAt: Date;
}

export enum ThreatType {
  BRUTE_FORCE_ATTACK = 'BRUTE_FORCE_ATTACK',
  CREDENTIAL_STUFFING = 'CREDENTIAL_STUFFING',
  SUSPICIOUS_LOGIN_PATTERN = 'SUSPICIOUS_LOGIN_PATTERN',
  MULTIPLE_FAILED_LOGINS = 'MULTIPLE_FAILED_LOGINS',
  UNUSUAL_LOCATION_ACCESS = 'UNUSUAL_LOCATION_ACCESS',
  RAPID_IP_CHANGES = 'RAPID_IP_CHANGES',
  CONCURRENT_SESSION_ABUSE = 'CONCURRENT_SESSION_ABUSE',
  ACCOUNT_ENUMERATION = 'ACCOUNT_ENUMERATION',
  SESSION_HIJACKING = 'SESSION_HIJACKING',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  AUTOMATED_ATTACK = 'AUTOMATED_ATTACK',
}

export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private auditService: SecurityAuditService;

  // Configuration constants
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly BRUTE_FORCE_THRESHOLD = 10;
  private readonly BRUTE_FORCE_WINDOW = 5 * 60 * 1000; // 5 minutes
  private readonly SUSPICIOUS_ACTIVITY_THRESHOLD = 20;
  private readonly RAPID_IP_CHANGE_THRESHOLD = 5;
  private readonly RAPID_IP_CHANGE_WINDOW = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.auditService = SecurityAuditService.getInstance();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Monitor and validate login attempt
   */
  async monitorLoginAttempt(
    email: string,
    password: string,
    request: NextRequest,
    tenantId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    lockoutUntil?: Date;
    riskScore: number;
    requiresMFA?: boolean;
  }> {
    try {
      const ipAddress = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';
      const location = await this.getLocationFromIP(ipAddress);

      // Check IP-based restrictions
      const ipRestriction = await this.checkIPRestrictions(ipAddress, tenantId);
      if (ipRestriction.blocked) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'IP_BLOCKED', location, 100, true);
        return {
          allowed: false,
          reason: ipRestriction.reason || 'IP address is blocked',
          riskScore: 100,
        };
      }

      // Check geolocation restrictions
      if (location && tenantId) {
        const geoRestriction = await this.checkGeolocationRestrictions(location.country, tenantId);
        if (geoRestriction.blocked) {
          await this.logLoginAttempt(email, ipAddress, userAgent, false, 'LOCATION_BLOCKED', location, 90, true);
          return {
            allowed: false,
            reason: geoRestriction.reason || 'Login from this location is not allowed',
            riskScore: 90,
          };
        }
      }

      // Check for account lockout
      const user = await prisma.user.findFirst({
        where: { email, ...(tenantId && { tenantId }) },
        select: {
          id: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          tenantId: true,
        },
      });

      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'ACCOUNT_LOCKED', location, 80, true);
        return {
          allowed: false,
          reason: 'Account is temporarily locked due to multiple failed login attempts',
          lockoutUntil: user.lockedUntil,
          riskScore: 80,
        };
      }

      // Check for brute force attacks
      const bruteForceCheck = await this.detectBruteForceAttack(ipAddress, email);
      if (bruteForceCheck.detected) {
        await this.createSecurityThreat({
          type: ThreatType.BRUTE_FORCE_ATTACK,
          severity: SecurityRiskLevel.HIGH,
          description: `Brute force attack detected from IP ${ipAddress}`,
          userId: user?.id,
          tenantId: user?.tenantId || tenantId,
          ipAddress,
          userAgent,
          location,
          metadata: {
            email,
            attemptCount: bruteForceCheck.attemptCount,
            timeWindow: this.BRUTE_FORCE_WINDOW,
          },
        });

        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'BRUTE_FORCE_DETECTED', location, 95, true);
        return {
          allowed: false,
          reason: 'Too many login attempts detected. Please try again later.',
          riskScore: 95,
        };
      }

      // Analyze session security if user exists
      let riskScore = 0;
      let requiresMFA = false;

      if (user) {
        const securityAnalysis = await analyzeSessionSecurity(user.id, ipAddress, userAgent, location);
        riskScore = securityAnalysis.riskScore;

        if (securityAnalysis.isBlocked) {
          await this.logLoginAttempt(email, ipAddress, userAgent, false, 'SECURITY_ANALYSIS_BLOCKED', location, riskScore, true);
          return {
            allowed: false,
            reason: securityAnalysis.blockReason || 'Login blocked due to security analysis',
            riskScore,
          };
        }

        // Require MFA for high-risk logins
        if (riskScore > 30) {
          requiresMFA = true;
        }
      }

      // Check for suspicious patterns
      await this.detectSuspiciousPatterns(email, ipAddress, userAgent, location, user?.id, user?.tenantId || tenantId);

      return {
        allowed: true,
        riskScore,
        requiresMFA,
      };
    } catch (error) {
      console.error('Security monitoring error:', error);
      // In case of errors, allow login but with elevated risk score
      return {
        allowed: true,
        riskScore: 50,
        reason: 'Security monitoring temporarily unavailable',
      };
    }
  }

  /**
   * Handle failed login attempt
   */
  async handleFailedLogin(
    email: string,
    request: NextRequest,
    failureReason: string,
    tenantId?: string
  ): Promise<void> {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const location = await this.getLocationFromIP(ipAddress);

    // Find user and increment failed attempts
    const user = await prisma.user.findFirst({
      where: { email, ...(tenantId && { tenantId }) },
    });

    if (user) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;

      // Lock account if threshold exceeded
      if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);

        await logSecurityEvent(
          user.id,
          'ACCOUNT_LOCKOUT',
          'HIGH',
          `Account locked after ${failedAttempts} failed login attempts`,
          {
            ipAddress,
            userAgent,
            location,
            failedAttempts,
            lockoutDuration: this.LOCKOUT_DURATION,
          }
        );

        // Create security threat
        await this.createSecurityThreat({
          type: ThreatType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityRiskLevel.HIGH,
          description: `Account locked due to ${failedAttempts} failed login attempts`,
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          location,
          metadata: {
            email,
            failedAttempts,
            lockoutDuration: this.LOCKOUT_DURATION,
          },
        });
      }

      // Update user record
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      // Log audit event
      await this.auditService.logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        resource: 'authentication',
        ipAddress,
        userAgent,
        metadata: {
          email,
          failureReason,
          failedAttempts,
          location,
          ...(lockedUntil && { lockedUntil: lockedUntil.toISOString() }),
        },
        riskLevel: failedAttempts >= this.MAX_FAILED_ATTEMPTS ? SecurityRiskLevel.HIGH : SecurityRiskLevel.MEDIUM,
      });
    }

    // Log login attempt
    await this.logLoginAttempt(email, ipAddress, userAgent, false, failureReason, location, 50, false);
  }

  /**
   * Handle successful login
   */
  async handleSuccessfulLogin(
    userId: string,
    email: string,
    request: NextRequest,
    tenantId: string
  ): Promise<void> {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const location = await this.getLocationFromIP(ipAddress);

    // Reset failed login attempts
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Log successful login
    await this.logLoginAttempt(email, ipAddress, userAgent, true, undefined, location, 0, false);

    // Log audit event
    await this.auditService.logAuditEvent({
      tenantId,
      userId,
      action: AuditAction.LOGIN_SUCCESS,
      resource: 'authentication',
      ipAddress,
      userAgent,
      metadata: {
        email,
        location,
      },
      riskLevel: SecurityRiskLevel.LOW,
    });

    // Check for unusual location
    await this.checkUnusualLocation(userId, location, ipAddress, userAgent);
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForceAttack(
    ipAddress: string,
    email?: string
  ): Promise<{ detected: boolean; attemptCount: number }> {
    const timeWindow = new Date(Date.now() - this.BRUTE_FORCE_WINDOW);

    // Count failed attempts from this IP
    const ipAttempts = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: timeWindow },
      },
    });

    // Count failed attempts for this email if provided
    let emailAttempts = 0;
    if (email) {
      emailAttempts = await prisma.loginAttempt.count({
        where: {
          email,
          success: false,
          createdAt: { gte: timeWindow },
        },
      });
    }

    const maxAttempts = Math.max(ipAttempts, emailAttempts);
    return {
      detected: maxAttempts >= this.BRUTE_FORCE_THRESHOLD,
      attemptCount: maxAttempts,
    };
  }

  /**
   * Detect suspicious patterns
   */
  private async detectSuspiciousPatterns(
    email: string,
    ipAddress: string,
    userAgent: string,
    location: any,
    userId?: string,
    tenantId?: string
  ): Promise<void> {
    // Check for rapid IP changes
    if (userId) {
      const rapidIPCheck = await this.detectRapidIPChanges(userId);
      if (rapidIPCheck.detected) {
        await this.createSecurityThreat({
          type: ThreatType.RAPID_IP_CHANGES,
          severity: SecurityRiskLevel.MEDIUM,
          description: `Rapid IP address changes detected for user`,
          userId,
          tenantId,
          ipAddress,
          userAgent,
          location,
          metadata: {
            email,
            uniqueIPs: rapidIPCheck.uniqueIPs,
            timeWindow: this.RAPID_IP_CHANGE_WINDOW,
          },
        });
      }
    }

    // Check for automated attacks (simple user agent analysis)
    if (this.isAutomatedUserAgent(userAgent)) {
      await this.createSecurityThreat({
        type: ThreatType.AUTOMATED_ATTACK,
        severity: SecurityRiskLevel.MEDIUM,
        description: 'Automated attack detected based on user agent analysis',
        userId,
        tenantId,
        ipAddress,
        userAgent,
        location,
        metadata: {
          email,
          suspiciousUserAgent: userAgent,
        },
      });
    }

    // Check for account enumeration
    await this.detectAccountEnumeration(email, ipAddress);
  }

  /**
   * Detect rapid IP changes
   */
  private async detectRapidIPChanges(userId: string): Promise<{ detected: boolean; uniqueIPs: number }> {
    const timeWindow = new Date(Date.now() - this.RAPID_IP_CHANGE_WINDOW);

    const uniqueIPs = await prisma.sessionActivity.findMany({
      where: {
        userId,
        createdAt: { gte: timeWindow },
      },
      select: { ipAddress: true },
      distinct: ['ipAddress'],
    });

    return {
      detected: uniqueIPs.length >= this.RAPID_IP_CHANGE_THRESHOLD,
      uniqueIPs: uniqueIPs.length,
    };
  }

  /**
   * Check for unusual location access
   */
  private async checkUnusualLocation(
    userId: string,
    currentLocation: any,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    if (!currentLocation?.country) return;

    // Get user's recent locations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await prisma.userSession.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { location: true },
    });

    const knownCountries = new Set(
      recentSessions
        .map(session => (session.location as any)?.country)
        .filter(Boolean)
    );

    // If this is a new country, flag as suspicious
    if (knownCountries.size > 0 && !knownCountries.has(currentLocation.country)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true, email: true },
      });

      if (user) {
        await this.createSecurityThreat({
          type: ThreatType.UNUSUAL_LOCATION_ACCESS,
          severity: SecurityRiskLevel.MEDIUM,
          description: `Login from unusual location: ${currentLocation.country}`,
          userId,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          location: currentLocation,
          metadata: {
            email: user.email,
            newCountry: currentLocation.country,
            knownCountries: Array.from(knownCountries),
          },
        });

        await logSecurityEvent(
          userId,
          'UNUSUAL_LOCATION',
          'MEDIUM',
          `Login from new location: ${currentLocation.country}`,
          {
            ipAddress,
            userAgent,
            location: currentLocation,
            knownCountries: Array.from(knownCountries),
          }
        );
      }
    }
  }

  /**
   * Detect account enumeration attempts
   */
  private async detectAccountEnumeration(email: string, ipAddress: string): Promise<void> {
    const timeWindow = new Date(Date.now() - 60 * 60 * 1000); // 1 hour

    // Count unique emails attempted from this IP
    const uniqueEmails = await prisma.loginAttempt.findMany({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: timeWindow },
      },
      select: { email: true },
      distinct: ['email'],
    });

    if (uniqueEmails && uniqueEmails.length >= 20) { // Threshold for enumeration
      await this.createSecurityThreat({
        type: ThreatType.ACCOUNT_ENUMERATION,
        severity: SecurityRiskLevel.HIGH,
        description: `Account enumeration detected from IP ${ipAddress}`,
        ipAddress,
        metadata: {
          uniqueEmailsAttempted: uniqueEmails.length,
          timeWindow: 60 * 60 * 1000,
          currentEmail: email,
        },
      });
    }
  }

  /**
   * Check if user agent appears to be automated
   */
  private isAutomatedUserAgent(userAgent: string): boolean {
    const automatedPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /requests/i,
      /http/i,
      /postman/i,
      /insomnia/i,
    ];

    return automatedPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check IP-based restrictions
   */
  private async checkIPRestrictions(
    ipAddress: string,
    tenantId?: string
  ): Promise<{ blocked: boolean; reason?: string }> {
    // Check global IP blocks first
    const globalBlock = await prisma.ipRestriction.findFirst({
      where: {
        ipAddress,
        type: 'BLOCK',
        tenantId: null, // Global restriction
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (globalBlock) {
      return {
        blocked: true,
        reason: globalBlock.reason || 'IP address is globally blocked',
      };
    }

    // Check tenant-specific restrictions if tenantId provided
    if (tenantId) {
      const tenantRestriction = await prisma.ipRestriction.findFirst({
        where: {
          ipAddress,
          tenantId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (tenantRestriction) {
        return {
          blocked: tenantRestriction.type === 'BLOCK',
          reason: tenantRestriction.reason || undefined,
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check geolocation restrictions
   */
  private async checkGeolocationRestrictions(
    countryCode: string,
    tenantId: string
  ): Promise<{ blocked: boolean; reason?: string }> {
    const restriction = await prisma.geolocationRestriction.findFirst({
      where: {
        countryCode,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (restriction) {
      return {
        blocked: restriction.type === 'BLOCK',
        reason: restriction.reason || undefined,
      };
    }

    return { blocked: false };
  }

  /**
   * Get location from IP address
   */
  private async getLocationFromIP(ipAddress: string): Promise<any> {
    try {
      return await geoip.lookup(ipAddress);
    } catch (error) {
      console.error('Failed to get location from IP:', error);
      return null;
    }
  }

  /**
   * Log login attempt
   */
  private async logLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    failureReason?: string,
    location?: any,
    riskScore: number = 0,
    blockedBySystem: boolean = false
  ): Promise<void> {
    try {
      await prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          userAgent,
          success,
          failureReason,
          location,
          riskScore,
          blockedBySystem,
        },
      });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }

  /**
   * Create security threat
   */
  private async createSecurityThreat(threat: Omit<SecurityThreat, 'id' | 'isActive' | 'detectedAt'>): Promise<void> {
    try {
      await prisma.securityThreat.create({
        data: {
          type: threat.type,
          severity: threat.severity,
          description: threat.description,
          userId: threat.userId,
          tenantId: threat.tenantId,
          ipAddress: threat.ipAddress,
          userAgent: threat.userAgent,
          location: threat.location,
          metadata: threat.metadata,
          isActive: true,
        },
      });

      // Log to audit system
      await this.auditService.logAuditEvent({
        tenantId: threat.tenantId || 'system',
        userId: threat.userId,
        action: AuditAction.SECURITY_VIOLATION,
        resource: 'security_threat',
        ipAddress: threat.ipAddress,
        userAgent: threat.userAgent,
        metadata: {
          threatType: threat.type,
          severity: threat.severity,
          description: threat.description,
          ...threat.metadata,
        },
        riskLevel: threat.severity,
      });

      // Send alert for high severity threats
      if (threat.severity === SecurityRiskLevel.HIGH || threat.severity === SecurityRiskLevel.CRITICAL) {
        await this.sendSecurityAlert(threat);
      }
    } catch (error) {
      console.error('Failed to create security threat:', error);
    }
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(threat: Omit<SecurityThreat, 'id' | 'isActive' | 'detectedAt'>): Promise<void> {
    // In production, this would send alerts via email, Slack, etc.
    console.warn('SECURITY_ALERT:', {
      type: threat.type,
      severity: threat.severity,
      description: threat.description,
      userId: threat.userId,
      tenantId: threat.tenantId,
      ipAddress: threat.ipAddress,
      timestamp: new Date().toISOString(),
      metadata: threat.metadata,
    });
  }

  /**
   * Get security dashboard metrics
   */
  async getSecurityMetrics(
    tenantId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<{
    totalLoginAttempts: number;
    failedLoginAttempts: number;
    successfulLogins: number;
    blockedAttempts: number;
    activeThreats: number;
    resolvedThreats: number;
    topThreatTypes: Array<{ type: string; count: number }>;
    topRiskyIPs: Array<{ ipAddress: string; attempts: number }>;
    loginsByCountry: Array<{ country: string; attempts: number }>;
    riskScoreDistribution: Array<{ range: string; count: number }>;
  }> {
    const { startDate, endDate } = timeRange;

    // Get login attempt metrics
    const [
      totalLoginAttempts,
      failedLoginAttempts,
      successfulLogins,
      blockedAttempts,
    ] = await Promise.all([
      prisma.loginAttempt.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          // Filter by tenant through user relationship if needed
        },
      }),
      prisma.loginAttempt.count({
        where: {
          success: false,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.loginAttempt.count({
        where: {
          success: true,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.loginAttempt.count({
        where: {
          blockedBySystem: true,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Get threat metrics
    const [activeThreats, resolvedThreats] = await Promise.all([
      prisma.securityThreat.count({
        where: {
          tenantId,
          isActive: true,
          detectedAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.securityThreat.count({
        where: {
          tenantId,
          isActive: false,
          detectedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Get top threat types
    const threatTypes = await prisma.securityThreat.groupBy({
      by: ['type'],
      where: {
        tenantId,
        detectedAt: { gte: startDate, lte: endDate },
      },
      _count: { type: true },
      orderBy: { _count: { type: 'desc' } },
      take: 10,
    });

    // Get top risky IPs
    const riskyIPs = await prisma.loginAttempt.groupBy({
      by: ['ipAddress'],
      where: {
        success: false,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { ipAddress: true },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 10,
    });

    // Get logins by country (simplified - would need proper location parsing)
    const allLogins = await prisma.loginAttempt.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { location: true },
    });

    // Filter out null locations in JavaScript
    const loginsByCountry = allLogins.filter(login => login.location !== null);

    const countryStats = loginsByCountry.reduce((acc, login) => {
      const country = (login.location as any)?.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get risk score distribution
    const riskScores = await prisma.loginAttempt.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { riskScore: true },
    });

    const riskDistribution = riskScores.reduce((acc, { riskScore }) => {
      let range: string;
      if (riskScore <= 20) range = '0-20';
      else if (riskScore <= 40) range = '21-40';
      else if (riskScore <= 60) range = '41-60';
      else if (riskScore <= 80) range = '61-80';
      else range = '81-100';

      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLoginAttempts,
      failedLoginAttempts,
      successfulLogins,
      blockedAttempts,
      activeThreats,
      resolvedThreats,
      topThreatTypes: threatTypes.map(t => ({
        type: t.type,
        count: t._count.type,
      })),
      topRiskyIPs: riskyIPs.map(ip => ({
        ipAddress: ip.ipAddress,
        attempts: ip._count.ipAddress,
      })),
      loginsByCountry: Object.entries(countryStats).map(([country, attempts]) => ({
        country,
        attempts,
      })),
      riskScoreDistribution: Object.entries(riskDistribution).map(([range, count]) => ({
        range,
        count,
      })),
    };
  }

  /**
   * Add IP restriction
   */
  async addIPRestriction(
    ipAddress: string,
    type: 'ALLOW' | 'BLOCK',
    tenantId: string | null,
    reason: string,
    createdBy: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.ipRestriction.create({
      data: {
        ipAddress,
        type,
        tenantId,
        reason,
        createdBy,
        expiresAt,
      },
    });

    // Log audit event
    await this.auditService.logAuditEvent({
      tenantId: tenantId || 'system',
      userId: createdBy,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      resource: 'ip_restriction',
      resourceId: ipAddress,
      metadata: {
        ipAddress,
        type,
        reason,
        expiresAt: expiresAt?.toISOString(),
      },
      riskLevel: SecurityRiskLevel.MEDIUM,
    });
  }

  /**
   * Add geolocation restriction
   */
  async addGeolocationRestriction(
    countryCode: string,
    type: 'ALLOW' | 'BLOCK',
    tenantId: string,
    reason: string,
    createdBy: string
  ): Promise<void> {
    await prisma.geolocationRestriction.create({
      data: {
        countryCode,
        type,
        tenantId,
        reason,
        createdBy,
      },
    });

    // Log audit event
    await this.auditService.logAuditEvent({
      tenantId,
      userId: createdBy,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      resource: 'geolocation_restriction',
      resourceId: countryCode,
      metadata: {
        countryCode,
        type,
        reason,
      },
      riskLevel: SecurityRiskLevel.MEDIUM,
    });
  }

  /**
   * Resolve security threat
   */
  async resolveSecurityThreat(
    threatId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    await prisma.securityThreat.update({
      where: { id: threatId },
      data: {
        isActive: false,
        resolvedAt: new Date(),
        metadata: {
          resolvedBy,
          resolution,
        },
      },
    });
  }

  /**
   * Get active security threats
   */
  async getActiveThreats(tenantId: string): Promise<SecurityThreat[]> {
    const threats = await prisma.securityThreat.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });

    return threats.map(threat => ({
      id: threat.id,
      type: threat.type as ThreatType,
      severity: threat.severity as SecurityRiskLevel,
      description: threat.description,
      userId: threat.userId || undefined,
      tenantId: threat.tenantId || undefined,
      ipAddress: threat.ipAddress || undefined,
      userAgent: threat.userAgent || undefined,
      location: threat.location,
      metadata: threat.metadata as Record<string, any> || undefined,
      isActive: threat.isActive,
      detectedAt: threat.detectedAt,
      resolvedAt: threat.resolvedAt || undefined,
    }));
  }
}