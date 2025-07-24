import { prisma } from '@/lib/prisma';
import { PaymentService } from './payment/payment.service';
import { PaymentProviderType, SubscriptionRequest } from '@/types/payment';

// Define enums locally since they're not exported from Prisma yet
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  UNPAID = 'UNPAID',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
}

export enum BillingCycleStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE',
}

export enum OverageBillingStatus {
  PENDING = 'PENDING',
  BILLED = 'BILLED',
  PAID = 'PAID',
}

export enum SubscriptionChangeType {
  UPGRADE = 'UPGRADE',
  DOWNGRADE = 'DOWNGRADE',
  PLAN_CHANGE = 'PLAN_CHANGE',
}

export enum SubscriptionChangeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly';
  features: SubscriptionFeatures;
  quotas: SubscriptionQuotas;
  isActive: boolean;
  trialDays?: number;
  setupFee?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionFeatures {
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
}

export interface SubscriptionQuotas {
  emailsSent: number;
  subscribersCount: number;
  campaignsCreated: number;
  automationsActive: number;
  domainsUsed: number;
  apiCallsUsed: number;
  storageUsed: number; // in MB
  lastResetAt: Date;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  customerId: string;
  subscriptionId: string; // Provider subscription ID
  paymentProvider: PaymentProviderType;
  quotas: SubscriptionQuotas;
  usage: UsageMetrics;
  billingAddress?: BillingAddress;
  taxRate?: number;
  discountId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface UsageMetrics {
  emailsSent: number;
  subscribersCount: number;
  campaignsCreated: number;
  automationsActive: number;
  domainsUsed: number;
  apiCallsUsed: number;
  storageUsed: number;
  lastUpdated: Date;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: Date;
  paidAt?: Date;
  periodStart: Date;
  periodEnd: Date;
  lineItems: InvoiceLineItem[];
  billingAddress?: BillingAddress;
  paymentProvider: PaymentProviderType;
  providerInvoiceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'subscription' | 'overage' | 'setup' | 'discount' | 'tax';
  metadata?: Record<string, any>;
}

export interface OverageBilling {
  id: string;
  tenantId: string;
  subscriptionId: string;
  resourceType: 'emails' | 'subscribers' | 'campaigns' | 'storage' | 'api_calls';
  quotaLimit: number;
  actualUsage: number;
  overageAmount: number;
  unitPrice: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  status: 'pending' | 'billed' | 'paid';
  invoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProrationCalculation {
  oldPlanAmount: number;
  newPlanAmount: number;
  prorationAmount: number;
  creditsApplied: number;
  additionalCharges: number;
  effectiveDate: Date;
  nextBillingDate: Date;
}

export class SubscriptionService {
  constructor(private paymentService: PaymentService) {}

  async createSubscriptionPlan(
    planData: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SubscriptionPlan> {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: planData.name,
        ...(planData.description && { description: planData.description }),
        price: planData.price,
        billingCycle: planData.billingCycle,
        features: planData.features as any,
        quotas: planData.quotas as any,
        ...(planData.trialDays && { trialDays: planData.trialDays }),
        ...(planData.setupFee && { setupFee: planData.setupFee }),
        ...(planData.metadata && { metadata: planData.metadata as any }),
      },
    });

