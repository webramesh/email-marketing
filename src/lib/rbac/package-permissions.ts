/**
 * Package-based Permission System
 * Implements resource-level permissions based on purchased packages
 */

import { UserRole } from '@/types';
import { Resource, Action } from './permissions';

// Package feature types
export interface PackageFeature {
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'array';
  defaultValue?: any;
}

// Package quota types
export interface PackageQuota {
  key: string;
  name: string;
  description: string;
  limit: number;
  unit: string;
  resetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

// Package permission template
export interface PackagePermissionTemplate {
  id: string;
  name: string;
  description: string;
  tier: PackageTier;
  features: Record<string, any>;
  quotas: Record<string, number>;
  permissions: PackageResourcePermission[];
  restrictions: PackageRestriction[];
}

export enum PackageTier {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  UNLIMITED = 'UNLIMITED'
}

// Resource-level permissions for packages
export interface PackageResourcePermission {
  resource: Resource;
  actions: Action[];
  conditions?: PermissionCondition[];
  quotaLimits?: Record<string, number>;
}

// Permission conditions
export interface PermissionCondition {
  type: 'quota' | 'feature' | 'time' | 'usage';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
  value: any;
  message?: string;
}

// Package restrictions
export interface PackageRestriction {
  type: 'feature_disabled' | 'quota_exceeded' | 'time_expired' | 'usage_limit';
  resource?: Resource;
  action?: Action;
  message: string;
  redirectUrl?: string;
}

// User package context
export interface UserPackageContext {
  userId: string;
  tenantId: string;
  packages: UserPackage[];
  effectivePermissions: PackageResourcePermission[];
  currentUsage: Record<string, number>;
  quotaLimits: Record<string, number>;
}

export interface UserPackage {
  id: string;
  packageId: string;
  name: string;
  tier: PackageTier;
  features: Record<string, any>;
  quotas: Record<string, number>;
  usage: Record<string, number>;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  expiresAt?: Date;
  permissions: PackageResourcePermission[];
}

// Default package permission templates
export const DEFAULT_PACKAGE_TEMPLATES: PackagePermissionTemplate[] = [
  {
    id: 'basic',
    name: 'Basic Package',
    description: 'Basic email marketing features with limited quotas',
    tier: PackageTier.BASIC,
    features: {
      email_builder: true,
      basic_templates: true,
      email_tracking: true,
      basic_analytics: true,
      subscriber_management: true,
      list_management: true,
      basic_automation: false,
      advanced_segmentation: false,
      ab_testing: false,
      custom_domains: false,
      api_access: false,
      white_labeling: false,
      priority_support: false
    },
    quotas: {
      monthly_emails: 10000,
      subscribers: 2000,
      lists: 5,
      campaigns: 10,
      automations: 0,
      segments: 3,
      templates: 10,
      domains: 0,
      api_calls: 0,
      support_tickets: 2
    },
    permissions: [
      {
        resource: Resource.CAMPAIGNS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE],
        quotaLimits: { monthly_campaigns: 10 }
      },
      {
        resource: Resource.SUBSCRIBERS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.IMPORT, Action.EXPORT],
        quotaLimits: { total_subscribers: 2000 }
      },
      {
        resource: Resource.LISTS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        quotaLimits: { total_lists: 5 }
      },
      {
        resource: Resource.EMAIL_TEMPLATES,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        quotaLimits: { total_templates: 10 }
      },
      {
        resource: Resource.ANALYTICS,
        actions: [Action.READ],
        conditions: [
          {
            type: 'feature',
            field: 'basic_analytics',
            operator: 'eq',
            value: true,
            message: 'Basic analytics not available in your package'
          }
        ]
      }
    ],
    restrictions: [
      {
        type: 'feature_disabled',
        resource: Resource.AUTOMATIONS,
        message: 'Automation features require Standard package or higher'
      },
      {
        type: 'feature_disabled',
        resource: Resource.DOMAINS,
        message: 'Custom domains require Professional package or higher'
      }
    ]
  },
  {
    id: 'standard',
    name: 'Standard Package',
    description: 'Enhanced features with automation and better quotas',
    tier: PackageTier.STANDARD,
    features: {
      email_builder: true,
      basic_templates: true,
      premium_templates: true,
      email_tracking: true,
      basic_analytics: true,
      advanced_analytics: true,
      subscriber_management: true,
      list_management: true,
      basic_automation: true,
      advanced_segmentation: true,
      ab_testing: true,
      custom_domains: false,
      api_access: true,
      white_labeling: false,
      priority_support: false
    },
    quotas: {
      monthly_emails: 50000,
      subscribers: 10000,
      lists: 25,
      campaigns: 50,
      automations: 10,
      segments: 15,
      templates: 50,
      domains: 0,
      api_calls: 10000,
      support_tickets: 5
    },
    permissions: [
      {
        resource: Resource.CAMPAIGNS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE],
        quotaLimits: { monthly_campaigns: 50 }
      },
      {
        resource: Resource.SUBSCRIBERS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.IMPORT, Action.EXPORT],
        quotaLimits: { total_subscribers: 10000 }
      },
      {
        resource: Resource.LISTS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        quotaLimits: { total_lists: 25 }
      },
      {
        resource: Resource.AUTOMATIONS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE],
        quotaLimits: { total_automations: 10 }
      },
      {
        resource: Resource.SEGMENTS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        quotaLimits: { total_segments: 15 }
      },
      {
        resource: Resource.API_KEYS,
        actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        quotaLimits: { monthly_api_calls: 10000 }
      }
    ],
    restrictions: [
      {
        type: 'feature_disabled',
        resource: Resource.DOMAINS,
        message: 'Custom domains require Professional package or higher'
      }
    ]
  }
];

