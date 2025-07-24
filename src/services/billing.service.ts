import { prisma } from '@/lib/prisma';
import { PaymentService } from './payment/payment.service';
import { SubscriptionService, TenantSubscription, Invoice, OverageBilling } from './subscription.service';
import { PaymentRequest } from '@/types/payment';

export interface BillingCycle {
  id: string;
  tenantId: string;
  subscriptionId: string;
  cycleStart: Date;
  cycleEnd: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  invoiceId?: string;
  paymentId?: string;
  retryCount: number;
  nextRetryAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingSchedule {
  tenantId: string;
  subscriptionId: string;
  nextBillingDate: Date;
  billingInterval: 'monthly' | 'yearly' | 'weekly';
  isActive: boolean;
  timezone: string;
}

export interface PaymentRetryConfig {
  maxRetries: number;
  retryIntervals: number[]; // in hours
  escalationEmails: string[];
}

export interface BillingNotification {
  type: 'upcoming_payment' | 'payment_failed' | 'payment_succeeded' | 'invoice_generated' | 'subscription_cancelled';
  tenantId: string;
  subscriptionId: string;
  invoiceId?: string;
  paymentId?: string;
  scheduledFor: Date;
  sent: boolean;
  metadata?: Record<string, any>;
}

export class BillingService {
  private readonly defaultRetryConfig: PaymentRetryConfig = {
    maxRetries: 3,
    retryIntervals: [24, 72, 168], // 1 day, 3 days, 1 week
    escalationEmails: ['billing@company.com']
  };

  constructor(
    private paymentService: PaymentService,
    private subscriptionService: SubscriptionService
  ) {}

  async processBillingCycles(): Promise<void> {
    console.log('Starting billing cycle processing...');
    
    const dueBillingCycles = await this.getDueBillingCycles();
    
    for (const cycle of dueBillingCycles) {
      try {
        await this.processBillingCycle(cycle);
      } catch (error) {
        console.error(`Failed to process billing cycle ${cycle.id}:`, error);
        await this.handleBillingFailure(cycle, error as Error);
      }
    }
    
    console.log(`Processed ${dueBillingCycles.length} billing cycles`);
  }

  async processBillingCycle(cycle: BillingCycle): Promise<void> {
    console.log(`Processing billing cycle ${cycle.id} for tenant ${cycle.tenantId}`);

    // Update cycle status to processing
    await this.updateBillingCycleStatus(cycle.id, 'processing');

    try {
      // Get tenant subscription
      const subscription = await this.subscriptionService.getTenantSubscription(cycle.tenantId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Generate invoice for the billing period
      const invoice = await this.subscriptionService.generateInvoice(
        cycle.tenantId,
        cycle.cycleStart,
        cycle.cycleEnd
      );

      // Store invoice
      await this.storeInvoice(invoice);

      // Attempt payment
      const paymentResult = await this.processInvoicePayment(invoice, subscription);

      if (paymentResult.success) {
        // Mark invoice as paid
        await this.markInvoiceAsPaid(invoice.id, paymentResult.paymentId!);
        
        // Update billing cycle as completed
        await this.updateBillingCycleStatus(cycle.id, 'completed', invoice.id, paymentResult.paymentId);
        
        // Schedule next billing cycle
        await this.scheduleNextBillingCycle(subscription);
        
        // Send payment success notification
        await this.scheduleNotification({
          type: 'payment_succeeded',
          tenantId: cycle.tenantId,
          subscriptionId: cycle.subscriptionId,
          invoiceId: invoice.id,
          paymentId: paymentResult.paymentId,
          scheduledFor: new Date(),
          sent: false
        });

        console.log(`Billing cycle ${cycle.id} completed successfully`);
      } else {
        // Payment failed, schedule retry
        await this.schedulePaymentRetry(cycle, invoice, paymentResult.error || 'Payment failed');
      }

    } catch (error) {
      await this.handleBillingFailure(cycle, error as Error);
      throw error;
    }
  }

  async processInvoicePayment(invoice: Invoice, subscription: TenantSubscription): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      const paymentRequest: PaymentRequest = {
        amount: invoice.total,
        currency: invoice.currency,
        customerId: subscription.customerId,
        description: `Invoice ${invoice.invoiceNumber}`,
        metadata: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          billingPeriod: `${invoice.periodStart.toISOString()}_${invoice.periodEnd.toISOString()}`
        },
        idempotencyKey: `invoice_${invoice.id}_${Date.now()}`
      };