    return this.mapToSubscriptionPlan(plan);
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    return plans.map(this.mapToSubscriptionPlan);
  }

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    return plan ? this.mapToSubscriptionPlan(plan) : null;
  }

  async createTenantSubscription(
    tenantId: string,
    planId: string,
    customerId: string,
    paymentProvider: PaymentProviderType,
    billingAddress?: BillingAddress,
    trialDays?: number
  ): Promise<TenantSubscription> {
    const plan = await this.getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Create subscription with payment provider
    const subscriptionRequest: SubscriptionRequest = {
      customerId,
      planId,
      trialDays: trialDays || plan.trialDays,
      metadata: {
        tenantId,
        planName: plan.name,
      },
    };

    const subscriptionResult = await this.paymentService.createSubscription(
      subscriptionRequest,
      paymentProvider
    );

    if (!subscriptionResult.success) {
      throw new Error(`Failed to create subscription: ${subscriptionResult.error}`);
    }

    // Initialize quotas and usage
    const initialQuotas: SubscriptionQuotas = {
      emailsSent: 0,
      subscribersCount: 0,
      campaignsCreated: 0,
      automationsActive: 0,
      domainsUsed: 0,
      apiCallsUsed: 0,
      storageUsed: 0,
      lastResetAt: new Date(),
    };

    const initialUsage: UsageMetrics = {
      emailsSent: 0,
      subscribersCount: 0,
      campaignsCreated: 0,
      automationsActive: 0,
      domainsUsed: 0,
      apiCallsUsed: 0,
      storageUsed: 0,
      lastUpdated: new Date(),
    };

    // Store subscription in database
    const subscription = await prisma.$transaction(async tx => {
      // Update tenant with subscription plan
      await tx.tenant.update({
        where: { id: tenantId },
        data: { subscriptionPlanId: planId },
      });

      // Create tenant subscription record
      const dbSubscription = await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: subscriptionResult.status as any,
          currentPeriodStart: subscriptionResult.currentPeriodStart,
          currentPeriodEnd: subscriptionResult.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          trialEnd: trialDays ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : undefined,
          customerId,
          subscriptionId: subscriptionResult.subscriptionId,
          paymentProvider: paymentProvider as string,
          quotas: initialQuotas as any,
          usage: initialUsage as any,
          billingAddress: billingAddress as any,
        },
        include: {
          plan: true,
        },
      });

      return {
        id: dbSubscription.id,
        tenantId: dbSubscription.tenantId,
        planId: dbSubscription.planId,
        plan,
        status: dbSubscription.status as SubscriptionStatus,
        currentPeriodStart: dbSubscription.currentPeriodStart,
        currentPeriodEnd: dbSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: dbSubscription.cancelAtPeriodEnd,
        trialEnd: dbSubscription.trialEnd,
        customerId: dbSubscription.customerId,
        subscriptionId: dbSubscription.subscriptionId,
        paymentProvider: dbSubscription.paymentProvider as PaymentProviderType,
        quotas: initialQuotas,
        usage: initialUsage,
        billingAddress,
        taxRate: dbSubscription.taxRate,
        discountId: dbSubscription.discountId,
        metadata: dbSubscription.metadata as Record<string, any>,
        createdAt: dbSubscription.createdAt,
        updatedAt: dbSubscription.updatedAt,
      } as TenantSubscription;
    });

    return subscription;
  }

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return null;
    }

    const plan = this.mapToSubscriptionPlan(subscription.plan);

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      plan,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd || undefined,
      customerId: subscription.customerId,
      subscriptionId: subscription.subscriptionId,
      paymentProvider: subscription.paymentProvider as PaymentProviderType,
      quotas: subscription.quotas as unknown as SubscriptionQuotas,
      usage: subscription.usage as unknown as UsageMetrics,
      billingAddress: subscription.billingAddress as unknown as BillingAddress,
      taxRate: subscription.taxRate || undefined,
      discountId: subscription.discountId || undefined,
      metadata: subscription.metadata as Record<string, any>,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  async updateUsage(
    tenantId: string,
    resourceType: keyof UsageMetrics,
    increment: number = 1
  ): Promise<void> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Update usage metrics in database
    const updatedUsage = { ...subscription.usage };
    if (resourceType !== 'lastUpdated') {
      updatedUsage[resourceType] = (updatedUsage[resourceType] as number) + increment;
    }
    updatedUsage.lastUpdated = new Date();

    await prisma.tenantSubscription.update({
      where: { tenantId },
      data: {
        usage: updatedUsage as any,
        updatedAt: new Date(),
      },
    });

    // Check quotas and handle overages
    const updatedSubscription = { ...subscription, usage: updatedUsage };
    await this.checkQuotasAndHandleOverages(updatedSubscription, resourceType);
  }

  async checkQuotaLimit(
    tenantId: string,
    resourceType: keyof SubscriptionFeatures,
    requestedAmount: number = 1
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const limit = subscription.plan.features[resourceType] as number;
    const currentUsage = subscription.usage[this.mapResourceTypeToUsage(resourceType)] as number;
    const remaining = Math.max(0, limit - currentUsage);
    const allowed = currentUsage + requestedAmount <= limit;

    return { allowed, remaining, limit };
  }

  async upgradeSubscription(
    tenantId: string,
    newPlanId: string,
    prorationBehavior: 'immediate' | 'next_cycle' = 'immediate'
  ): Promise<{ subscription: TenantSubscription; proration: ProrationCalculation }> {
    const currentSubscription = await this.getTenantSubscription(tenantId);
    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    const newPlan = await this.getSubscriptionPlan(newPlanId);
    if (!newPlan) {
      throw new Error('New subscription plan not found');
    }

    // Calculate proration
    const proration = this.calculateProration(currentSubscription, newPlan, prorationBehavior);

    // Create subscription change record
    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: currentSubscription.id,
        changeType: 'UPGRADE',
        fromPlanId: currentSubscription.planId,
        toPlanId: newPlanId,
        prorationAmount: proration.additionalCharges,
        effectiveDate: proration.effectiveDate,
        status: 'PENDING',
      },
    });

    // Update subscription in database
    const updatedDbSubscription = await prisma.tenantSubscription.update({
      where: { tenantId },
      data: {
        planId: newPlanId,
        updatedAt: new Date(),
      },
      include: {
        plan: true,
      },
    });

    const updatedSubscription: TenantSubscription = {
      ...currentSubscription,
      planId: newPlanId,
      plan: newPlan,
      updatedAt: updatedDbSubscription.updatedAt,
    };

    // Generate invoice for proration if needed
    if (proration.additionalCharges > 0) {
      await this.generateProrationInvoice(updatedSubscription, proration);
    }

    // Mark subscription change as completed
    await prisma.subscriptionChange.updateMany({
      where: {
        subscriptionId: currentSubscription.id,
        status: 'PENDING',
        changeType: 'UPGRADE',
      },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    return { subscription: updatedSubscription, proration };
  }

  async downgradeSubscription(
    tenantId: string,
    newPlanId: string,
    downgradeAt: 'immediate' | 'period_end' = 'period_end'
  ): Promise<{ subscription: TenantSubscription; proration?: ProrationCalculation }> {
    const currentSubscription = await this.getTenantSubscription(tenantId);
    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    const newPlan = await this.getSubscriptionPlan(newPlanId);
    if (!newPlan) {
      throw new Error('New subscription plan not found');
    }

    if (downgradeAt === 'immediate') {
      const proration = this.calculateProration(currentSubscription, newPlan, 'immediate');

      const updatedSubscription: TenantSubscription = {
        ...currentSubscription,
        planId: newPlanId,
        plan: newPlan,
        updatedAt: new Date(),
      };

      // Apply credits if downgrading immediately
      if (proration.creditsApplied > 0) {
        await this.applyCreditToAccount(tenantId, proration.creditsApplied);
      }

      return { subscription: updatedSubscription, proration };
    } else {
      // Schedule downgrade at period end
      const updatedSubscription: TenantSubscription = {
        ...currentSubscription,
        cancelAtPeriodEnd: true,
        metadata: {
          ...currentSubscription.metadata,
          pendingDowngrade: {
            newPlanId,
            effectiveDate: currentSubscription.currentPeriodEnd,
          },
        },
        updatedAt: new Date(),
      };

      return { subscription: updatedSubscription };
    }
  }

  async cancelSubscription(
    tenantId: string,
    cancelAt: 'immediate' | 'period_end' = 'period_end'
  ): Promise<TenantSubscription> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    if (cancelAt === 'immediate') {
      // Cancel immediately with payment provider
      await this.paymentService.cancelSubscription(
        subscription.subscriptionId,
        subscription.paymentProvider
      );

      return {
        ...subscription,
        status: SubscriptionStatus.CANCELLED,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      };
    } else {
      // Cancel at period end
      return {
        ...subscription,
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      };
    }
  }

  async generateInvoice(tenantId: string, periodStart: Date, periodEnd: Date): Promise<Invoice> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const lineItems: InvoiceLineItem[] = [];

    // Add subscription fee
    lineItems.push({
      id: `li_sub_${Date.now()}`,
      description: `${subscription.plan.name} - ${this.formatPeriod(periodStart, periodEnd)}`,
      quantity: 1,
      unitPrice: subscription.plan.price,
      amount: subscription.plan.price,
      type: 'subscription',
    });

    // Add overage charges
    const overages = await this.calculateOverageCharges(subscription, periodStart, periodEnd);
    for (const overage of overages) {
      lineItems.push({
        id: `li_overage_${Date.now()}_${overage.resourceType}`,
        description: `${overage.resourceType} overage (${overage.overageAmount} units)`,
        quantity: overage.overageAmount,
        unitPrice: overage.unitPrice,
        amount: overage.overageAmount * overage.unitPrice,
        type: 'overage',
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = this.calculateTax(subtotal, subscription.billingAddress?.country);
    const total = subtotal + taxAmount;

    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: this.generateInvoiceNumber(),
      status: 'open',
      currency: subscription.plan.currency,
      subtotal,
      taxAmount,
      discountAmount: 0,
      total,
      amountPaid: 0,
      amountDue: total,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      periodStart,
      periodEnd,
      lineItems,
      billingAddress: subscription.billingAddress,
      paymentProvider: subscription.paymentProvider,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return invoice;
  }

  private async checkQuotasAndHandleOverages(
    subscription: TenantSubscription,
    resourceType: keyof UsageMetrics
  ): Promise<void> {
    const featureKey = this.mapUsageToFeatureType(resourceType);
    const limit = subscription.plan.features[featureKey] as number;
    const currentUsage = subscription.usage[resourceType] as number;

    if (currentUsage > limit) {
      const overageAmount = currentUsage - limit;
      await this.createOverageBilling(subscription, resourceType, overageAmount);
    }
  }

  private async createOverageBilling(
    subscription: TenantSubscription,
    resourceType: keyof UsageMetrics,
    overageAmount: number
  ): Promise<void> {
    const unitPrice = this.getOverageUnitPrice(resourceType);

    // Store overage billing in database
    await prisma.overageBilling.create({
      data: {
        subscriptionId: subscription.id,
        resourceType: resourceType as string,
        quotaLimit: subscription.plan.features[this.mapUsageToFeatureType(resourceType)] as number,
        actualUsage: subscription.usage[resourceType] as number,
        overageAmount,
        unitPrice,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
        status: 'PENDING',
      },
    });

    console.log(
      `Created overage billing for ${resourceType}: ${overageAmount} units at $${unitPrice} each`
    );
  }

  private calculateProration(
    currentSubscription: TenantSubscription,
    newPlan: SubscriptionPlan,
    behavior: 'immediate' | 'next_cycle'
  ): ProrationCalculation {
    const now = new Date();
    const periodEnd = currentSubscription.currentPeriodEnd;
    const remainingDays = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    );
    const totalDays = Math.ceil(
      (periodEnd.getTime() - currentSubscription.currentPeriodStart.getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const oldPlanAmount = currentSubscription.plan.price;
    const newPlanAmount = newPlan.price;

    if (behavior === 'next_cycle') {
      return {
        oldPlanAmount,
        newPlanAmount,
        prorationAmount: 0,
        creditsApplied: 0,
        additionalCharges: 0,
        effectiveDate: periodEnd,
        nextBillingDate: periodEnd,
      };
    }

    // Calculate proration for immediate change
    const unusedAmount = (oldPlanAmount * remainingDays) / totalDays;
    const newPlanProrated = (newPlanAmount * remainingDays) / totalDays;
    const prorationAmount = newPlanProrated - unusedAmount;

    return {
      oldPlanAmount,
      newPlanAmount,
      prorationAmount,
      creditsApplied: prorationAmount < 0 ? Math.abs(prorationAmount) : 0,
      additionalCharges: prorationAmount > 0 ? prorationAmount : 0,
      effectiveDate: now,
      nextBillingDate: periodEnd,
    };
  }

  private async generateProrationInvoice(
    subscription: TenantSubscription,
    proration: ProrationCalculation
  ): Promise<Invoice> {
    const lineItems: InvoiceLineItem[] = [];

    if (proration.additionalCharges > 0) {
      lineItems.push({
        id: `li_proration_${Date.now()}`,
        description: `Plan upgrade proration`,
        quantity: 1,
        unitPrice: proration.additionalCharges,
        amount: proration.additionalCharges,
        type: 'subscription',
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = this.calculateTax(subtotal, subscription.billingAddress?.country);
    const total = subtotal + taxAmount;

    return {
      id: `inv_proration_${Date.now()}`,
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: this.generateInvoiceNumber(),
      status: 'open',
      currency: subscription.plan.currency,
      subtotal,
      taxAmount,
      discountAmount: 0,
      total,
      amountPaid: 0,
      amountDue: total,
      dueDate: new Date(), // Due immediately
      periodStart: proration.effectiveDate,
      periodEnd: proration.effectiveDate,
      lineItems,
      billingAddress: subscription.billingAddress,
      paymentProvider: subscription.paymentProvider,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async applyCreditToAccount(tenantId: string, creditAmount: number): Promise<void> {
    // Create a credit record in the database
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'CREDIT_APPLIED',
        resource: 'subscription',
        metadata: {
          creditAmount,
          reason: 'subscription_downgrade',
          appliedAt: new Date().toISOString(),
        },
      },
    });

    // In a real implementation, this would also:
    // 1. Update tenant's credit balance
    // 2. Create a credit invoice
    // 3. Notify the customer
    // 4. Update payment provider records

    console.log(`Applied credit of ${creditAmount} to tenant ${tenantId}`);
  }

  private async calculateOverageCharges(
    subscription: TenantSubscription,
    periodStart: Date,
    periodEnd: Date
  ): Promise<OverageBilling[]> {
    const overages = await prisma.overageBilling.findMany({
      where: {
        subscriptionId: subscription.id,
        billingPeriodStart: {
          gte: periodStart,
        },
        billingPeriodEnd: {
          lte: periodEnd,
        },
        status: 'PENDING',
      },
    });

    return overages.map((overage: any) => ({
      id: overage.id,
      tenantId: subscription.tenantId,
      subscriptionId: overage.subscriptionId,
      resourceType: overage.resourceType,
      quotaLimit: overage.quotaLimit,
      actualUsage: overage.actualUsage,
      overageAmount: overage.overageAmount,
      unitPrice: overage.unitPrice,
      billingPeriodStart: overage.billingPeriodStart,
      billingPeriodEnd: overage.billingPeriodEnd,
      status: overage.status.toLowerCase() as OverageBilling['status'],
      invoiceId: overage.invoiceId || undefined,
      createdAt: overage.createdAt,
      updatedAt: overage.updatedAt,
    }));
  }

  private calculateTax(amount: number, country?: string): number {
    // Simplified tax calculation - in production, use a proper tax service
    const taxRates: Record<string, number> = {
      US: 0.08,
      CA: 0.13,
      GB: 0.2,
      DE: 0.19,
      FR: 0.2,
    };

    const rate = country ? taxRates[country] || 0 : 0;
    return amount * rate;
  }

  private getOverageUnitPrice(resourceType: keyof UsageMetrics): number {
    const prices: Record<keyof UsageMetrics, number> = {
      emailsSent: 0.001, // $0.001 per email
      subscribersCount: 0.01, // $0.01 per subscriber
      campaignsCreated: 1.0, // $1.00 per campaign
      automationsActive: 5.0, // $5.00 per automation
      domainsUsed: 10.0, // $10.00 per domain
      apiCallsUsed: 0.0001, // $0.0001 per API call
      storageUsed: 0.1, // $0.10 per MB
      lastUpdated: 0, // Not billable
    };

    return prices[resourceType] || 0;
  }

  private mapResourceTypeToUsage(resourceType: keyof SubscriptionFeatures): keyof UsageMetrics {
    const mapping: Record<string, keyof UsageMetrics> = {
      emailsPerMonth: 'emailsSent',
      subscribersLimit: 'subscribersCount',
      campaignsPerMonth: 'campaignsCreated',
      automationsLimit: 'automationsActive',
      customDomains: 'domainsUsed',
      apiAccess: 'apiCallsUsed',
    };

    return mapping[resourceType as string] || 'emailsSent';
  }

  private mapUsageToFeatureType(usageType: keyof UsageMetrics): keyof SubscriptionFeatures {
    const mapping: Record<keyof UsageMetrics, keyof SubscriptionFeatures> = {
      emailsSent: 'emailsPerMonth',
      subscribersCount: 'subscribersLimit',
      campaignsCreated: 'campaignsPerMonth',
      automationsActive: 'automationsLimit',
      domainsUsed: 'customDomains',
      apiCallsUsed: 'apiAccess' as any,
      storageUsed: 'apiAccess' as any, // Fallback
      lastUpdated: 'apiAccess' as any, // Fallback
    };

    return mapping[usageType];
  }

  private formatPeriod(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    return `${startStr} - ${endStr}`;
  }

  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }

  private mapToSubscriptionPlan(plan: any): SubscriptionPlan {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency || 'USD',
      billingCycle: plan.billingCycle,
      features: plan.features,
      quotas: {
        emailsSent: 0,
        subscribersCount: 0,
        campaignsCreated: 0,
        automationsActive: 0,
        domainsUsed: 0,
        apiCallsUsed: 0,
        storageUsed: 0,
        lastResetAt: new Date(),
      },
      isActive: plan.isActive ?? true,
      trialDays: plan.trialDays,
      setupFee: plan.setupFee,
      metadata: plan.metadata,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