// Package permission checker
export class PackagePermissionChecker {
  constructor(private userPackageContext: UserPackageContext) { }

  /**
   * Check if user has permission to perform action on resource based on packages
   */
  hasPackagePermission(resource: Resource, action: Action): boolean {
    // Check if any active package grants this permission
    const activePackages = this.userPackageContext.packages.filter(
      pkg => pkg.status === 'active' && (!pkg.expiresAt || pkg.expiresAt > new Date())
    );

    if (activePackages.length === 0) {
      return false;
    }

    // Check permissions across all active packages
    for (const pkg of activePackages) {
      const resourcePermission = pkg.permissions.find(p => p.resource === resource);
      if (resourcePermission && this.checkResourcePermission(resourcePermission, action, pkg)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check resource permission with conditions and quotas
   */
  private checkResourcePermission(
    permission: PackageResourcePermission,
    action: Action,
    userPackage: UserPackage
  ): boolean {
    // Check if action is allowed
    if (!permission.actions.includes(action) && !permission.actions.includes(Action.MANAGE)) {
      return false;
    }

    // Check conditions
    if (permission.conditions) {
      for (const condition of permission.conditions) {
        if (!this.checkCondition(condition, userPackage)) {
          return false;
        }
      }
    }

    // Check quota limits
    if (permission.quotaLimits) {
      for (const [quotaKey, limit] of Object.entries(permission.quotaLimits)) {
        const currentUsage = userPackage.usage[quotaKey] || 0;
        if (currentUsage >= limit) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check individual permission condition
   */
  private checkCondition(condition: PermissionCondition, userPackage: UserPackage): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'feature':
        actualValue = userPackage.features[condition.field];
        break;
      case 'quota':
        actualValue = userPackage.quotas[condition.field];
        break;
      case 'usage':
        actualValue = userPackage.usage[condition.field] || 0;
        break;
      case 'time':
        actualValue = userPackage.expiresAt ? userPackage.expiresAt.getTime() : Infinity;
        break;
      default:
        return false;
    }

    return this.evaluateCondition(actualValue, condition.operator, condition.value);
  }

  /**
   * Evaluate condition operator
   */
  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'nin': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  /**
   * Get quota usage for a specific resource
   */
  getQuotaUsage(quotaKey: string): { used: number; limit: number; percentage: number } {
    const used = this.userPackageContext.currentUsage[quotaKey] || 0;
    const limit = this.userPackageContext.quotaLimits[quotaKey] || 0;
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return { used, limit, percentage };
  }

  /**
   * Check if quota is exceeded
   */
  isQuotaExceeded(quotaKey: string): boolean {
    const { used, limit } = this.getQuotaUsage(quotaKey);
    return used >= limit;
  }

  /**
   * Get all restrictions for current packages
   */
  getRestrictions(): PackageRestriction[] {
    const restrictions: PackageRestriction[] = [];

    for (const pkg of this.userPackageContext.packages) {
      if (pkg.status === 'active') {
        const template = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === pkg.tier);
        if (template) {
          restrictions.push(...template.restrictions);
        }
      }
    }

    return restrictions;
  }

  /**
   * Get feature availability
   */
  hasFeature(featureKey: string): boolean {
    const activePackages = this.userPackageContext.packages.filter(
      pkg => pkg.status === 'active' && (!pkg.expiresAt || pkg.expiresAt > new Date())
    );

    return activePackages.some(pkg => pkg.features[featureKey] === true);
  }

  /**
   * Get highest tier among active packages
   */
  getHighestTier(): PackageTier | null {
    const activePackages = this.userPackageContext.packages.filter(
      pkg => pkg.status === 'active' && (!pkg.expiresAt || pkg.expiresAt > new Date())
    );

    if (activePackages.length === 0) return null;

    const tierOrder = [
      PackageTier.BASIC,
      PackageTier.STANDARD,
      PackageTier.PROFESSIONAL,
      PackageTier.ENTERPRISE,
      PackageTier.UNLIMITED
    ];

    let highestTier = PackageTier.BASIC;
    for (const pkg of activePackages) {
      const currentIndex = tierOrder.indexOf(pkg.tier);
      const highestIndex = tierOrder.indexOf(highestTier);
      if (currentIndex > highestIndex) {
        highestTier = pkg.tier;
      }
    }

    return highestTier;
  }
}