import { prisma } from '@/lib/prisma';
import { emailQueue } from '@/lib/queue';
import {
  TriggerType,
  AutomationStatus,
  ExecutionStatus,
  Automation,
} from '@/types';

export interface TriggerEvent {
  type: TriggerType;
  tenantId: string;
  subscriberId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class TriggerService {
  /**
   * Process a trigger event and start matching automations
   */
  async processTriggerEvent(event: TriggerEvent): Promise<void> {
    try {
      // Find active automations that match this trigger
      const matchingAutomations = await this.findMatchingAutomations(event);

      // Start execution for each matching automation
      for (const automation of matchingAutomations) {
        await this.startAutomationExecution(automation, event);
      }
    } catch (error) {
      console.error('Error processing trigger event:', error);
      throw error;
    }
  }

  /**
   * Handle subscription trigger
   */
  async handleSubscriptionTrigger(
    tenantId: string,
    subscriberId: string,
    listId: string
  ): Promise<void> {
    const event: TriggerEvent = {
      type: TriggerType.SUBSCRIPTION,
      tenantId,
      subscriberId,
      data: { listId },
      timestamp: new Date(),
    };

    await this.processTriggerEvent(event);
  }

  /**
   * Handle email opened trigger
   */
  async handleEmailOpenedTrigger(
    tenantId: string,
    subscriberId: string,
    campaignId: string,
    emailId?: string
  ): Promise<void> {
    const event: TriggerEvent = {
      type: TriggerType.EMAIL_OPENED,
      tenantId,
      subscriberId,
      data: { campaignId, emailId },
      timestamp: new Date(),
    };

    await this.processTriggerEvent(event);
  }

  /**
   * Handle email clicked trigger
   */
  async handleEmailClickedTrigger(
    tenantId: string,
    subscriberId: string,
    campaignId: string,
    linkUrl: string,
    emailId?: string
  ): Promise<void> {
    const event: TriggerEvent = {
      type: TriggerType.EMAIL_CLICKED,
      tenantId,
      subscriberId,
      data: { campaignId, linkUrl, emailId },
      timestamp: new Date(),
    };

    await this.processTriggerEvent(event);
  }

  /**
   * Handle list joined trigger
   */
  async handleListJoinedTrigger(
    tenantId: string,
    subscriberId: string,
    listId: string
  ): Promise<void> {
    const event: TriggerEvent = {
      type: TriggerType.LIST_JOINED,
      tenantId,
      subscriberId,
      data: { listId },
      timestamp: new Date(),
    };

    await this.processTriggerEvent(event);
  }

  /**
   * Handle custom field changed trigger
   */
  async handleCustomFieldChangedTrigger(
    tenantId: string,
    subscriberId: string,
    fieldName: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    const event: TriggerEvent = {
      type: TriggerType.CUSTOM_FIELD_CHANGED,
      tenantId,
      subscriberId,
      data: { fieldName, oldValue, newValue },
      timestamp: new Date(),
    };

    await this.processTriggerEvent(event);
  }

  /**
   * Handle API triggered automation
   */
  async handleApiTrigger(
    tenantId: string,
    automationId: string,
    subscriberId: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    const automation = await prisma.automation.findFirst({
      where: {
        id: automationId,
        tenantId,
        status: AutomationStatus.ACTIVE,
      },
    });

    if (!automation) {
      throw new Error('Automation not found or not active');
    }

    const event: TriggerEvent = {
      type: TriggerType.API_TRIGGERED,
      tenantId,
      subscriberId,
      data,
      timestamp: new Date(),
    };

    await this.startAutomationExecution(automation, event);
  }

  /**
   * Process date-based triggers (called by cron job)
   */
  async processDateBasedTriggers(): Promise<void> {
    const now = new Date();
    
    // Find automations with date-based triggers that should run now
    const automations = await prisma.automation.findMany({
      where: {
        status: AutomationStatus.ACTIVE,
        triggerType: TriggerType.DATE_BASED,
      },
    });

    for (const automation of automations) {
      try {
        await this.processDateBasedAutomation(automation, now);
      } catch (error) {
        console.error(`Error processing date-based automation ${automation.id}:`, error);
      }
    }
  }

  /**
   * Get trigger execution statistics
   */
  async getTriggerStats(tenantId: string, automationId?: string): Promise<{
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    executionsByTrigger: Record<string, number>;
  }> {
    const where = {
      tenantId,
      ...(automationId && { automationId }),
    };

    const [
      totalExecutions,
      activeExecutions,
      completedExecutions,
      failedExecutions,
      executionsByTrigger,
    ] = await Promise.all([
      prisma.automationExecution.count({ where }),
      prisma.automationExecution.count({
        where: { ...where, status: ExecutionStatus.RUNNING },
      }),
      prisma.automationExecution.count({
        where: { ...where, status: ExecutionStatus.COMPLETED },
      }),
      prisma.automationExecution.count({
        where: { ...where, status: ExecutionStatus.FAILED },
      }),
      this.getExecutionsByTriggerType(tenantId, automationId),
    ]);

    return {
      totalExecutions,
      activeExecutions,
      completedExecutions,
      failedExecutions,
      executionsByTrigger,
    };
  }

  /**
   * Test a trigger configuration
   */
  async testTrigger(
    tenantId: string,
    triggerType: TriggerType,
    triggerConfig: Record<string, any>,
    subscriberId?: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Validate trigger configuration
      const validation = this.validateTriggerConfig(triggerType, triggerConfig);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join(', '),
        };
      }

