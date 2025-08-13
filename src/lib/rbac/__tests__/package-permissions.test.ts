/**
 * Package Permissions Test Suite
 */

import { 
  PackagePermissionChecker, 
  PackageTier, 
  UserPackageContext,
  DEFAULT_PACKAGE_TEMPLATES 
} from '../package-permissions';
import { Resource, Action } from '../permissions';

describe('PackagePermissionChecker', () => {
  const mockUserPackageContext: UserPackageContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    packages: [
      {
        id: 'purchase-1',
        packageId: 'package-1',
        name: 'Standard Package',
        tier: PackageTier.STANDARD,
        features: {
          email_builder: true,
          basic_analytics: true,
          advanced_analytics: true,
          basic_automation: true,
          ab_testing: true,
          api_access: true
        },
        quotas: {
          monthly_emails: 50000,
          subscribers: 10000,
          campaigns: 50,
          automations: 10
        },
        usage: {
          monthly_emails: 25000,
          subscribers: 5000,
          campaigns: 20,
          automations: 3
        },
        status: 'active',
        permissions: [
          {
            resource: Resource.CAMPAIGNS,
            actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE],
            quotaLimits: { monthly_campaigns: 50 }
          },
          {
            resource: Resource.AUTOMATIONS,
            actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE],
            quotaLimits: { total_automations: 10 }
          }
        ]
      }
    ],
    effectivePermissions: [],
    currentUsage: {
      monthly_emails: 25000,
      subscribers: 5000,
      campaigns: 20,
      automations: 3
    },
    quotaLimits: {
      monthly_emails: 50000,
      subscribers: 10000,
      campaigns: 50,
      automations: 10
    }
  };

  let checker: PackagePermissionChecker;

  beforeEach(() => {
    checker = new PackagePermissionChecker(mockUserPackageContext);
  });

  describe('hasPackagePermission', () => {
    it('should allow access when user has permission', () => {
      const result = checker.hasPackagePermission(Resource.CAMPAIGNS, Action.CREATE);
      expect(result).toBe(true);
    });

    it('should deny access when user lacks permission', () => {
      const result = checker.hasPackagePermission(Resource.DOMAINS, Action.CREATE);
      expect(result).toBe(false);
    });

    it('should deny access when quota is exceeded', () => {
      // Mock exceeded quota
      const contextWithExceededQuota = {
        ...mockUserPackageContext,
        packages: [
          {
            ...mockUserPackageContext.packages[0],
            usage: {
              ...mockUserPackageContext.packages[0].usage,
              campaigns: 50 // At limit
            }
          }
        ]
      };

      const checkerWithExceededQuota = new PackagePermissionChecker(contextWithExceededQuota);
      const result = checkerWithExceededQuota.hasPackagePermission(Resource.CAMPAIGNS, Action.CREATE);
      expect(result).toBe(false);
    });

    it('should allow access with MANAGE permission', () => {
      const contextWithManage = {
        ...mockUserPackageContext,
        packages: [
          {
            ...mockUserPackageContext.packages[0],
            permissions: [
              {
                resource: Resource.CAMPAIGNS,
                actions: [Action.MANAGE],
                quotaLimits: { monthly_campaigns: 50 }
              }
            ]
          }
        ]
      };

      const checkerWithManage = new PackagePermissionChecker(contextWithManage);
      const result = checkerWithManage.hasPackagePermission(Resource.CAMPAIGNS, Action.DELETE);
      expect(result).toBe(true);
    });
  });

  describe('getQuotaUsage', () => {
    it('should return correct quota usage', () => {
      const usage = checker.getQuotaUsage('monthly_emails');
      expect(usage).toEqual({
        used: 25000,
        limit: 50000,
        percentage: 50
      });
    });

    it('should handle zero limit', () => {
      const usage = checker.getQuotaUsage('nonexistent_quota');
      expect(usage).toEqual({
        used: 0,
        limit: 0,
        percentage: 0
      });
    });

    it('should cap percentage at 100', () => {
      const contextWithOverage = {
        ...mockUserPackageContext,
        currentUsage: {
          ...mockUserPackageContext.currentUsage,
          monthly_emails: 60000 // Over limit
        }
      };

      const checkerWithOverage = new PackagePermissionChecker(contextWithOverage);
      const usage = checkerWithOverage.getQuotaUsage('monthly_emails');
      expect(usage.percentage).toBe(100);
    });
  });

  describe('isQuotaExceeded', () => {
    it('should return false when quota is not exceeded', () => {
      const result = checker.isQuotaExceeded('monthly_emails');
      expect(result).toBe(false);
    });

    it('should return true when quota is exceeded', () => {
      const contextWithExceeded = {
        ...mockUserPackageContext,
        currentUsage: {
          ...mockUserPackageContext.currentUsage,
          subscribers: 10000 // At limit
        }
      };

      const checkerWithExceeded = new PackagePermissionChecker(contextWithExceeded);
      const result = checkerWithExceeded.isQuotaExceeded('subscribers');
      expect(result).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should return true for available features', () => {
      const result = checker.hasFeature('email_builder');
      expect(result).toBe(true);
    });

    it('should return false for unavailable features', () => {
      const result = checker.hasFeature('white_labeling');
      expect(result).toBe(false);
    });

    it('should return false for expired packages', () => {
      const contextWithExpired = {
        ...mockUserPackageContext,
        packages: [
          {
            ...mockUserPackageContext.packages[0],
            status: 'expired' as const
          }
        ]
      };

      const checkerWithExpired = new PackagePermissionChecker(contextWithExpired);
      const result = checkerWithExpired.hasFeature('email_builder');
      expect(result).toBe(false);
    });
  });

  describe('getHighestTier', () => {
    it('should return highest tier from active packages', () => {
      const result = checker.getHighestTier();
      expect(result).toBe(PackageTier.STANDARD);
    });

    it('should return null when no active packages', () => {
      const contextWithoutPackages = {
        ...mockUserPackageContext,
        packages: []
      };

      const checkerWithoutPackages = new PackagePermissionChecker(contextWithoutPackages);
      const result = checkerWithoutPackages.getHighestTier();
      expect(result).toBe(null);
    });

    it('should return highest tier from multiple packages', () => {
      const contextWithMultiple = {
        ...mockUserPackageContext,
        packages: [
          {
            ...mockUserPackageContext.packages[0],
            tier: PackageTier.BASIC
          },
          {
            ...mockUserPackageContext.packages[0],
            id: 'purchase-2',
            tier: PackageTier.PROFESSIONAL
          }
        ]
      };

      const checkerWithMultiple = new PackagePermissionChecker(contextWithMultiple);
      const result = checkerWithMultiple.getHighestTier();
      expect(result).toBe(PackageTier.PROFESSIONAL);
    });
  });

  describe('getRestrictions', () => {
    it('should return restrictions for current tier', () => {
      const restrictions = checker.getRestrictions();
      expect(restrictions).toBeInstanceOf(Array);
      expect(restrictions.length).toBeGreaterThan(0);
    });
  });
});

