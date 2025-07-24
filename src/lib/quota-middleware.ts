import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SubscriptionService } from '@/services/subscription.service';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';

// Initialize services (in production, these would be dependency injected)
const paymentService = new PaymentService([
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    config: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
    priority: 1,
  },
]);

const subscriptionService = new SubscriptionService(paymentService);

export interface QuotaCheckConfig {
  resourceType:
    | 'emailsPerMonth'
    | 'subscribersLimit'
    | 'campaignsPerMonth'
    | 'automationsLimit'
    | 'customDomains';
  requestedAmount?: number;
  allowOverage?: boolean;
  errorMessage?: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  isOverage: boolean;
  overageAmount?: number;
  errorMessage?: string;
}

/**
 * Middleware to check quota limits before allowing operations
 */
export async function checkQuotaLimit(
  request: NextRequest,
  config: QuotaCheckConfig
): Promise<QuotaCheckResult> {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        isOverage: false,
        errorMessage: 'Unauthorized',
      };
    }

    const quotaCheck = await subscriptionService.checkQuotaLimit(
      session.user.tenantId,
      config.resourceType,
      config.requestedAmount || 1
    );

    const isOverage = !quotaCheck.allowed && Boolean(config.allowOverage);
    const overageAmount = isOverage
      ? (config.requestedAmount || 1) - quotaCheck.remaining
      : undefined;

    return {
      allowed: quotaCheck.allowed || config.allowOverage || false,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      isOverage,
      overageAmount,
      errorMessage:
        !quotaCheck.allowed && !config.allowOverage
          ? config.errorMessage || `Quota limit exceeded for ${config.resourceType}`
          : undefined,
    };
  } catch (error) {
    console.error('Quota check failed:', error);
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      isOverage: false,
      errorMessage: 'Failed to check quota limits',
    };
  }
}

/**
 * Higher-order function to wrap API routes with quota checking
 */
export function withQuotaCheck(
  config: QuotaCheckConfig,
  handler: (request: NextRequest, quotaResult: QuotaCheckResult) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const quotaResult = await checkQuotaLimit(request, config);

    if (!quotaResult.allowed) {
      return NextResponse.json(
        {
          error: quotaResult.errorMessage,
          quotaExceeded: true,
          remaining: quotaResult.remaining,
          limit: quotaResult.limit,
        },
        { status: 429 } // Too Many Requests
      );
    }

    return handler(request, quotaResult);
  };
}

/**
 * Update usage after successful operation
 */
export async function updateUsageAfterOperation(
  tenantId: string,
  resourceType:
    | 'emailsSent'
    | 'subscribersCount'
    | 'campaignsCreated'
    | 'automationsActive'
    | 'domainsUsed'
    | 'apiCallsUsed'
    | 'storageUsed',
  increment: number = 1
): Promise<void> {
  try {
    await subscriptionService.updateUsage(tenantId, resourceType, increment);
  } catch (error) {
    console.error('Failed to update usage:', error);
    // Don't throw error as this shouldn't break the main operation
  }
}

/**
 * Quota enforcement decorator for service methods
 */
export function enforceQuota(config: QuotaCheckConfig) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract tenant ID from the first argument (assuming it's always passed)
      const tenantId = args[0];

      if (!tenantId) {
        throw new Error('Tenant ID is required for quota enforcement');
      }

      const quotaCheck = await subscriptionService.checkQuotaLimit(
        tenantId,
        config.resourceType,
        config.requestedAmount || 1
      );

      if (!quotaCheck.allowed && !config.allowOverage) {
        throw new Error(config.errorMessage || `Quota limit exceeded for ${config.resourceType}`);
      }

      // Execute the original method
      const result = await method.apply(this, args);

      // Update usage after successful operation
      const usageType = mapResourceTypeToUsage(config.resourceType);
      if (usageType) {
        await updateUsageAfterOperation(tenantId, usageType, config.requestedAmount || 1);
      }

      return result;
    };
  };
}

/**
 * Feature access checker
 */