      // Create a test event
      const testEvent: TriggerEvent = {
        type: triggerType,
        tenantId,
        subscriberId: subscriberId || 'test-subscriber',
        data: triggerConfig,
        timestamp: new Date(),
      };

      // Simulate trigger processing without actually executing
      const matchingAutomations = await this.findMatchingAutomations(testEvent);

      return {
        success: true,
        message: `Trigger test successful. Would match ${matchingAutomations.length} automation(s).`,
        data: {
          matchingAutomations: matchingAutomations.length,
          automationIds: matchingAutomations.map(a => a.id),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Trigger test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Find automations that match a trigger event
   */
  private async findMatchingAutomations(event: TriggerEvent): Promise<Automation[]> {
    const automations = await prisma.automation.findMany({
      where: {
        tenantId: event.tenantId,
        status: AutomationStatus.ACTIVE,
        triggerType: event.type,
      },
    });

    // Filter automations based on trigger configuration
    const matchingAutomations: Automation[] = [];

    for (const automation of automations) {
      if (this.doesTriggerMatch(automation.triggerConfig as Record<string, any> || {}, event)) {
        matchingAutomations.push({
          ...automation,
          status: automation.status as any,
          workflowData: automation.workflowData as any,
        } as Automation);
      }
    }

    return matchingAutomations;
  }

  /**
   * Check if a trigger configuration matches an event
   */
  private doesTriggerMatch(
    triggerConfig: Record<string, any>,
    event: TriggerEvent
  ): boolean {
    switch (event.type) {
      case TriggerType.SUBSCRIPTION:
      case TriggerType.LIST_JOINED:
        // Match if listId is specified and matches, or if no listId is specified
        return !triggerConfig.listId || triggerConfig.listId === event.data.listId;

      case TriggerType.EMAIL_OPENED:
      case TriggerType.EMAIL_CLICKED:
        // Match if campaignId is specified and matches, or if no campaignId is specified
        const campaignMatch = !triggerConfig.campaignId || 
          triggerConfig.campaignId === event.data.campaignId;
        
        // For email clicked, also check link URL if specified
        if (event.type === TriggerType.EMAIL_CLICKED && triggerConfig.linkUrl) {
          return campaignMatch && event.data.linkUrl === triggerConfig.linkUrl;
        }
        
        return campaignMatch;

      case TriggerType.CUSTOM_FIELD_CHANGED:
        // Match field name and optionally value
        const fieldMatch = triggerConfig.fieldName === event.data.fieldName;
        const valueMatch = !triggerConfig.value || 
          triggerConfig.value === event.data.newValue;
        
        return fieldMatch && valueMatch;

      case TriggerType.API_TRIGGERED:
        // API triggers always match (filtering is done by automation ID)
        return true;

      case TriggerType.DATE_BASED:
        // Date-based triggers are handled separately
        return true;

      default:
        return false;
    }
  }

  /**
   * Start automation execution
   */
  private async startAutomationExecution(
    automation: Automation,
    event: TriggerEvent
  ): Promise<void> {
    if (!event.subscriberId) {
      console.warn('No subscriber ID provided for automation execution');
      return;
    }

    // Check if subscriber exists
    const subscriber = await prisma.subscriber.findFirst({
      where: {
        id: event.subscriberId,
        tenantId: event.tenantId,
      },
    });

    if (!subscriber) {
      console.warn(`Subscriber ${event.subscriberId} not found`);
      return;
    }

    // Check if there's already a running execution for this subscriber and automation
    const existingExecution = await prisma.automationExecution.findFirst({
      where: {
        automationId: automation.id,
        subscriberId: event.subscriberId,
        status: {
          in: [ExecutionStatus.PENDING, ExecutionStatus.RUNNING],
        },
      },
    });

    if (existingExecution) {
      console.log(`Automation ${automation.id} already running for subscriber ${event.subscriberId}`);
      return;
    }

    // Create new execution
    const execution = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        subscriberId: event.subscriberId,
        status: ExecutionStatus.PENDING,
        currentStep: 0,
        executionData: {
          triggerEvent: {
            type: event.type,
            tenantId: event.tenantId,
            subscriberId: event.subscriberId,
            data: event.data,
            timestamp: event.timestamp.toISOString(),
          },
          startedAt: new Date().toISOString(),
        },
        tenantId: event.tenantId,
      },
    });

