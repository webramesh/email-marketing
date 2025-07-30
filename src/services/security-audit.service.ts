import { createHash, createHmac, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export enum AuditAction {
  // Authentication actions
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_FAILED = 'MFA_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  // User management actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',

  // Data access actions
  DATA_ACCESSED = 'DATA_ACCESSED',
  DATA_CREATED = 'DATA_CREATED',
  DATA_UPDATED = 'DATA_UPDATED',
  DATA_DELETED = 'DATA_DELETED',
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_IMPORTED = 'DATA_IMPORTED',

  // Security events
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // System events
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  MAINTENANCE_MODE_ENABLED = 'MAINTENANCE_MODE_ENABLED',
  MAINTENANCE_MODE_DISABLED = 'MAINTENANCE_MODE_DISABLED',

  // Payment and billing events
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  BILLING_UPDATED = 'BILLING_UPDATED',

  // Email and campaign events
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  CAMPAIGN_SENT = 'CAMPAIGN_SENT',
  CAMPAIGN_DELETED = 'CAMPAIGN_DELETED',
  SUBSCRIBER_ADDED = 'SUBSCRIBER_ADDED',
  SUBSCRIBER_REMOVED = 'SUBSCRIBER_REMOVED',
  BULK_OPERATION = 'BULK_OPERATION',

  // API events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  API_REQUEST = 'API_REQUEST',
  WEBHOOK_TRIGGERED = 'WEBHOOK_TRIGGERED',

  // GDPR and privacy events
  GDPR_DATA_REQUEST = 'GDPR_DATA_REQUEST',
  GDPR_DATA_DELETION = 'GDPR_DATA_DELETION',
  GDPR_DATA_EXPORT = 'GDPR_DATA_EXPORT',
  CONSENT_GIVEN = 'CONSENT_GIVEN',
  CONSENT_WITHDRAWN = 'CONSENT_WITHDRAWN',
}

export enum SecurityRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  riskLevel?: SecurityRiskLevel;
  sessionId?: string;
  correlationId?: string;
}

export interface SecurityEvent {
  tenantId: string;
  userId?: string;
  eventType: string;
  severity: SecurityRiskLevel;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface AuditTrailQuery {
  tenantId: string;
  userId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  riskLevel?: SecurityRiskLevel;
  limit?: number;
  offset?: number;
}

export class SecurityAuditService {
  private static instance: SecurityAuditService;
  private readonly hmacSecret: string;
  private readonly encryptionKey: Buffer;

  constructor() {
    this.hmacSecret = process.env.AUDIT_HMAC_SECRET || this.generateSecureKey();
    this.encryptionKey = Buffer.from(
      process.env.AUDIT_ENCRYPTION_KEY || this.generateSecureKey(),
      'hex'
    );
  }

  static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  private generateSecureKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Log an audit event with comprehensive security measures
   */
  async logAuditEvent(entry: AuditLogEntry): Promise<string> {
    try {
      const auditId = this.generateAuditId();
      const timestamp = new Date();

      // Generate integrity hash
      const integrityHash = this.generateIntegrityHash({
        ...entry,
        id: auditId,
        timestamp,
      });

      // Sanitize sensitive data
      const sanitizedChanges = this.sanitizeData(entry.changes);
      const sanitizedMetadata = this.sanitizeData(entry.metadata);

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          id: auditId,
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          ipAddress: this.maskIpAddress(entry.ipAddress),
          userAgent: this.sanitizeUserAgent(entry.userAgent),
          changes: sanitizedChanges,
          metadata: {
            ...sanitizedMetadata,
            riskLevel: entry.riskLevel || SecurityRiskLevel.LOW,
            sessionId: entry.sessionId,
            correlationId: entry.correlationId,
            integrityHash,
            originalTimestamp: timestamp.toISOString(),
          },
          createdAt: timestamp,
        },
      });

      // Log high-risk events to security monitoring
      if (this.isHighRiskEvent(entry)) {
        await this.logSecurityEvent({
          tenantId: entry.tenantId,
          userId: entry.userId,
          eventType: 'HIGH_RISK_AUDIT_EVENT',
          severity: entry.riskLevel || SecurityRiskLevel.HIGH,
          description: `High-risk audit event: ${entry.action}`,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata: {
            auditId,
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
          },
          correlationId: entry.correlationId,
        });
      }

      // Check for suspicious patterns
      await this.detectSuspiciousActivity(entry);

