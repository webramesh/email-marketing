'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

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



export function SubscriptionManager() {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Load current subscription
      const subscriptionResponse = await fetch('/api/subscriptions?action=current');
      const subscriptionData = await subscriptionResponse.json();
      
      // Load available plans
      const plansResponse = await fetch('/api/subscriptions?action=plans');
      const plansData = await plansResponse.json();
      
      setSubscription(subscriptionData.subscription);
      setPlans(plansData.plans);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string, prorationBehavior: 'immediate' | 'next_cycle' = 'immediate') => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade',
          newPlanId: planId,
          prorationBehavior
        })
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      setShowUpgradeModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Failed to upgrade subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDowngrade = async (planId: string, downgradeAt: 'immediate' | 'period_end' = 'period_end') => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'downgrade',
          newPlanId: planId,
          downgradeAt
        })
      });

      if (!response.ok) {
        throw new Error('Failed to downgrade subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      setShowUpgradeModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Downgrade failed:', error);
      alert('Failed to downgrade subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (cancelAt: 'immediate' | 'period_end' = 'period_end') => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          cancelAt
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const result = await response.json();
      setSubscription(result.subscription);
      setShowCancelModal(false);
    } catch (error) {
      console.error('Cancellation failed:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: number, currency: string, cycle: string) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    });
    return `${formatter.format(price)}/${cycle}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      {subscription && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Current Subscription</h2>
            <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
              {subscription.status}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-lg mb-2">{subscription.plan.name}</h3>
              <p className="text-gray-600 mb-4">
                {formatPrice(subscription.plan.price, subscription.plan.currency, subscription.plan.billingCycle)}
              </p>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Current period:</span>
                  <span className="ml-2">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
                
                {subscription.cancelAtPeriodEnd && (
                  <div className="text-red-600">
                    Subscription will cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}
                
                {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                  <div className="text-blue-600">
                    Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={() => setShowUpgradeModal(true)}
                variant="primary"
                size="sm"
              >
                Change Plan
              </Button>
              
              {!subscription.cancelAtPeriodEnd && (
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Usage Overview */}
      {subscription && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Usage Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Emails Sent</span>
                <span className="text-sm text-gray-600">
                  {formatNumber(subscription.usage.emailsSent)} / {formatNumber(subscription.plan.features.emailsPerMonth)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(subscription.usage.emailsSent, subscription.plan.features.emailsPerMonth))} bg-current`}
                  style={{
                    width: `${getUsagePercentage(subscription.usage.emailsSent, subscription.plan.features.emailsPerMonth)}%`
                  }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Subscribers</span>
                <span className="text-sm text-gray-600">
                  {formatNumber(subscription.usage.subscribersCount)} / {formatNumber(subscription.plan.features.subscribersLimit)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(subscription.usage.subscribersCount, subscription.plan.features.subscribersLimit))} bg-current`}
                  style={{
                    width: `${getUsagePercentage(subscription.usage.subscribersCount, subscription.plan.features.subscribersLimit)}%`
                  }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Campaigns</span>
                <span className="text-sm text-gray-600">
                  {subscription.usage.campaignsCreated} / {subscription.plan.features.campaignsPerMonth}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(subscription.usage.campaignsCreated, subscription.plan.features.campaignsPerMonth))} bg-current`}
                  style={{
                    width: `${getUsagePercentage(subscription.usage.campaignsCreated, subscription.plan.features.campaignsPerMonth)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Plan Change Modal */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setSelectedPlan(null);
        }}
        title="Change Subscription Plan"
      >
        <div className="space-y-4">
          <div className="grid gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedPlan?.id === plan.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium">{plan.name}</h3>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatPrice(plan.price, plan.currency, plan.billingCycle)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>📧 {formatNumber(plan.features.emailsPerMonth)} emails/month</div>
                  <div>👥 {formatNumber(plan.features.subscribersLimit)} subscribers</div>
                  <div>📊 {plan.features.campaignsPerMonth} campaigns/month</div>
                  <div>🤖 {plan.features.automationsLimit} automations</div>
                </div>
              </div>
            ))}
          </div>
          
          {selectedPlan && (
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedPlan(null);
                }}
                variant="outline"
                disabled={processing}
              >
                Cancel
              </Button>
              
              {subscription && selectedPlan.price > subscription.plan.price ? (
                <Button
                  onClick={() => handleUpgrade(selectedPlan.id)}
                  variant="primary"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Upgrade Now'}
                </Button>
              ) : (
                <Button
                  onClick={() => handleDowngrade(selectedPlan.id)}
                  variant="primary"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Downgrade'}
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Subscription"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel your subscription? You can choose when the cancellation takes effect.
          </p>
          
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => setShowCancelModal(false)}
              variant="outline"
              disabled={processing}
            >
              Keep Subscription
            </Button>
            
            <Button
              onClick={() => handleCancel('period_end')}
              variant="outline"
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Cancel at Period End'}
            </Button>
            
            <Button
              onClick={() => handleCancel('immediate')}
              variant="outline"
              disabled={processing}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              {processing ? 'Processing...' : 'Cancel Immediately'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}