    // Add to automation queue
    await emailQueue.add('execute-automation', {
      tenantId: event.tenantId,
      automationId: automation.id,
      subscriberId: event.subscriberId,
      executionId: execution.id,
      stepIndex: 0,
    });
  }

  /**
   * Process date-based automation
   */
  private async processDateBasedAutomation(
    automation: Automation,
    currentTime: Date
  ): Promise<void> {
    const config = automation.triggerConfig;
    const triggerDate = new Date(config.date);

    // Check if it's time to trigger
    if (triggerDate <= currentTime) {
      // For recurring automations, calculate next trigger time
      if (config.recurring && config.interval) {
        const nextTriggerDate = this.calculateNextTriggerDate(triggerDate, config.interval);
        
        // Update automation with next trigger date
        await prisma.automation.update({
          where: { id: automation.id },
          data: {
            triggerConfig: {
              ...config,
              date: nextTriggerDate.toISOString(),
            },
          },
        });
      } else {
        // Non-recurring automation, mark as completed
        await prisma.automation.update({
          where: { id: automation.id },
          data: { status: AutomationStatus.COMPLETED },
        });
      }

      // Get all active subscribers for this tenant
      const subscribers = await prisma.subscriber.findMany({
        where: {
          tenantId: automation.tenantId,
          status: 'ACTIVE',
        },
      });

      // Start execution for each subscriber
      for (const subscriber of subscribers) {
        const event: TriggerEvent = {
          type: TriggerType.DATE_BASED,
          tenantId: automation.tenantId,
          subscriberId: subscriber.id,
          data: config,
          timestamp: currentTime,
        };

        await this.startAutomationExecution(automation, event);
      }
    }
  }

  /**
   * Calculate next trigger date for recurring automations
   */
  private calculateNextTriggerDate(currentDate: Date, interval: string): Date {
    const nextDate = new Date(currentDate);

    switch (interval) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  /**
   * Validate trigger configuration
   */
  private validateTriggerConfig(
    triggerType: TriggerType,
    config: Record<string, any>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (triggerType) {
      case TriggerType.DATE_BASED:
        if (!config.date) {
          errors.push('Date is required for date-based triggers');
        }
        break;

      case TriggerType.CUSTOM_FIELD_CHANGED:
        if (!config.fieldName) {
          errors.push('Field name is required for custom field triggers');
        }
        break;

      // Other trigger types have optional configurations
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get executions grouped by trigger type
   */
  private async getExecutionsByTriggerType(
    tenantId: string,
    automationId?: string
  ): Promise<Record<string, number>> {
    const automations = await prisma.automation.findMany({
      where: {
        tenantId,
        ...(automationId && { id: automationId }),
      },
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    const result: Record<string, number> = {};

    for (const automation of automations) {
      const triggerType = automation.triggerType;
      result[triggerType] = (result[triggerType] || 0) + automation._count.executions;
    }

    return result;
  }
}

export const triggerService = new TriggerService();