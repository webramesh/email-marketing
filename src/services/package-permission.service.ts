/**
 * Package Permission Management Service
 * Handles assignment and management of package-based permissions
 */

import { PrismaClient } from '@/generated/prisma';
import { 
  PackagePermissionTemplate, 
  PackageTier, 
  DEFAULT_PACKAGE_TEMPLATES,
  UserPackageContext
} from '@/lib/rbac/package-permissions';
import { 
  PermissionAuditService, 
  PermissionAuditEventType 
} from '@/lib/rbac/permission-audit';
import { Resource, Action } from '@/lib/rbac/permissions';

export interface AssignPackageRequest {
  userId: string;
  tenantId: string;
  packageId: string;
  assignedBy: string;
  reason?: string;
  customFeatures?: Record<string, any>;
  customQuotas?: Record<string, number>;
  expiresAt?: Date;
}

export interface UpdatePackagePermissionsRequest {
  purchaseId: string;
  userId: string;
  tenantId: string;
  features?: Record<string, any>;
  quotas?: Record<string, number>;
  updatedBy: string;
  reason?: string;
}

export interface BulkPermissionUpdateRequest {
  userIds: string[];
  tenantId: string;
  packageId?: string;
  templateId?: string;
  features?: Record<string, any>;
  quotas?: Record<string, number>;
  updatedBy: string;
  reason?: string;
}

export class PackagePermissionService {
  private prisma: PrismaClient;
  private auditService: PermissionAuditService;

  constructor() {
    this.prisma = new PrismaClient();
    this.auditService = new PermissionAuditService(this.prisma);
  }

  /**
   * Assign package to user with permissions
   */
  async assignPackageToUser(request: AssignPackageRequest): Promise<void> {
    try {
      // Get package details
      const packageData = await this.prisma.package.findUnique({
        where: { id: request.packageId }
      });

      if (!packageData) {
        throw new Error('Package not found');
      }

      // Check if user already has this package
      const existingPurchase = await this.prisma.packagePurchase.findFirst({
        where: {
          customerId: request.userId,
          packageId: request.packageId,
          status: { in: ['ACTIVE', 'TRIALING'] }
        }
      });

      if (existingPurchase) {
        throw new Error('User already has this package assigned');
      }

      // Create package purchase record
      const purchase = await this.prisma.packagePurchase.create({
        data: {
          packageId: request.packageId,
          customerId: request.userId,
          purchasePrice: packageData.price,
          currency: packageData.currency,
          billingCycle: packageData.billingCycle,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: request.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
          quotas: request.customQuotas || packageData.quotas,
          usage: {}
        }
      });

      // Apply permission template
      await this.applyPermissionTemplate(
        request.userId,
        request.tenantId,
        packageData.tier as PackageTier,
        request.customFeatures || packageData.features as Record<string, any>,
        request.customQuotas || packageData.quotas as Record<string, number>
      );

      // Log assignment
      await this.auditService.logPackageAssignment(
        request.userId,
        request.tenantId,
        request.packageId,
        packageData.tier as PackageTier,
        request.customFeatures || packageData.features as Record<string, any>,
        request.assignedBy,
        request.reason
      );

    } catch (error) {
      console.error('Error assigning package to user:', error);
      throw error;
    }
  }

