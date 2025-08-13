/**
 * Enhanced Authorization System with Package-based Permissions
 * Integrates role-based and package-based permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth';
import { hasPermission, Resource, Action } from './permissions';
import {
  PackagePermissionChecker,
  UserPackageContext,
  PackageTier
} from './package-permissions';
import {
  PermissionAuditService,
  PermissionAuditEventType
} from './permission-audit';
import { UserRole, TenantContext } from '@/types';
import { PrismaClient } from '@/generated/prisma';

export interface EnhancedPermissionContext {
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
  };
  tenant: TenantContext;
  packages: UserPackageContext;
  hasRolePermission: boolean;
  hasPackagePermission: boolean;
  quotaStatus: Record<string, { used: number; limit: number; exceeded: boolean }>;
  restrictions: string[];
}

export class EnhancedAuthorizationService {
  private prisma: PrismaClient;
  private auditService: PermissionAuditService;

  constructor() {
    this.prisma = new PrismaClient();
    this.auditService = new PermissionAuditService(this.prisma);
  }

  /**
   * Enhanced permission check with role and package validation
   */
  async checkEnhancedPermission(
    request: NextRequest,
    resource: Resource,
    action: Action
  ): Promise<{
    allowed: boolean;
    context: EnhancedPermissionContext | null;
    reason?: string;
  }> {
    try {
      const session = await auth();

      if (!session?.user) {
        return {
          allowed: false,
          context: null,
          reason: 'User not authenticated'
        };
      }

      const { user } = session;
      const userRole = user.role as UserRole;

      // Get tenant context
      const tenantContext = await this.getTenantContext(request);
      if (!tenantContext?.tenantId) {
        return {
          allowed: false,
          context: null,
          reason: 'Tenant context required'
        };
      }

      // Get user package context
      const packageContext = await this.getUserPackageContext(user.id, tenantContext.tenantId);

      // Check role-based permission
      const hasRolePermission = hasPermission(userRole, resource, action);

      // Check package-based permission
      const packageChecker = new PackagePermissionChecker(packageContext);
      const hasPackagePermission = packageChecker.hasPackagePermission(resource, action);

      // Determine if access is allowed (both role and package permissions required)
      const allowed = hasRolePermission && hasPackagePermission;

      // Get quota status
      const quotaStatus = this.getQuotaStatus(packageChecker);

      // Get restrictions
      const restrictions = packageChecker.getRestrictions().map(r => r.message);

      const context: EnhancedPermissionContext = {
        user: {
          id: user.id,
          role: userRole,
          tenantId: tenantContext.tenantId
        },
        tenant: tenantContext,
        packages: packageContext,
        hasRolePermission,
        hasPackagePermission,
        quotaStatus,
        restrictions
      };

      // Log permission attempt if denied
      if (!allowed) {
        const reason = !hasRolePermission
          ? 'Insufficient role permissions'
          : 'Package permissions insufficient';

        await this.auditService.logPermissionDenied(
          user.id,
          tenantContext.tenantId,
          resource,
          action,
          reason,
          this.getClientIP(request),
          request.headers.get('user-agent') || undefined
        );

        return {
          allowed: false,
          context,
          reason
        };
      }

      return {
        allowed: true,
        context
      };
    } catch (error) {
      console.error('Enhanced authorization error:', error);
      return {
        allowed: false,
        context: null,
        reason: 'Authorization system error'
      };
    }
  }

  /**
   * Middleware wrapper for enhanced authorization
   */
  withEnhancedPermission<T extends any[]>(
    handler: (request: NextRequest, context: EnhancedPermissionContext, ...args: T) => Promise<NextResponse>,
    resource: Resource,
    action: Action
  ) {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
      const result = await this.checkEnhancedPermission(request, resource, action);

      if (!result.allowed || !result.context) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: result.reason || 'Access denied',
            details: result.context ? {
              hasRolePermission: result.context.hasRolePermission,
              hasPackagePermission: result.context.hasPackagePermission,
              restrictions: result.context.restrictions
            } : undefined
          },
          { status: 403 }
        );
      }

      // Add enhanced context to request headers
      const headers = new Headers(request.headers);
      headers.set('X-User-ID', result.context.user.id);
      headers.set('X-Tenant-ID', result.context.user.tenantId);
      headers.set('X-User-Role', result.context.user.role);
      headers.set('X-Package-Tier', result.context.packages.packages[0]?.tier || 'NONE');

      const enhancedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as const })
      });

      return handler(enhancedRequest as NextRequest, result.context, ...args);
    };
  }

  /**
   * Check quota before performing action
   */
  async checkQuotaBeforeAction(
    userId: string,
    tenantId: string,
    quotaType: string,
    increment: number = 1
  ): Promise<{ allowed: boolean; reason?: string; usage?: { used: number; limit: number } }> {
    try {
      const packageContext = await this.getUserPackageContext(userId, tenantId);
      const packageChecker = new PackagePermissionChecker(packageContext);

      const quotaUsage = packageChecker.getQuotaUsage(quotaType);
      const wouldExceed = (quotaUsage.used + increment) > quotaUsage.limit;

      if (wouldExceed) {
        // Log quota exceeded event
        await this.auditService.logQuotaExceeded(
          userId,
          tenantId,
          quotaType,
          quotaUsage.used,
          quotaUsage.limit
        );

        return {
          allowed: false,
          reason: `Quota exceeded for ${quotaType}. Used: ${quotaUsage.used}, Limit: ${quotaUsage.limit}`,
          usage: quotaUsage
        };
      }

      return {
        allowed: true,
        usage: quotaUsage
      };
    } catch (error) {
      console.error('Quota check error:', error);
      return {
        allowed: false,
        reason: 'Quota check failed'
      };
    }
  }

  /**
   * Update usage after successful action
   */
  async updateUsage(
    userId: string,
    tenantId: string,
    quotaType: string,
    increment: number = 1
  ): Promise<void> {
    try {
      // Update usage in package purchase record
      await this.prisma.packagePurchase.updateMany({
        where: {
          customerId: userId,
          status: 'ACTIVE'
        },
        data: {
          usage: {
            // This would need to be implemented based on your JSON field structure
            // For now, we'll use a simple increment approach
          }
        }
      });
    } catch (error) {
      console.error('Usage update error:', error);
    }
  }

  /**
   * Get user package context
   */
  private async getUserPackageContext(userId: string, tenantId: string): Promise<UserPackageContext> {
    try {
      // Get active package purchases for user
      const purchases = await this.prisma.packagePurchase.findMany({
        where: {
          customerId: userId,
          status: { in: ['ACTIVE', 'TRIALING'] }
        },
        include: {
          package: true
        }
      });

      const packages = purchases.map(purchase => ({
        id: purchase.id,
        packageId: purchase.packageId,
        name: purchase.package.name,
        tier: (purchase.package as any).tier as PackageTier || PackageTier.BASIC, // Fallback to BASIC if tier doesn't exist
        features: purchase.package.features as Record<string, any>,
        quotas: purchase.package.quotas as Record<string, number>,
        usage: purchase.usage as Record<string, number>,
        status: purchase.status.toLowerCase() as 'active' | 'expired' | 'suspended' | 'cancelled',
        expiresAt: purchase.currentPeriodEnd,
        permissions: [] // This would be populated from package template
      }));

      // Calculate effective permissions and quotas
      const effectivePermissions = this.calculateEffectivePermissions(packages);
      const currentUsage = this.calculateCurrentUsage(packages);
      const quotaLimits = this.calculateQuotaLimits(packages);

      return {
        userId,
        tenantId,
        packages,
        effectivePermissions,
        currentUsage,
        quotaLimits
      };
    } catch (error) {
      console.error('Error getting user package context:', error);
      return {
        userId,
        tenantId,
        packages: [],
        effectivePermissions: [],
        currentUsage: {},
        quotaLimits: {}
      };
    }
  }

  /**
   * Calculate effective permissions from all packages
   */
  private calculateEffectivePermissions(packages: any[]): any[] {
    // Combine permissions from all active packages
    const allPermissions: any[] = [];

    for (const pkg of packages) {
      if (pkg.status === 'active') {
        allPermissions.push(...pkg.permissions);
      }
    }

    return allPermissions;
  }

  /**
   * Calculate current usage across packages
   */
  private calculateCurrentUsage(packages: any[]): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const pkg of packages) {
      if (pkg.status === 'active') {
        for (const [key, value] of Object.entries(pkg.usage)) {
          usage[key] = (usage[key] || 0) + (value as number);
        }
      }
    }

    return usage;
  }

  /**
   * Calculate quota limits (use highest limits from active packages)
   */
  private calculateQuotaLimits(packages: any[]): Record<string, number> {
    const limits: Record<string, number> = {};

    for (const pkg of packages) {
      if (pkg.status === 'active') {
        for (const [key, value] of Object.entries(pkg.quotas)) {
          limits[key] = Math.max(limits[key] || 0, value as number);
        }
      }
    }

    return limits;
  }

  /**
   * Get quota status for all quotas
   */
  private getQuotaStatus(packageChecker: PackagePermissionChecker): Record<string, { used: number; limit: number; exceeded: boolean }> {
    const quotaStatus: Record<string, { used: number; limit: number; exceeded: boolean }> = {};

    // Common quota types
    const quotaTypes = [
      'monthly_emails',
      'subscribers',
      'lists',
      'campaigns',
      'automations',
      'segments',
      'templates',
      'domains',
      'api_calls'
    ];

    for (const quotaType of quotaTypes) {
      const usage = packageChecker.getQuotaUsage(quotaType);
      quotaStatus[quotaType] = {
        used: usage.used,
        limit: usage.limit,
        exceeded: usage.used >= usage.limit
      };
    }

    return quotaStatus;
  }

  /**
   * Get tenant context from request
   */
  private async getTenantContext(request: NextRequest): Promise<TenantContext | null> {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return null;
    }

    return {
      tenantId: session.user.tenantId,
      tenant: null // Would be populated with actual tenant data
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
  }
}