describe('DEFAULT_PACKAGE_TEMPLATES', () => {
  it('should have basic template', () => {
    const basicTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.BASIC);
    expect(basicTemplate).toBeDefined();
    expect(basicTemplate?.name).toBe('Basic Package');
  });

  it('should have standard template', () => {
    const standardTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.STANDARD);
    expect(standardTemplate).toBeDefined();
    expect(standardTemplate?.name).toBe('Standard Package');
  });

  it('should have progressive feature availability', () => {
    const basicTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.BASIC);
    const standardTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.STANDARD);

    expect(basicTemplate?.features.basic_automation).toBe(false);
    expect(standardTemplate?.features.basic_automation).toBe(true);
  });

  it('should have progressive quota limits', () => {
    const basicTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.BASIC);
    const standardTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.STANDARD);

    expect(standardTemplate?.quotas.monthly_emails).toBeGreaterThan(basicTemplate?.quotas.monthly_emails || 0);
    expect(standardTemplate?.quotas.subscribers).toBeGreaterThan(basicTemplate?.quotas.subscribers || 0);
  });

  it('should have appropriate restrictions', () => {
    const basicTemplate = DEFAULT_PACKAGE_TEMPLATES.find(t => t.tier === PackageTier.BASIC);
    
    expect(basicTemplate?.restrictions).toBeInstanceOf(Array);
    expect(basicTemplate?.restrictions.length).toBeGreaterThan(0);
    
    const automationRestriction = basicTemplate?.restrictions.find(
      r => r.resource === Resource.AUTOMATIONS
    );
    expect(automationRestriction).toBeDefined();
  });
});