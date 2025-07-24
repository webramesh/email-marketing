import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment/payment.service';

import { prisma } from '@/lib/prisma';

export interface SchedulerConfig {
  intervalMinutes: number;
  maxConcurrentJobs: number;
  retryDelayMinutes: number;
  enableNotifications: boolean;
}

export class BillingSchedulerService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly config: SchedulerConfig;
  private readonly billingService: BillingService;

  constructor(
    paymentService: PaymentService,
    subscriptionService: SubscriptionService,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.config = {
      intervalMinutes: 60, // Run every hour
      maxConcurrentJobs: 5,
      retryDelayMinutes: 30,
      enableNotifications: true,
      ...config,
    };

    this.billingService = new BillingService(paymentService, subscriptionService);
  }

  /**
   * Start the billing scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('Billing scheduler is already running');
      return;
    }

    console.log('Starting billing scheduler...');
    this.isRunning = true;

    // Run immediately on start
    this.runScheduledTasks();

    // Schedule recurring runs
    this.intervalId = setInterval(() => {
      this.runScheduledTasks();
    }, this.config.intervalMinutes * 60 * 1000);

    console.log(`Billing scheduler started with ${this.config.intervalMinutes} minute intervals`);
  }

  /**
   * Stop the billing scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Billing scheduler is not running');
      return;
    }

    console.log('Stopping billing scheduler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Billing scheduler stopped');
  }

  /**
   * Run all scheduled billing tasks
   */
  private async runScheduledTasks(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Running scheduled billing tasks...');

    try {
      // Process due billing cycles
      await this.billingService.processBillingCycles();

      // Process retry payments
      await this.processRetryPayments();

      // Process overage billing
      await this.processOverageBilling();

      // Clean up old records
      await this.cleanupOldRecords();

      console.log('Scheduled billing tasks completed successfully');
    } catch (error) {
      console.error('Error running scheduled billing tasks:', error);
    }
  }

  /**
   * Process payment retries for failed billing cycles
   */
  private async processRetryPayments(): Promise<void> {
    const now = new Date();

    const retryableCycles = await prisma.billingCycle.findMany({
      where: {
        status: 'FAILED',
        nextRetryAt: {
          lte: now,
        },
        retryCount: {
          lt: 3, // Max retries
        },
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    console.log(`Found ${retryableCycles.length} billing cycles ready for retry`);

    for (const cycle of retryableCycles) {
      try {
        const billingCycle = {
          id: cycle.id,
          tenantId: cycle.subscription.tenantId,
          subscriptionId: cycle.subscriptionId,
          cycleStart: cycle.cycleStart,
          cycleEnd: cycle.cycleEnd,
          status: 'pending' as const,
          invoiceId: cycle.invoiceId || undefined,
          paymentId: cycle.paymentId || undefined,
          retryCount: cycle.retryCount,
          nextRetryAt: cycle.nextRetryAt || undefined,
          failureReason: cycle.failureReason || undefined,
          createdAt: cycle.createdAt,
          updatedAt: cycle.updatedAt,
        };

        await this.billingService.processBillingCycle(billingCycle);
      } catch (error) {
        console.error(`Failed to retry billing cycle ${cycle.id}:`, error);
      }
    }
  }

  /**
   * Process overage billing for all tenants
   */
  private async processOverageBilling(): Promise<void> {
    // Get all active subscriptions
    const activeSubscriptions = await prisma.tenantSubscription.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    console.log(
      `Processing overage billing for ${activeSubscriptions.length} active subscriptions`
    );

    for (const subscription of activeSubscriptions) {
      try {
        await this.billingService.processOverageBilling(subscription.tenantId);
      } catch (error) {
        console.error(
          `Failed to process overage billing for tenant ${subscription.tenantId}:`,
          error
        );
      }
    }
  }

  /**
   * Clean up old billing records
   */
  private async cleanupOldRecords(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12); // Keep 12 months of data

    try {
      // Clean up old completed billing cycles
      const deletedCycles = await prisma.billingCycle.deleteMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      // Clean up old audit logs
      const deletedLogs = await prisma.auditLog.deleteMany({
        where: {
          action: 'NOTIFICATION_SCHEDULED',
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(
        `Cleaned up ${deletedCycles.count} old billing cycles and ${deletedLogs.count} old audit logs`
      );
    } catch (error) {
      console.error('Error cleaning up old records:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
    nextRun?: Date;
  } {
    const nextRun =
      this.isRunning && this.intervalId
        ? new Date(Date.now() + this.config.intervalMinutes * 60 * 1000)
        : undefined;

    return {
      isRunning: this.isRunning,
      config: this.config,
      nextRun,
    };
  }

  /**
   * Manually trigger billing cycle processing
   */
  async triggerBillingCycles(): Promise<void> {
    console.log('Manually triggering billing cycle processing...');
    await this.billingService.processBillingCycles();
  }

  /**
   * Manually trigger overage billing for a specific tenant
   */
  async triggerOverageBilling(tenantId: string): Promise<void> {
    console.log(`Manually triggering overage billing for tenant ${tenantId}...`);
    await this.billingService.processOverageBilling(tenantId);
  }
}
