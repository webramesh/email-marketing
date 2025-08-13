/**
 * Permission Audit Trail System
 * Tracks permission changes and access attempts
 * 
 * NOTE: This implementation requires an AuditLog model to be added to the Prisma schema.
 * Currently using console logging as a placeholder until the model is created.
 * 
 * Required AuditLog model fields:
 * - id, userId, tenantId, action, resource, resourceId
 * - oldValues, newValues, metadata (JSON fields)
 * - ipAddress, userAgent, performedBy, reason
 * - createdAt, updatedAt
 */

import { PrismaClient } from '@/generated/prisma';
import { Resource, Action } from './permissions';
import { PackageTier } from './package-permissions';

export interface PermissionAuditEvent {
  id: string;
  userId: string;
  tenantId: string;
  eventType: PermissionAuditEventType;
  resource?: Resource;
  action?: Action;
  packageId?: string;
  packageTier?: PackageTier;
  oldPermissions?: Record<string, any>;
  newPermissions?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum PermissionAuditEventType {
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PACKAGE_ASSIGNED = 'PACKAGE_ASSIGNED',
  PACKAGE_REMOVED = 'PACKAGE_REMOVED',
  PACKAGE_UPGRADED = 'PACKAGE_UPGRADED',
  PACKAGE_DOWNGRADED = 'PACKAGE_DOWNGRADED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FEATURE_ACCESS_DENIED = 'FEATURE_ACCESS_DENIED',
  PERMISSION_TEMPLATE_APPLIED = 'PERMISSION_TEMPLATE_APPLIED',
  BULK_PERMISSION_UPDATE = 'BULK_PERMISSION_UPDATE'
}

export interface PermissionChangeRequest {
  userId: string;
  tenantId: string;
  eventType: PermissionAuditEventType;
  resource?: Resource;
  action?: Action;
  packageId?: string;
  packageTier?: PackageTier;
  oldPermissions?: Record<string, any>;
  newPermissions?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  performedBy: string; // User ID who performed the change
}

export class PermissionAuditService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Log permission audit event
   */
  async logPermissionEvent(request: PermissionChangeRequest): Promise<void> {
    try {
      // TODO: Create AuditLog model in Prisma schema
      // For now, we'll log to console and store in a simple format
      console.log('Permission Audit Event:', {
        userId: request.userId,
        tenantId: request.tenantId,
        eventType: request.eventType,
        resource: request.resource,
        action: request.action,
        packageId: request.packageId,
        packageTier: request.packageTier,
        reason: request.reason,
        performedBy: request.performedBy,
        timestamp: new Date().toISOString()
      });

      // Alternative: Store in a generic log table if available
      // This is a placeholder implementation until AuditLog model is created
      
    } catch (error) {
      console.error('Failed to log permission audit event:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log permission denied event
   */
  async logPermissionDenied(
    userId: string,
    tenantId: string,
    resource: Resource,
    action: Action,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logPermissionEvent({
      userId,
      tenantId,
      eventType: PermissionAuditEventType.PERMISSION_DENIED,
      resource,
      action,
      reason,
      ipAddress,
      userAgent,
      performedBy: userId, // Self-performed
      metadata: {
        deniedAt: new Date().toISOString(),
        severity: 'warning'
      }
    });
  }

  /**
   * Log quota exceeded event
   */
  async logQuotaExceeded(
    userId: string,
    tenantId: string,
    quotaType: string,
    currentUsage: number,
    limit: number,
    packageId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logPermissionEvent({
      userId,
      tenantId,
      eventType: PermissionAuditEventType.QUOTA_EXCEEDED,
      packageId,
      reason: `Quota exceeded: ${quotaType}`,
      ipAddress,
      userAgent,
      performedBy: userId,
      metadata: {
        quotaType,
        currentUsage,
        limit,
        exceededAt: new Date().toISOString(),
        severity: 'warning'
      }
    });
  }

  /**
   * Log package assignment
   */
  async logPackageAssignment(
    userId: string,
    tenantId: string,
    packageId: string,
    packageTier: PackageTier,
    newPermissions: Record<string, any>,
    performedBy: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logPermissionEvent({
      userId,
      tenantId,
      eventType: PermissionAuditEventType.PACKAGE_ASSIGNED,
      packageId,
      packageTier,
      newPermissions,
      reason: reason || 'Package assigned to user',
      ipAddress,
      userAgent,
      performedBy,
      metadata: {
        assignedAt: new Date().toISOString(),
        severity: 'info'
      }
    });
  }

  /**
   * Log package upgrade/downgrade
   */
  async logPackageChange(
    userId: string,
    tenantId: string,
    packageId: string,
    oldTier: PackageTier,
    newTier: PackageTier,
    oldPermissions: Record<string, any>,
    newPermissions: Record<string, any>,
    performedBy: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const isUpgrade = this.isPackageUpgrade(oldTier, newTier);

    await this.logPermissionEvent({
      userId,
      tenantId,
      eventType: isUpgrade
        ? PermissionAuditEventType.PACKAGE_UPGRADED
        : PermissionAuditEventType.PACKAGE_DOWNGRADED,
      packageId,
      packageTier: newTier,
      oldPermissions,
      newPermissions,
      reason: reason || `Package ${isUpgrade ? 'upgraded' : 'downgraded'} from ${oldTier} to ${newTier}`,
      ipAddress,
      userAgent,
      performedBy,
      metadata: {
        oldTier,
        newTier,
        isUpgrade,
        changedAt: new Date().toISOString(),
        severity: 'info'
      }
    });
  }

  /**
   * Get permission audit history for user
   */
  async getPermissionHistory(
    userId: string,
    tenantId: string,
    options: {
      eventTypes?: PermissionAuditEventType[];
      resource?: Resource;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ events: any[]; total: number }> {
    try {
      // TODO: Implement when AuditLog model is created
      // For now, return empty results
      console.log('Getting permission history for user:', userId, 'tenant:', tenantId, 'options:', options);
      
      return {
        events: [],
        total: 0
      };
    } catch (error) {
      console.error('Error getting permission history:', error);
      return {
        events: [],
        total: 0
      };
    }
  }

  /**
   * Get permission statistics
   */
  async getPermissionStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    deniedAttempts: number;
    quotaExceeded: number;
    packageChanges: number;
    eventsByType: Record<string, number>;
    topDeniedResources: Array<{ resource: string; count: number }>;
  }> {
    try {
      // TODO: Implement when AuditLog model is created
      // For now, return mock statistics
      console.log('Getting permission stats for tenant:', tenantId, 'from:', startDate, 'to:', endDate);
      
      return {
        totalEvents: 0,
        deniedAttempts: 0,
        quotaExceeded: 0,
        packageChanges: 0,
        eventsByType: {},
        topDeniedResources: []
      };
    } catch (error) {
      console.error('Error getting permission stats:', error);
      return {
        totalEvents: 0,
        deniedAttempts: 0,
        quotaExceeded: 0,
        packageChanges: 0,
        eventsByType: {},
        topDeniedResources: []
      };
    }
  }

  /**
   * Check if package change is an upgrade
   */
  private isPackageUpgrade(oldTier: PackageTier, newTier: PackageTier): boolean {
    const tierOrder = [
      PackageTier.BASIC,
      PackageTier.STANDARD,
      PackageTier.PROFESSIONAL,
      PackageTier.ENTERPRISE,
      PackageTier.UNLIMITED
    ];

    const oldIndex = tierOrder.indexOf(oldTier);
    const newIndex = tierOrder.indexOf(newTier);

    return newIndex > oldIndex;
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldAuditLogs(retentionDays: number = 365): Promise<number> {
    try {
      // TODO: Implement when AuditLog model is created
      console.log('Cleaning up audit logs older than', retentionDays, 'days');
      
      return 0; // No logs to clean up yet
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      return 0;
    }
  }
}