      const result = await this.paymentService.processPayment(
        paymentRequest,
        subscription.paymentProvider
      );

      return {
        success: result.success,
        paymentId: result.paymentId,
        error: result.error
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async schedulePaymentRetry(
    cycle: BillingCycle,
    invoice: Invoice,
    failureReason: string
  ): Promise<void> {
    const retryConfig = this.defaultRetryConfig;
    const nextRetryCount = cycle.retryCount + 1;

    if (nextRetryCount > retryConfig.maxRetries) {
      // Max retries reached, handle failure
      await this.handleMaxRetriesReached(cycle, invoice, failureReason);
      return;
    }

    const retryIntervalHours = retryConfig.retryIntervals[nextRetryCount - 1] || 24;
    const nextRetryAt = new Date(Date.now() + retryIntervalHours * 60 * 60 * 1000);

    // Update billing cycle with retry information
    await this.updateBillingCycleForRetry(cycle.id, nextRetryCount, nextRetryAt, failureReason);

    // Schedule payment failed notification
    await this.scheduleNotification({
      type: 'payment_failed',
      tenantId: cycle.tenantId,
      subscriptionId: cycle.subscriptionId,
      invoiceId: invoice.id,
      scheduledFor: new Date(),
      sent: false,
      metadata: {
        retryCount: nextRetryCount,
        nextRetryAt: nextRetryAt.toISOString(),
        failureReason
      }
    });

    console.log(`Scheduled payment retry ${nextRetryCount} for billing cycle ${cycle.id} at ${nextRetryAt}`);
  }

  async handleMaxRetriesReached(
    cycle: BillingCycle,
    invoice: Invoice,
    failureReason: string
  ): Promise<void> {
    console.log(`Max retries reached for billing cycle ${cycle.id}`);

    // Mark billing cycle as failed
    await this.updateBillingCycleStatus(cycle.id, 'failed', invoice.id, undefined, failureReason);

    // Mark invoice as uncollectible
    await this.markInvoiceAsUncollectible(invoice.id);

    // Cancel subscription or suspend service
    const subscription = await this.subscriptionService.getTenantSubscription(cycle.tenantId);
    if (subscription) {
      await this.handleSubscriptionSuspension(subscription, failureReason);
    }

    // Send escalation notification
    await this.sendEscalationNotification(cycle, invoice, failureReason);
  }

  async handleSubscriptionSuspension(
    subscription: TenantSubscription,
    reason: string
  ): Promise<void> {
    // In a real implementation, this might:
    // 1. Suspend the tenant's service
    // 2. Send notifications to the customer
    // 3. Update subscription status
    // 4. Log the suspension for compliance

    console.log(`Suspending subscription ${subscription.id} for tenant ${subscription.tenantId}: ${reason}`);

    // Schedule subscription cancellation notification
    await this.scheduleNotification({
      type: 'subscription_cancelled',
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      scheduledFor: new Date(),
      sent: false,
      metadata: {
        reason: 'payment_failure',
        details: reason
      }
    });
  }

  async scheduleNextBillingCycle(subscription: TenantSubscription): Promise<void> {
    const nextBillingDate = this.calculateNextBillingDate(
      subscription.currentPeriodEnd,
      subscription.plan.billingCycle
    );

    const nextCycleStart = subscription.currentPeriodEnd;
    const nextCycleEnd = this.calculatePeriodEnd(nextBillingDate, subscription.plan.billingCycle);

    const nextCycle: Omit<BillingCycle, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      cycleStart: nextCycleStart,
      cycleEnd: nextCycleEnd,
      status: 'pending',
      retryCount: 0
    };

    await this.createBillingCycle(nextCycle);

    // Schedule upcoming payment notification (7 days before)
    const notificationDate = new Date(nextBillingDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (notificationDate > new Date()) {
      await this.scheduleNotification({
        type: 'upcoming_payment',
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        scheduledFor: notificationDate,
        sent: false,
        metadata: {
          billingDate: nextBillingDate.toISOString(),
          amount: subscription.plan.price
        }
      });
    }

    console.log(`Scheduled next billing cycle for tenant ${subscription.tenantId} on ${nextBillingDate}`);
  }

  async processOverageBilling(tenantId: string): Promise<void> {
    const subscription = await this.subscriptionService.getTenantSubscription(tenantId);
    if (!subscription) {
      return;
    }

    // Get pending overage charges
    const overages = await this.getPendingOverages(tenantId);
    
    if (overages.length === 0) {
      return;
    }

    // Create overage invoice
    const overageInvoice = await this.createOverageInvoice(subscription, overages);

    // Process payment for overage
    const paymentResult = await this.processInvoicePayment(overageInvoice, subscription);

    if (paymentResult.success) {
      await this.markInvoiceAsPaid(overageInvoice.id, paymentResult.paymentId!);
      await this.markOveragesAsBilled(overages);
    } else {
      // Handle overage payment failure
      console.error(`Overage payment failed for tenant ${tenantId}:`, paymentResult.error);
    }
  }

  async generateBillingReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    invoicesGenerated: number;
    paymentSuccessRate: number;
    overageCharges: number;
    failedPayments: number;
    details: any[];
  }> {
    const subscription = await this.subscriptionService.getTenantSubscription(tenantId);
    if (!subscription) {
      return {
        totalRevenue: 0,
        invoicesGenerated: 0,
        paymentSuccessRate: 0,
        overageCharges: 0,
        failedPayments: 0,
        details: []
      };
    }

    // Get all invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        subscriptionId: subscription.id,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        payments: true
      }
    });

    // Get overage billings for the period
    const overages = await prisma.overageBilling.findMany({
      where: {
        subscriptionId: subscription.id,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate metrics
    const totalRevenue = invoices
      .filter((inv: any) => inv.status === 'PAID')
      .reduce((sum: number, inv: any) => sum + inv.amountPaid, 0);

    const invoicesGenerated = invoices.length;
    
    const paidInvoices = invoices.filter((inv: any) => inv.status === 'PAID').length;
    const paymentSuccessRate = invoicesGenerated > 0 ? (paidInvoices / invoicesGenerated) * 100 : 0;

    const overageCharges = overages.reduce((sum: number, overage: any) => 
      sum + (overage.overageAmount * overage.unitPrice), 0);

    const failedPayments = invoices.filter((inv: any) => 
      inv.status === 'UNCOLLECTIBLE' || inv.status === 'VOID').length;

    // Prepare detailed breakdown
    const details = invoices.map((invoice: any) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.total,
      amountPaid: invoice.amountPaid,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd
    }));

    return {
      totalRevenue,
      invoicesGenerated,
      paymentSuccessRate,
      overageCharges,
      failedPayments,
      details
    };
  }

  private async getDueBillingCycles(): Promise<BillingCycle[]> {
    const now = new Date();
    
    const cycles = await prisma.billingCycle.findMany({
      where: {
        status: 'PENDING',
        cycleEnd: {
          lte: now
        }
      },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    return cycles.map((cycle: any) => ({
      id: cycle.id,
      tenantId: cycle.subscription.tenantId,
      subscriptionId: cycle.subscriptionId,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: cycle.status.toLowerCase() as BillingCycle['status'],
      invoiceId: cycle.invoiceId || undefined,
      paymentId: cycle.paymentId || undefined,
      retryCount: cycle.retryCount,
      nextRetryAt: cycle.nextRetryAt || undefined,
      failureReason: cycle.failureReason || undefined,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt
    }));
  }

  private async createBillingCycle(cycle: Omit<BillingCycle, 'id' | 'createdAt' | 'updatedAt'>): Promise<BillingCycle> {
    const dbCycle = await prisma.billingCycle.create({
      data: {
        subscriptionId: cycle.subscriptionId,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        status: cycle.status.toUpperCase() as any,
        retryCount: cycle.retryCount,
        ...(cycle.nextRetryAt && { nextRetryAt: cycle.nextRetryAt }),
        ...(cycle.failureReason && { failureReason: cycle.failureReason })
      }
    });

    return {
      id: dbCycle.id,
      tenantId: cycle.tenantId,
      subscriptionId: dbCycle.subscriptionId,
      cycleStart: dbCycle.cycleStart,
      cycleEnd: dbCycle.cycleEnd,
      status: dbCycle.status.toLowerCase() as BillingCycle['status'],
      invoiceId: dbCycle.invoiceId || undefined,
      paymentId: dbCycle.paymentId || undefined,
      retryCount: dbCycle.retryCount,
      nextRetryAt: dbCycle.nextRetryAt || undefined,
      failureReason: dbCycle.failureReason || undefined,
      createdAt: dbCycle.createdAt,
      updatedAt: dbCycle.updatedAt
    };
  }

  private async updateBillingCycleStatus(
    cycleId: string,
    status: BillingCycle['status'],
    invoiceId?: string,
    paymentId?: string,
    failureReason?: string
  ): Promise<void> {
    await prisma.billingCycle.update({
      where: { id: cycleId },
      data: {
        status: status.toUpperCase() as any,
        ...(invoiceId && { invoiceId }),
        ...(paymentId && { paymentId }),
        ...(failureReason && { failureReason }),
        updatedAt: new Date()
      }
    });
    
    console.log(`Updated billing cycle ${cycleId} status to ${status}`);
  }

  private async updateBillingCycleForRetry(
    cycleId: string,
    retryCount: number,
    nextRetryAt: Date,
    failureReason: string
  ): Promise<void> {
    await prisma.billingCycle.update({
      where: { id: cycleId },
      data: {
        retryCount,
        nextRetryAt,
        failureReason,
        updatedAt: new Date()
      }
    });
    
    console.log(`Updated billing cycle ${cycleId} for retry ${retryCount} at ${nextRetryAt}`);
  }

  private async storeInvoice(invoice: Invoice): Promise<void> {
    await prisma.invoice.create({
      data: {
        id: invoice.id,
        subscriptionId: invoice.subscriptionId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status.toUpperCase() as any,
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        lineItems: invoice.lineItems as any,
        billingAddress: invoice.billingAddress as any,
        paymentProvider: invoice.paymentProvider,
        providerInvoiceId: invoice.providerInvoiceId,
        metadata: invoice.metadata as any
      }
    });
    
    console.log('Stored invoice:', invoice.id);
  }

  private async markInvoiceAsPaid(invoiceId: string, paymentId: string): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });
    
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        amountPaid: invoice.total,
        amountDue: 0,
        paidAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`Marked invoice ${invoiceId} as paid with payment ${paymentId}`);
  }

  private async markInvoiceAsUncollectible(invoiceId: string): Promise<void> {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'UNCOLLECTIBLE',
        updatedAt: new Date()
      }
    });
    
    console.log(`Marked invoice ${invoiceId} as uncollectible`);
  }

  private async scheduleNotification(notification: BillingNotification): Promise<void> {
    // Store notification in database for processing by a background job
    // In a real implementation, this could use a queue system like Bull or database-based scheduling
    
    // For now, we'll create a simple notification record
    // This could be expanded to use a proper notification service
    await prisma.auditLog.create({
      data: {
        tenantId: notification.tenantId,
        action: 'NOTIFICATION_SCHEDULED',
        resource: 'billing_notification',
        resourceId: notification.invoiceId || notification.paymentId,
        metadata: {
          notificationType: notification.type,
          scheduledFor: notification.scheduledFor.toISOString(),
          ...notification.metadata
        }
      }
    });
    
    console.log('Scheduled notification:', notification);
  }

  private async sendEscalationNotification(
    cycle: BillingCycle,
    invoice: Invoice,
    failureReason: string
  ): Promise<void> {
    // Create escalation audit log
    await prisma.auditLog.create({
      data: {
        tenantId: cycle.tenantId,
        action: 'BILLING_ESCALATION',
        resource: 'billing_cycle',
        resourceId: cycle.id,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          failureReason,
          retryCount: cycle.retryCount,
          escalationLevel: 'CRITICAL'
        }
      }
    });

    // In a real implementation, this would also:
    // 1. Send emails to the escalation team
    // 2. Create support tickets
    // 3. Trigger webhook notifications
    // 4. Update external monitoring systems
    
    console.log(`Sent escalation notification for billing cycle ${cycle.id}: ${failureReason}`);
  }

  private async handleBillingFailure(cycle: BillingCycle, error: Error): Promise<void> {
    console.error(`Billing cycle ${cycle.id} failed:`, error);
    await this.updateBillingCycleStatus(cycle.id, 'failed', undefined, undefined, error.message);
  }

  private async getPendingOverages(tenantId: string): Promise<OverageBilling[]> {
    const subscription = await this.subscriptionService.getTenantSubscription(tenantId);
    if (!subscription) {
      return [];
    }

    const overages = await prisma.overageBilling.findMany({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING'
      }
    });

    return overages.map((overage: any) => ({
      id: overage.id,
      tenantId,
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
      updatedAt: overage.updatedAt
    }));
  }

  private async createOverageInvoice(
    subscription: TenantSubscription,
    overages: OverageBilling[]
  ): Promise<Invoice> {
    const lineItems = overages.map(overage => ({
      id: `li_${overage.id}`,
      description: `${overage.resourceType} overage`,
      quantity: overage.overageAmount,
      unitPrice: overage.unitPrice,
      amount: overage.overageAmount * overage.unitPrice,
      type: 'overage' as const
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * 0.1; // Simplified tax calculation
    const total = subtotal + taxAmount;

    return {
      id: `inv_overage_${Date.now()}`,
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: `OVR-${Date.now()}`,
      status: 'open',
      currency: subscription.plan.currency,
      subtotal,
      taxAmount,
      discountAmount: 0,
      total,
      amountPaid: 0,
      amountDue: total,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      periodStart: new Date(),
      periodEnd: new Date(),
      lineItems,
      billingAddress: subscription.billingAddress,
      paymentProvider: subscription.paymentProvider,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async markOveragesAsBilled(overages: OverageBilling[]): Promise<void> {
    const overageIds = overages.map(overage => overage.id);
    
    await prisma.overageBilling.updateMany({
      where: {
        id: {
          in: overageIds
        }
      },
      data: {
        status: 'BILLED',
        updatedAt: new Date()
      }
    });
    
    console.log(`Marked ${overages.length} overages as billed`);
  }

  private calculateNextBillingDate(currentPeriodEnd: Date, billingCycle: string): Date {
    const nextDate = new Date(currentPeriodEnd);
    
    switch (billingCycle) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }
    
    return nextDate;
  }

  private calculatePeriodEnd(periodStart: Date, billingCycle: string): Date {
    const endDate = new Date(periodStart);
    
    switch (billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 6);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
    }
    
    return endDate;
  }
}