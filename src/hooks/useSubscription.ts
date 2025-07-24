'use client';

import { useState, useEffect, useCallback } from 'react';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly';
  features: {
    emailsPerMonth: number;
    subscribersLimit: number;
    campaignsPerMonth: number;
    automationsLimit: number;
    customDomains: number;
    apiAccess: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    whiteLabel: boolean;
    customIntegrations: boolean;
    advancedSegmentation: boolean;
    abTesting: boolean;
    multiUser: boolean;
    maxUsers?: number;
  };
  isActive: boolean;
  trialDays?: number;
}

interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  usage: {
    emailsSent: number;
    subscribersCount: number;
    campaignsCreated: number;
    automationsActive: number;
    domainsUsed: number;
    apiCallsUsed: number;
    storageUsed: number;
    lastUpdated: string;
  };
}

interface UsageQuota {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/subscriptions?action=current');
      if (!response.ok) {
        throw new Error('Failed to load subscription');
      }
      
      const data = await response.json();
      setSubscription(data.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/subscriptions?action=plans');
      if (!response.ok) {
        throw new Error('Failed to load plans');
      }
      
      const data = await response.json();
      setPlans(data.plans);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }, []);

  const checkQuota = useCallback(async (
    resourceType: keyof SubscriptionPlan['features'],
    requestedAmount: number = 1
  ): Promise<UsageQuota> => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_quota',
          resourceType,
          requestedAmount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check quota');
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to check quota:', err);
      return { allowed: false, remaining: 0, limit: 0 };
    }
  }, []);

  const updateUsage = useCallback(async (
    resourceType: keyof TenantSubscription['usage'],
    increment: number = 1
  ): Promise<void> => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_usage',
          resourceType,
          increment
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update usage');
      }

      // Reload subscription to get updated usage
      await loadSubscription();
    } catch (err) {
      console.error('Failed to update usage:', err);
    }
  }, [loadSubscription]);

  const upgradeSubscription = useCallback(async (
    newPlanId: string,
    prorationBehavior: 'immediate' | 'next_cycle' = 'immediate'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade',
          newPlanId,
          prorationBehavior
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upgrade subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upgrade subscription'
      };
    }
  }, []);

  const downgradeSubscription = useCallback(async (
    newPlanId: string,
    downgradeAt: 'immediate' | 'period_end' = 'period_end'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'downgrade',
          newPlanId,
          downgradeAt
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to downgrade subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to downgrade subscription'
      };
    }
  }, []);

  const cancelSubscription = useCallback(async (
    cancelAt: 'immediate' | 'period_end' = 'period_end'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          cancelAt
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel subscription'
      };
    }
  }, []);

  // Helper functions
  const hasFeature = useCallback((feature: keyof SubscriptionPlan['features']): boolean => {
    if (!subscription) return false;
    return Boolean(subscription.plan.features[feature]);
  }, [subscription]);

  const getUsagePercentage = useCallback((resourceType: keyof TenantSubscription['usage']): number => {
    if (!subscription) return 0;
    
    const usage = subscription.usage[resourceType] as number;
    let limit: number;
    
    switch (resourceType) {
      case 'emailsSent':
        limit = subscription.plan.features.emailsPerMonth;
        break;
      case 'subscribersCount':
        limit = subscription.plan.features.subscribersLimit;
        break;
      case 'campaignsCreated':
        limit = subscription.plan.features.campaignsPerMonth;
        break;
      case 'automationsActive':
        limit = subscription.plan.features.automationsLimit;
        break;
      case 'domainsUsed':
        limit = subscription.plan.features.customDomains;
        break;
      default:
        return 0;
    }
    
    return limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
  }, [subscription]);

  const isNearLimit = useCallback((resourceType: keyof TenantSubscription['usage'], threshold: number = 80): boolean => {
    return getUsagePercentage(resourceType) >= threshold;
  }, [getUsagePercentage]);

  const isOverLimit = useCallback((resourceType: keyof TenantSubscription['usage']): boolean => {
    return getUsagePercentage(resourceType) >= 100;
  }, [getUsagePercentage]);

  const getRemainingQuota = useCallback((resourceType: keyof TenantSubscription['usage']): number => {
    if (!subscription) return 0;
    
    const usage = subscription.usage[resourceType] as number;
    let limit: number;
    
    switch (resourceType) {
      case 'emailsSent':
        limit = subscription.plan.features.emailsPerMonth;
        break;
      case 'subscribersCount':
        limit = subscription.plan.features.subscribersLimit;
        break;
      case 'campaignsCreated':
        limit = subscription.plan.features.campaignsPerMonth;
        break;
      case 'automationsActive':
        limit = subscription.plan.features.automationsLimit;
        break;
      case 'domainsUsed':
        limit = subscription.plan.features.customDomains;
        break;
      default:
        return 0;
    }
    
    return Math.max(0, limit - usage);
  }, [subscription]);

  const isTrialActive = useCallback((): boolean => {
    if (!subscription?.trialEnd) return false;
    return new Date(subscription.trialEnd) > new Date();
  }, [subscription]);

  const getDaysUntilRenewal = useCallback((): number => {
    if (!subscription) return 0;
    const renewalDate = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const diffTime = renewalDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [subscription]);

  useEffect(() => {
    loadSubscription();
    loadPlans();
  }, [loadSubscription, loadPlans]);

  return {
    subscription,
    plans,
    loading,
    error,
    
    // Actions
    loadSubscription,
    loadPlans,
    checkQuota,
    updateUsage,
    upgradeSubscription,
    downgradeSubscription,
    cancelSubscription,
    
    // Helpers
    hasFeature,
    getUsagePercentage,
    isNearLimit,
    isOverLimit,
    getRemainingQuota,
    isTrialActive,
    getDaysUntilRenewal
  };
}