      return auditId;
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Create emergency log
      await this.createEmergencyLog(entry, error);
      throw error;
    }
  }

  /**
   * Log a security event with alerting
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date();

      // Log to structured logging
      console.warn('SECURITY_EVENT:', {
        id: eventId,
        tenantId: event.tenantId,
        userId: event.userId,
        eventType: event.eventType,
        severity: event.severity,
        description: event.description,
        ipAddress: this.maskIpAddress(event.ipAddress),
        userAgent: this.sanitizeUserAgent(event.userAgent),
        metadata: event.metadata,
        correlationId: event.correlationId,
        timestamp: timestamp.toISOString(),
      });

      // Store in audit log for persistence
      await this.logAuditEvent({
        tenantId: event.tenantId,
        userId: event.userId,
        action: AuditAction.SECURITY_VIOLATION,
        resource: 'security_event',
        resourceId: eventId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: {
          eventType: event.eventType,
          severity: event.severity,
          description: event.description,
          originalMetadata: event.metadata,
        },
        riskLevel: event.severity,
        correlationId: event.correlationId,
      });

      // Send alerts for critical events
      if (event.severity === SecurityRiskLevel.CRITICAL) {
        await this.sendCriticalSecurityAlert(event);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Fallback to console logging for critical security events
      console.error('CRITICAL_SECURITY_EVENT_LOGGING_FAILED:', {
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get audit trail with filtering and pagination
   */
  async getAuditTrail(query: AuditTrailQuery): Promise<{
    entries: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const whereClause: any = {
        tenantId: query.tenantId,
      };

      if (query.userId) {
        whereClause.userId = query.userId;
      }

      if (query.action) {
        whereClause.action = query.action;
      }

      if (query.resource) {
        whereClause.resource = query.resource;
      }

      if (query.resourceId) {
        whereClause.resourceId = query.resourceId;
      }

      if (query.startDate || query.endDate) {
        whereClause.createdAt = {};
        if (query.startDate) {
          whereClause.createdAt.gte = query.startDate;
        }
        if (query.endDate) {
          whereClause.createdAt.lte = query.endDate;
        }
      }

      if (query.riskLevel) {
        whereClause.metadata = {
          path: 'riskLevel',
          equals: query.riskLevel,
        };
      }

      const limit = Math.min(query.limit || 100, 1000); // Max 1000 records
      const offset = query.offset || 0;

      const [entries, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            action: true,
            resource: true,
            resourceId: true,
            userId: true,
            ipAddress: true,
            userAgent: true,
            changes: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      return {
        entries: entries.map(entry => ({
          ...entry,
          // Verify integrity of each entry
          integrityVerified: this.verifyIntegrity(entry),
        })),
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(entry: AuditLogEntry): Promise<void> {
    try {
      const suspiciousPatterns = await Promise.all([
        this.detectRapidFailedLogins(entry),
        this.detectUnusualAccessPatterns(entry),
        this.detectBulkDataAccess(entry),
        this.detectOffHoursActivity(entry),
        this.detectGeographicAnomalies(entry),
      ]);

      const detectedPatterns = suspiciousPatterns.filter(Boolean);

      if (detectedPatterns.length > 0) {
        await this.logSecurityEvent({
          tenantId: entry.tenantId,
          userId: entry.userId,
          eventType: 'SUSPICIOUS_ACTIVITY_DETECTED',
          severity: SecurityRiskLevel.MEDIUM,
          description: `Suspicious activity patterns detected: ${detectedPatterns.join(', ')}`,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata: {
            patterns: detectedPatterns,
            originalAction: entry.action,
            resource: entry.resource,
          },
          correlationId: entry.correlationId,
        });
      }
    } catch (error) {
      console.error('Failed to detect suspicious activity:', error);
    }
  }

  /**
   * Detect rapid failed login attempts
   */
  private async detectRapidFailedLogins(entry: AuditLogEntry): Promise<string | null> {
    if (entry.action !== AuditAction.LOGIN_FAILED) return null;

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const failedLogins = await prisma.auditLog.count({
        where: {
          tenantId: entry.tenantId,
          action: AuditAction.LOGIN_FAILED,
          ipAddress: entry.ipAddress,
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
      });

      return failedLogins >= 5 ? 'rapid_failed_logins' : null;
    } catch (error) {
      console.error('Failed to detect rapid failed logins:', error);
      return null;
    }
  }

  /**
   * Detect unusual access patterns
   */
  private async detectUnusualAccessPatterns(entry: AuditLogEntry): Promise<string | null> {
    if (!entry.userId) return null;

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentActions = await prisma.auditLog.findMany({
        where: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          createdAt: {
            gte: oneDayAgo,
          },
        },
        select: {
          action: true,
          ipAddress: true,
          createdAt: true,
        },
      });

      // Check for unusual number of different IP addresses
      const uniqueIPs = new Set(recentActions.map(a => a.ipAddress).filter(Boolean));
      if (uniqueIPs.size > 10) {
        return 'multiple_ip_addresses';
      }

      // Check for unusual activity volume
      if (recentActions.length > 1000) {
        return 'high_activity_volume';
      }

      return null;
    } catch (error) {
      console.error('Failed to detect unusual access patterns:', error);
      return null;
    }
  }

  /**
   * Detect bulk data access
   */
  private async detectBulkDataAccess(entry: AuditLogEntry): Promise<string | null> {
    if (entry.action !== AuditAction.DATA_ACCESSED && entry.action !== AuditAction.DATA_EXPORTED) {
      return null;
    }

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const dataAccessCount = await prisma.auditLog.count({
        where: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: {
            in: [AuditAction.DATA_ACCESSED, AuditAction.DATA_EXPORTED],
          },
          createdAt: {
            gte: oneHourAgo,
          },
        },
      });

      return dataAccessCount > 100 ? 'bulk_data_access' : null;
    } catch (error) {
      console.error('Failed to detect bulk data access:', error);
      return null;
    }
  }

  /**
   * Detect off-hours activity
   */
  private async detectOffHoursActivity(entry: AuditLogEntry): Promise<string | null> {
    try {
      const hour = new Date().getHours();

      // Consider 10 PM to 6 AM as off-hours
      if (hour >= 22 || hour <= 6) {
        // Check if this user typically works during these hours
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const offHoursActivity = await prisma.auditLog.count({
          where: {
            tenantId: entry.tenantId,
            userId: entry.userId,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        });

        const totalActivity = await prisma.auditLog.count({
          where: {
            tenantId: entry.tenantId,
            userId: entry.userId,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        });

        // If less than 10% of activity is during off-hours, flag it
        if (totalActivity > 0 && offHoursActivity / totalActivity < 0.1) {
          return 'off_hours_activity';
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to detect off-hours activity:', error);
      return null;
    }
  }

  /**
   * Detect geographic anomalies (placeholder - would need GeoIP service)
   */
  private async detectGeographicAnomalies(entry: AuditLogEntry): Promise<string | null> {
    // This would require a GeoIP service to detect location changes
    // For now, return null as a placeholder
    return null;
  }

  /**
   * Generate integrity hash for audit entry
   */
  private generateIntegrityHash(data: any): string {
    const hashData = {
      id: data.id,
      tenantId: data.tenantId,
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      timestamp: data.timestamp.toISOString(),
    };

    const sortedData = JSON.stringify(hashData, Object.keys(hashData).sort());
    return createHmac('sha256', this.hmacSecret).update(sortedData).digest('hex');
  }

  /**
   * Verify integrity of audit entry
   */
  private verifyIntegrity(entry: any): boolean {
    try {
      if (!entry.metadata?.integrityHash || !entry.metadata?.originalTimestamp) {
        return false;
      }

      const expectedHash = this.generateIntegrityHash({
        id: entry.id,
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        timestamp: new Date(entry.metadata.originalTimestamp),
      });

      return entry.metadata.integrityHash === expectedHash;
    } catch (error) {
      console.error('Failed to verify integrity:', error);
      return false;
    }
  }

  /**
   * Check if event is high risk
   */
  private isHighRiskEvent(entry: AuditLogEntry): boolean {
    const highRiskActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      AuditAction.SUSPICIOUS_ACTIVITY,
      AuditAction.SECURITY_VIOLATION,
      AuditAction.USER_DELETED,
      AuditAction.DATA_DELETED,
      AuditAction.SYSTEM_CONFIG_CHANGED,
      AuditAction.GDPR_DATA_DELETION,
    ];

    return (
      highRiskActions.includes(entry.action) ||
      entry.riskLevel === SecurityRiskLevel.HIGH ||
      entry.riskLevel === SecurityRiskLevel.CRITICAL
    );
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeData(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return undefined;

    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'cvv',
      'ssn',
      'creditCard',
      'bankAccount',
      'pin',
      'otp',
      'mfaSecret',
      'apiKey',
      'privateKey',
      'encryptionKey',
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Mask IP address for privacy
   */
  private maskIpAddress(ipAddress?: string): string | undefined {
    if (!ipAddress) return undefined;

    if (ipAddress.includes('.')) {
      // IPv4
      const parts = ipAddress.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    } else if (ipAddress.includes(':')) {
      // IPv6
      const parts = ipAddress.split(':');
      return `${parts.slice(0, 4).join(':')}:xxxx:xxxx:xxxx:xxxx`;
    }

    return 'xxx.xxx.xxx.xxx';
  }

  /**
   * Sanitize user agent string
   */
  private sanitizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    return userAgent
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'xxx.xxx.xxx.xxx')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      .substring(0, 500);
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(6).toString('hex');
    return `event_${timestamp}_${random}`;
  }

  /**
   * Send critical security alert
   */
  private async sendCriticalSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      // In production, this would send alerts via email, Slack, PagerDuty, etc.
      console.error('CRITICAL_SECURITY_ALERT:', {
        tenantId: event.tenantId,
        eventType: event.eventType,
        description: event.description,
        severity: event.severity,
        timestamp: new Date().toISOString(),
        metadata: event.metadata,
      });

      // Could integrate with alerting services here
      // await this.sendSlackAlert(event);
      // await this.sendEmailAlert(event);
      // await this.sendPagerDutyAlert(event);
    } catch (error) {
      console.error('Failed to send critical security alert:', error);
    }
  }

  /**
   * Create emergency log when audit logging fails
   */
  private async createEmergencyLog(entry: AuditLogEntry, error: any): Promise<void> {
    try {
      console.error('AUDIT_LOGGING_EMERGENCY:', {
        tenantId: entry.tenantId,
        action: entry.action,
        resource: entry.resource,
        error: error.message,
        timestamp: new Date().toISOString(),
        originalEntry: this.sanitizeData(entry.metadata),
      });
    } catch (emergencyError) {
      console.error('Failed to create emergency log:', emergencyError);
    }
  }

  /**
   * Get security metrics for monitoring dashboard
   */
  async getSecurityMetrics(
    tenantId: string,
    timeRange: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalEvents: number;
    securityViolations: number;
    failedLogins: number;
    suspiciousActivity: number;
    highRiskEvents: number;
    topRiskyUsers: Array<{ userId: string; riskScore: number }>;
    topRiskyIPs: Array<{ ipAddress: string; eventCount: number }>;
  }> {
    try {
      const whereClause = {
        tenantId,
        createdAt: {
          gte: timeRange.startDate,
          lte: timeRange.endDate,
        },
      };

      const [totalEvents, securityViolations, failedLogins, suspiciousActivity, highRiskEvents] =
        await Promise.all([
          prisma.auditLog.count({ where: whereClause }),
          prisma.auditLog.count({
            where: { ...whereClause, action: AuditAction.SECURITY_VIOLATION },
          }),
          prisma.auditLog.count({
            where: { ...whereClause, action: AuditAction.LOGIN_FAILED },
          }),
          prisma.auditLog.count({
            where: { ...whereClause, action: AuditAction.SUSPICIOUS_ACTIVITY },
          }),
          prisma.auditLog.count({
            where: {
              ...whereClause,
              OR: [
                {
                  metadata: {
                    path: 'riskLevel',
                    equals: SecurityRiskLevel.HIGH,
                  },
                },
                {
                  metadata: {
                    path: 'riskLevel',
                    equals: SecurityRiskLevel.CRITICAL,
                  },
                },
              ],
            },
          }),
        ]);

      // Get top risky users (placeholder implementation)
      const topRiskyUsers = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          ...whereClause,
          userId: { not: null },
          action: {
            in: [
              AuditAction.LOGIN_FAILED,
              AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
              AuditAction.SUSPICIOUS_ACTIVITY,
            ],
          },
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      });

      // Get top risky IPs
      const topRiskyIPs = await prisma.auditLog.groupBy({
        by: ['ipAddress'],
        where: {
          ...whereClause,
          ipAddress: { not: null },
          action: {
            in: [
              AuditAction.LOGIN_FAILED,
              AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
              AuditAction.SUSPICIOUS_ACTIVITY,
            ],
          },
        },
        _count: { ipAddress: true },
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 10,
      });

      return {
        totalEvents,
        securityViolations,
        failedLogins,
        suspiciousActivity,
        highRiskEvents,
        topRiskyUsers: topRiskyUsers.map(user => ({
          userId: user.userId!,
          riskScore: user._count.userId,
        })),
        topRiskyIPs: topRiskyIPs.map(ip => ({
          ipAddress: ip.ipAddress!,
          eventCount: ip._count.ipAddress,
        })),
      };
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      throw error;
    }
  }
}