export async function checkFeatureAccess(
  tenantId: string,
  feature: string
): Promise<{ hasAccess: boolean; planName?: string; upgradeRequired?: boolean }> {
  try {
    const subscription = await subscriptionService.getTenantSubscription(tenantId);

    if (!subscription) {
      return { hasAccess: false, upgradeRequired: true };
    }

    const features = subscription.plan.features as any;
    const hasAccess = Boolean(features[feature]);

    return {
      hasAccess,
      planName: subscription.plan.name,
      upgradeRequired: !hasAccess,
    };
  } catch (error) {
    console.error('Feature access check failed:', error);
    return { hasAccess: false, upgradeRequired: true };
  }
}

/**
 * Feature access middleware
 */
export function withFeatureAccess(
  feature: string,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const featureCheck = await checkFeatureAccess(session.user.tenantId, feature);

    if (!featureCheck.hasAccess) {
      return NextResponse.json(
        {
          error: `Feature '${feature}' is not available in your current plan`,
          featureRestricted: true,
          currentPlan: featureCheck.planName,
          upgradeRequired: featureCheck.upgradeRequired,
        },
        { status: 403 } // Forbidden
      );
    }

    return handler(request);
  };
}

/**
 * Bulk quota checker for multiple resources
 */
export async function checkMultipleQuotas(
  tenantId: string,
  checks: Array<{ resourceType: QuotaCheckConfig['resourceType']; requestedAmount?: number }>
): Promise<Record<string, QuotaCheckResult>> {
  const results: Record<string, QuotaCheckResult> = {};

  for (const check of checks) {
    try {
      const quotaCheck = await subscriptionService.checkQuotaLimit(
        tenantId,
        check.resourceType,
        check.requestedAmount || 1
      );

      results[check.resourceType] = {
        allowed: quotaCheck.allowed,
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
        isOverage: false,
      };
    } catch (error) {
      results[check.resourceType] = {
        allowed: false,
        remaining: 0,
        limit: 0,
        isOverage: false,
        errorMessage: 'Failed to check quota',
      };
    }
  }

  return results;
}

/**
 * Usage tracking helper
 */
export class UsageTracker {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async trackEmailSent(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'emailsSent', count);
  }

  async trackSubscriberAdded(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'subscribersCount', count);
  }

  async trackCampaignCreated(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'campaignsCreated', count);
  }

  async trackAutomationActivated(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'automationsActive', count);
  }

  async trackDomainAdded(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'domainsUsed', count);
  }

  async trackApiCall(count: number = 1): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'apiCallsUsed', count);
  }

  async trackStorageUsed(sizeInMB: number): Promise<void> {
    await updateUsageAfterOperation(this.tenantId, 'storageUsed', sizeInMB);
  }
}

// Helper function to map resource types to usage types
function mapResourceTypeToUsage(
  resourceType: QuotaCheckConfig['resourceType']
):
  | 'emailsSent'
  | 'subscribersCount'
  | 'campaignsCreated'
  | 'automationsActive'
  | 'domainsUsed'
  | null {
  const mapping: Record<QuotaCheckConfig['resourceType'], any> = {
    emailsPerMonth: 'emailsSent',
    subscribersLimit: 'subscribersCount',
    campaignsPerMonth: 'campaignsCreated',
    automationsLimit: 'automationsActive',
    customDomains: 'domainsUsed',
  };

  return mapping[resourceType] || null;
}

// Export commonly used quota configurations
export const QUOTA_CONFIGS = {
  EMAIL_SENDING: {
    resourceType: 'emailsPerMonth' as const,
    allowOverage: true,
    errorMessage: 'Monthly email sending limit exceeded',
  },
  SUBSCRIBER_LIMIT: {
    resourceType: 'subscribersLimit' as const,
    allowOverage: false,
    errorMessage: 'Subscriber limit exceeded. Please upgrade your plan.',
  },
  CAMPAIGN_CREATION: {
    resourceType: 'campaignsPerMonth' as const,
    allowOverage: false,
    errorMessage: 'Monthly campaign creation limit exceeded',
  },
  AUTOMATION_LIMIT: {
    resourceType: 'automationsLimit' as const,
    allowOverage: false,
    errorMessage: 'Automation limit exceeded. Please upgrade your plan.',
  },
  DOMAIN_LIMIT: {
    resourceType: 'customDomains' as const,
    allowOverage: false,
    errorMessage: 'Custom domain limit exceeded. Please upgrade your plan.',
  },
} as const;