  /**
   * Remove package from user
   */
  async removePackageFromUser(
    userId: string,
    tenantId: string,
    packageId: string,
    removedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      // Find active purchase
      const purchase = await this.prisma.packagePurchase.findFirst({
        where: {
          customerId: userId,
          packageId,
          status: { in: ['ACTIVE', 'TRIALING'] }
        },
        include: { package: true }
      });

      if (!purchase) {
        throw new Error('Active package purchase not found');
      }

      // Update purchase status
      await this.prisma.packagePurchase.update({
        where: { id: purchase.id },
        data: {
          status: 'CANCELLED',
          cancelAtPeriodEnd: true
        }
      });

      // Log removal
      await this.auditService.logPermissionEvent({
        userId,
        tenantId,
        eventType: PermissionAuditEventType.PACKAGE_REMOVED,
        packageId,
        packageTier: purchase.package.tier as PackageTier,
        oldPermissions: purchase.package.features as Record<string, any>,
        reason: reason || 'Package removed from user',
        performedBy: removedBy
      });

    } catch (error) {
      console.error('Error removing package from user:', error);
      throw error;
    }
  }

  /**
   * Update package permissions for user
   */
  async updatePackagePermissions(request: UpdatePackagePermissionsRequest): Promise<void> {
    try {
      // Find purchase record
      const purchase = await this.prisma.packagePurchase.findFirst({
        where: {
          id: request.purchaseId,
          customerId: request.userId
        },
        include: { package: true }
      });

      if (!purchase) {
        throw new Error('Package purchase not found');
      }

      const oldFeatures = purchase.package.features as Record<string, any>;
      const oldQuotas = purchase.package.quotas as Record<string, number>;

      // Update package features and quotas
      const updateData: any = {};
      if (request.features) {
        updateData.features = { ...oldFeatures, ...request.features };
      }
      if (request.quotas) {
        updateData.quotas = { ...oldQuotas, ...request.quotas };
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.package.update({
          where: { id: purchase.packageId },
          data: updateData
        });

        // Log permission update
        await this.auditService.logPermissionEvent({
          userId: request.userId,
          tenantId: request.tenantId,
          eventType: PermissionAuditEventType.PERMISSION_TEMPLATE_APPLIED,
          packageId: purchase.packageId,
          packageTier: purchase.package.tier as PackageTier,
          oldPermissions: { features: oldFeatures, quotas: oldQuotas },
          newPermissions: { features: updateData.features, quotas: updateData.quotas },
          reason: request.reason || 'Package permissions updated',
          performedBy: request.updatedBy
        });
      }

    } catch (error) {
      console.error('Error updating package permissions:', error);
      throw error;
    }
  }

  /**
   * Apply permission template to user
   */
  async applyPermissionTemplate(
    userId: string,
    tenantId: string,
    tier: PackageTier,
    customFeatures?: Record<string, any>,
    customQuotas?: Record<string, number>
  ): Promise<void> {
    try {
      const template = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === tier);
      if (!template) {
        throw new Error(`Permission template not found for tier: ${tier}`);
      }

      const features = { ...template.features, ...customFeatures };
      const quotas = { ...template.quotas, ...customQuotas };

      // Log template application
      await this.auditService.logPermissionEvent({
        userId,
        tenantId,
        eventType: PermissionAuditEventType.PERMISSION_TEMPLATE_APPLIED,
        packageTier: tier,
        newPermissions: { features, quotas, permissions: template.permissions },
        reason: `Applied ${tier} permission template`,
        performedBy: 'SYSTEM'
      });

    } catch (error) {
      console.error('Error applying permission template:', error);
      throw error;
    }
  }

  /**
   * Bulk update permissions for multiple users
   */
  async bulkUpdatePermissions(request: BulkPermissionUpdateRequest): Promise<{
    successful: string[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    for (const userId of request.userIds) {
      try {
        if (request.packageId) {
          await this.assignPackageToUser({
            userId,
            tenantId: request.tenantId,
            packageId: request.packageId,
            assignedBy: request.updatedBy,
            reason: request.reason,
            customFeatures: request.features,
            customQuotas: request.quotas
          });
        } else if (request.templateId) {
          const template = DEFAULT_PACKAGE_TEMPLATES.find(t => t.id === request.templateId);
          if (template) {
            await this.applyPermissionTemplate(
              userId,
              request.tenantId,
              template.tier,
              request.features,
              request.quotas
            );
          }
        }

        successful.push(userId);
      } catch (error) {
        failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log bulk update
    await this.auditService.logPermissionEvent({
      userId: 'BULK_OPERATION',
      tenantId: request.tenantId,
      eventType: PermissionAuditEventType.BULK_PERMISSION_UPDATE,
      reason: request.reason || 'Bulk permission update',
      performedBy: request.updatedBy,
      metadata: {
        totalUsers: request.userIds.length,
        successful: successful.length,
        failed: failed.length,
        packageId: request.packageId,
        templateId: request.templateId
      }
    });

    return { successful, failed };
  }

  /**
   * Get user's effective permissions
   */
  async getUserEffectivePermissions(userId: string, tenantId: string): Promise<{
    packages: any[];
    features: Record<string, any>;
    quotas: Record<string, number>;
    usage: Record<string, number>;
    restrictions: string[];
  }> {
    try {
      // Get active packages
      const purchases = await this.prisma.packagePurchase.findMany({
        where: {
          customerId: userId,
          status: { in: ['ACTIVE', 'TRIALING'] }
        },
        include: {
          package: true
        }
      });

      const packages = purchases.map(p => ({
        id: p.id,
        packageId: p.packageId,
        name: p.package.name,
        tier: p.package.tier,
        status: p.status,
        expiresAt: p.currentPeriodEnd,
        features: p.package.features,
        quotas: p.package.quotas,
        usage: p.usage
      }));

      // Combine features (OR logic - if any package has feature, user has it)
      const features: Record<string, any> = {};
      packages.forEach(pkg => {
        const pkgFeatures = pkg.features as Record<string, any>;
        Object.keys(pkgFeatures).forEach(key => {
          if (pkgFeatures[key] === true) {
            features[key] = true;
          }
        });
      });

      // Combine quotas (use highest limits)
      const quotas: Record<string, number> = {};
      packages.forEach(pkg => {
        const pkgQuotas = pkg.quotas as Record<string, number>;
        Object.keys(pkgQuotas).forEach(key => {
          quotas[key] = Math.max(quotas[key] || 0, pkgQuotas[key]);
        });
      });

      // Combine usage
      const usage: Record<string, number> = {};
      packages.forEach(pkg => {
        const pkgUsage = pkg.usage as Record<string, number>;
        Object.keys(pkgUsage).forEach(key => {
          usage[key] = (usage[key] || 0) + pkgUsage[key];
        });
      });

      // Get restrictions
      const restrictions: string[] = [];
      const highestTier = this.getHighestTier(packages.map(p => p.tier as PackageTier));
      const template = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === highestTier);
      if (template) {
        restrictions.push(...template.restrictions.map(r => r.message));
      }

      return {
        packages,
        features,
        quotas,
        usage,
        restrictions
      };

    } catch (error) {
      console.error('Error getting user effective permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform action based on packages
   */
  async canUserPerformAction(
    userId: string,
    tenantId: string,
    resource: Resource,
    action: Action
  ): Promise<{
    allowed: boolean;
    reason?: string;
    quotaStatus?: { used: number; limit: number; exceeded: boolean };
  }> {
    try {
      const permissions = await this.getUserEffectivePermissions(userId, tenantId);
      
      // Check if any package allows this action
      let allowed = false;
      let quotaExceeded = false;
      let quotaStatus: { used: number; limit: number; exceeded: boolean } | undefined;

      for (const pkg of permissions.packages) {
        const template = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === pkg.tier);
        if (template) {
          const resourcePermission = template.permissions.find(p => p.resource === resource);
          if (resourcePermission && 
              (resourcePermission.actions.includes(action) || resourcePermission.actions.includes(Action.MANAGE))) {
            
            // Check quota limits if specified
            if (resourcePermission.quotaLimits) {
              for (const [quotaKey, limit] of Object.entries(resourcePermission.quotaLimits)) {
                const used = permissions.usage[quotaKey] || 0;
                if (used >= limit) {
                  quotaExceeded = true;
                  quotaStatus = { used, limit, exceeded: true };
                  break;
                }
              }
            }

            if (!quotaExceeded) {
              allowed = true;
              break;
            }
          }
        }
      }

      if (!allowed) {
        const reason = quotaExceeded 
          ? 'Quota exceeded for this action'
          : 'No package provides permission for this action';
        
        return { allowed: false, reason, quotaStatus };
      }

      return { allowed: true, quotaStatus };

    } catch (error) {
      console.error('Error checking user action permission:', error);
      return { 
        allowed: false, 
        reason: 'Error checking permissions' 
      };
    }
  }

  /**
   * Get highest tier from list of tiers
   */
  private getHighestTier(tiers: PackageTier[]): PackageTier {
    const tierOrder = [
      PackageTier.BASIC,
      PackageTier.STANDARD,
      PackageTier.PROFESSIONAL,
      PackageTier.ENTERPRISE,
      PackageTier.UNLIMITED
    ];

    let highest = PackageTier.BASIC;
    for (const tier of tiers) {
      const currentIndex = tierOrder.indexOf(tier);
      const highestIndex = tierOrder.indexOf(highest);
      if (currentIndex > highestIndex) {
        highest = tier;
      }
    }

    return highest;
  }

  /**
   * Get permission templates
   */
  getPermissionTemplates(): PackagePermissionTemplate[] {
    return DEFAULT_PACKAGE_TEMPLATES;
  }

  /**
   * Create custom permission template
   */
  async createCustomTemplate(template: Omit<PackagePermissionTemplate, 'id'>): Promise<PackagePermissionTemplate> {
    const customTemplate: PackagePermissionTemplate = {
      ...template,
      id: `custom_${Date.now()}`
    };

    // In a real implementation, you might want to store custom templates in the database
    return customTemplate;
  }
}