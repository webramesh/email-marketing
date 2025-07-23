import { Job } from 'bull';
import { emailQueue, campaignQueue, automationQueue, analyticsQueue } from '@/lib/queue';
import { EmailSendingService } from './email-sending/sending.service';
import { triggerService } from './trigger.service';
import { workflowExecutionService, WorkflowExecutionContext } from './workflow-execution.service';
import { prisma } from '@/lib/prisma';
import { EmailMessage, SendingResult } from '@/types/email-sending';
import { WorkflowNode, WorkflowConnection } from '@/types';

export interface EmailJobData {
  tenantId: string;
  message: EmailMessage;
  campaignId?: string;
  subscriberId?: string;
  priority?: number;
  sendAt?: Date;
  metadata?: Record<string, any>;
}

export interface CampaignJobData {
  tenantId: string;
  campaignId: string;
  batchSize?: number;
  offset?: number;
}

export interface AutomationJobData {
  tenantId: string;
  automationId: string;
  subscriberId: string;
  stepIndex: number;
  executionId: string;
}

export interface AnalyticsJobData {
  tenantId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export class EmailQueueService {
  private emailSendingService: EmailSendingService;
  private processorsSetup = false;

  constructor() {
    this.emailSendingService = new EmailSendingService();
  }

  private setupProcessors() {
    if (this.processorsSetup) return;
    
    try {
      // Email processing
      emailQueue.process('send-email', 10, this.processEmailJob.bind(this));
      
      // Campaign processing
      campaignQueue.process('send-campaign', 5, this.processCampaignJob.bind(this));
      
      // Automation processing
      automationQueue.process('execute-automation', 20, this.processAutomationJob.bind(this));
      
      // Analytics processing
      analyticsQueue.process('track-event', 50, this.processAnalyticsJob.bind(this));
      
      this.processorsSetup = true;
    } catch (error) {
      console.warn('Queue processors not available:', error);
    }
  }

  // Email Job Processing
  async addEmailJob(data: EmailJobData, options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }): Promise<Job<EmailJobData>> {
    this.setupProcessors();
    
    const jobOptions = {
      delay: options?.delay || 0,
      priority: options?.priority || data.priority || 0,
      attempts: options?.attempts || 3,
    };

    if (data.sendAt) {
      jobOptions.delay = Math.max(0, data.sendAt.getTime() - Date.now());
    }

    return emailQueue.add('send-email', data, jobOptions);
  }

  private async processEmailJob(job: Job<EmailJobData>): Promise<SendingResult> {
    const { tenantId, message, campaignId, subscriberId, metadata } = job.data;

    try {
      // Update job progress
      await job.progress(10);

      // Apply rate limiting based on tenant
      await this.applyRateLimit(tenantId);
      await job.progress(20);

      // Send the email
      const result = await this.emailSendingService.sendEmail(message, tenantId);
      await job.progress(80);

      // Log the result
      await this.logEmailResult(tenantId, campaignId, subscriberId, message, result, metadata);
      await job.progress(100);

      return result;
    } catch (error) {
      console.error('Email job processing error:', error);
      throw error;
    }
  }

  // Campaign Job Processing
  async addCampaignJob(data: CampaignJobData): Promise<Job<CampaignJobData>> {
    this.setupProcessors();
    return campaignQueue.add('send-campaign', data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async processCampaignJob(job: Job<CampaignJobData>): Promise<void> {
    const { tenantId, campaignId, batchSize = 100, offset = 0 } = job.data;

    try {
      await job.progress(5);

      // Get campaign details
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          tenantId,
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      await job.progress(10);

      // Get subscribers for this batch
      const subscribers = await this.getCampaignSubscribers(
        tenantId,
        campaignId,
        batchSize,
        offset
      );

      if (subscribers.length === 0) {
        await job.progress(100);
        return;
      }

      await job.progress(20);

      // Create email jobs for each subscriber
      const emailJobs = subscribers.map(subscriber => ({
        tenantId,
        message: {
          to: subscriber.email,
          from: campaign.fromEmail || 'noreply@example.com',
          fromName: campaign.fromName || undefined,
          replyTo: campaign.replyToEmail || undefined,
          subject: this.personalizeContent(campaign.subject, subscriber),
          html: this.personalizeContent(campaign.content, subscriber),
          text: campaign.plainTextContent ? 
            this.personalizeContent(campaign.plainTextContent, subscriber) : undefined,
        },
        campaignId,
        subscriberId: subscriber.id,
        metadata: {
          campaignName: campaign.name,
          subscriberEmail: subscriber.email,
        },
      }));

      // Add email jobs to queue
      await Promise.all(
        emailJobs.map(jobData => this.addEmailJob(jobData))
      );

      await job.progress(80);

      // Schedule next batch if there are more subscribers
      const totalSubscribers = await this.getCampaignSubscriberCount(tenantId, campaignId);
      const nextOffset = offset + batchSize;

      if (nextOffset < totalSubscribers) {
        await this.addCampaignJob({
          tenantId,
          campaignId,
          batchSize,
          offset: nextOffset,
        });
      } else {
        // Mark campaign as sent
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }

      await job.progress(100);
    } catch (error) {
      console.error('Campaign job processing error:', error);
      throw error;
    }
  }

  // Automation Job Processing
  async addAutomationJob(data: AutomationJobData, delay?: number): Promise<Job<AutomationJobData>> {
    this.setupProcessors();
    return automationQueue.add('execute-automation', data, {
      delay: delay || 0,
      attempts: 3,
    });
  }

  private async processAutomationJob(job: Job<AutomationJobData>): Promise<void> {
    const { tenantId, automationId, subscriberId, stepIndex, executionId } = job.data;

    try {
      await job.progress(10);

      // Get automation and execution details
      const [automation, execution] = await Promise.all([
        prisma.automation.findFirst({
          where: { id: automationId, tenantId },
          include: { workflowSteps: { orderBy: { position: 'asc' } } },
        }),
        prisma.automationExecution.findFirst({
          where: { id: executionId, tenantId },
          include: { subscriber: true },
        }),
      ]);

      if (!automation || !execution) {
        throw new Error('Automation or execution not found');
      }

      await job.progress(30);

      // Check if automation uses new workflow format
      if (automation.workflowData && typeof automation.workflowData === 'object') {
        await this.processWorkflowExecution(tenantId, automation, execution, job);
      } else {
        // Legacy workflow processing
        await this.processLegacyAutomation(tenantId, automation, execution, stepIndex, job);
      }

      await job.progress(100);
    } catch (error) {
      console.error('Automation job processing error:', error);
      
      // Mark execution as failed
      await prisma.automationExecution.update({
        where: { id: job.data.executionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          executionData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date(),
          },
        },
      });

      throw error;
    }
  }

  // Analytics Job Processing
  async addAnalyticsJob(data: AnalyticsJobData): Promise<Job<AnalyticsJobData>> {
    return analyticsQueue.add('track-event', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
    const { tenantId, eventType, eventData, timestamp } = job.data;

    try {
      await job.progress(20);

      // Create email event record
      await prisma.emailEvent.create({
        data: {
          tenantId,
          type: eventType as any,
          campaignId: eventData.campaignId,
          subscriberId: eventData.subscriberId,
          email: eventData.email,
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent,
          location: eventData.location,
          metadata: eventData.metadata,
          createdAt: timestamp,
        },
      });

      await job.progress(40);

      // Update campaign analytics if applicable
      if (eventData.campaignId) {
        await this.updateCampaignAnalytics(eventData.campaignId, eventType);
      }

      await job.progress(60);

      // Trigger automation events based on email events
      if (eventData.subscriberId) {
        await this.handleEmailEventTriggers(tenantId, eventType, eventData);
      }

      await job.progress(100);
    } catch (error) {
      console.error('Analytics job processing error:', error);
      throw error;
    }
  }

  // Helper Methods
  private async applyRateLimit(tenantId: string): Promise<void> {
    // Implement tenant-specific rate limiting
    // This is a simple implementation - in production, you'd want more sophisticated rate limiting
    const current = await prisma.auditLog.count({
      where: {
        tenantId,
        action: 'EMAIL_SEND',
        createdAt: {
          gte: new Date(Date.now() - 60000), // Last minute
        },
      },
    });

    if (current > 100) { // Max 100 emails per minute per tenant
      throw new Error('Rate limit exceeded');
    }
  }

  private async logEmailResult(
    tenantId: string,
    campaignId: string | undefined,
    subscriberId: string | undefined,
    message: EmailMessage,
    result: SendingResult,
    metadata?: Record<string, any>
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'EMAIL_SEND',
        resource: 'email',
        resourceId: campaignId || subscriberId,
        metadata: {
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
          provider: result.provider,
          ...metadata,
        },
      },
    });
  }

  private async getCampaignSubscribers(
    tenantId: string,
    _campaignId: string,
    limit: number,
    offset: number
  ): Promise<Array<{ id: string; email: string; firstName?: string; lastName?: string; customFields?: any }>> {
    // This is a simplified implementation
    // In a real application, you'd need to handle list targeting, segmentation, etc.
    const subscribers = await prisma.subscriber.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        customFields: true,
      },
      skip: offset,
      take: limit,
    });

    return subscribers.map(subscriber => ({
      id: subscriber.id,
      email: subscriber.email,
      firstName: subscriber.firstName || undefined,
      lastName: subscriber.lastName || undefined,
      customFields: subscriber.customFields || undefined,
    }));
  }

  private async getCampaignSubscriberCount(tenantId: string, _campaignId: string): Promise<number> {
    return prisma.subscriber.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });
  }

  private personalizeContent(content: string, subscriber: any): string {
    // Simple personalization - replace merge tags
    return content
      .replace(/\{\{firstName\}\}/g, subscriber.firstName || '')
      .replace(/\{\{lastName\}\}/g, subscriber.lastName || '')
      .replace(/\{\{email\}\}/g, subscriber.email || '');
  }

  private async processAutomationStep(
    tenantId: string,
    automation: any,
    execution: any,
    step: any,
    stepIndex: number
  ): Promise<void> {
    // Update execution progress
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        currentStep: stepIndex,
        status: 'RUNNING',
      },
    });

    // Process step based on type
    const stepConfig = step.stepConfig;
    
    switch (step.stepType) {
      case 'email':
        await this.addEmailJob({
          tenantId,
          message: {
            to: execution.subscriber.email,
            from: stepConfig.fromEmail,
            fromName: stepConfig.fromName,
            subject: this.personalizeContent(stepConfig.subject, execution.subscriber),
            html: this.personalizeContent(stepConfig.content, execution.subscriber),
          },
          subscriberId: execution.subscriberId,
          metadata: {
            automationId: automation.id,
            executionId: execution.id,
            stepIndex,
          },
        });
        break;
      
      case 'delay':
        // Delay is handled by the job scheduling
        break;
      
      case 'condition':
        // Evaluate condition and potentially skip steps
        break;
      
      default:
        console.warn(`Unknown step type: ${step.stepType}`);
    }
  }

  private calculateStepDelay(step: any): number {
    const stepConfig = step.stepConfig;
    
    if (step.stepType === 'delay') {
      const delayValue = stepConfig.delay || 0;
      const delayUnit = stepConfig.unit || 'minutes';
      
      switch (delayUnit) {
        case 'minutes':
          return delayValue * 60 * 1000;
        case 'hours':
          return delayValue * 60 * 60 * 1000;
        case 'days':
          return delayValue * 24 * 60 * 60 * 1000;
        default:
          return 0;
      }
    }
    
    return 0;
  }

  private async updateCampaignAnalytics(campaignId: string, eventType: string): Promise<void> {
    const updateData: any = {};
    
    switch (eventType) {
      case 'SENT':
        updateData.totalSent = { increment: 1 };
        break;
      case 'DELIVERED':
        updateData.totalDelivered = { increment: 1 };
        break;
      case 'OPENED':
        updateData.totalOpened = { increment: 1 };
        break;
      case 'CLICKED':
        updateData.totalClicked = { increment: 1 };
        break;
      case 'BOUNCED':
        updateData.totalBounced = { increment: 1 };
        break;
      case 'COMPLAINED':
        updateData.totalComplained = { increment: 1 };
        break;
      case 'UNSUBSCRIBED':
        updateData.totalUnsubscribed = { increment: 1 };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
      });
    }
  }

  private async handleEmailEventTriggers(
    tenantId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    try {
      switch (eventType) {
        case 'OPENED':
          await triggerService.handleEmailOpenedTrigger(
            tenantId,
            eventData.subscriberId,
            eventData.campaignId,
            eventData.emailId
          );
          break;
        
        case 'CLICKED':
          await triggerService.handleEmailClickedTrigger(
            tenantId,
            eventData.subscriberId,
            eventData.campaignId,
            eventData.linkUrl || '',
            eventData.emailId
          );
          break;
        
        // Add more event types as needed
        default:
          // No trigger handling for this event type
          break;
      }
    } catch (error) {
      console.error('Error handling email event triggers:', error);
      // Don't throw error to avoid failing the analytics job
    }
  }

  // New Workflow Execution Methods
  private async processWorkflowExecution(
    tenantId: string,
    automation: any,
    execution: any,
    job: Job<AutomationJobData>
  ): Promise<void> {
    const workflowData = automation.workflowData as { nodes: WorkflowNode[]; connections: WorkflowConnection[] };
    const { nodes, connections } = workflowData;

    // Get current node from execution data or start with trigger node
    const executionData = execution.executionData || {};
    let currentNodeId = executionData.currentNodeId;

    if (!currentNodeId) {
      // Find the trigger node to start execution
      const triggerNode = nodes.find(node => node.type === 'TRIGGER');
      if (!triggerNode) {
        throw new Error('No trigger node found in workflow');
      }
      // Start with the first node after trigger
      currentNodeId = this.findNextNode(triggerNode.id, connections);
    }

    if (!currentNodeId) {
      // No more nodes to execute, complete the workflow
      await workflowExecutionService.completeExecution(execution.id, true);
      return;
    }

    const currentNode = nodes.find(node => node.id === currentNodeId);
    if (!currentNode) {
      throw new Error(`Node ${currentNodeId} not found in workflow`);
    }

    await job.progress(50);

    // Create execution context
    const context: WorkflowExecutionContext = {
      tenantId,
      automationId: automation.id,
      executionId: execution.id,
      subscriber: execution.subscriber,
      currentNodeId,
      executionData: executionData,
      variables: executionData.variables || {},
    };

    // Execute the current step
    const result = await workflowExecutionService.executeWorkflowStep(
      context,
      currentNode,
      connections
    );

    await job.progress(80);

    if (!result.success) {
      // Step failed, mark execution as failed
      await workflowExecutionService.completeExecution(execution.id, false, result.error);
      return;
    }

    // Schedule next step or complete execution
    if (result.nextNodeId) {
      // Schedule next step
      await this.addAutomationJob({
        tenantId,
        automationId: automation.id,
        subscriberId: execution.subscriberId,
        stepIndex: 0, // Not used in new workflow system
        executionId: execution.id,
      }, result.delay || 0);

      // Update execution data with next node
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          executionData: {
            ...executionData,
            currentNodeId: result.nextNodeId,
            variables: { ...context.variables, ...result.data },
            lastExecutedNode: currentNodeId,
            lastExecutedAt: new Date(),
          },
        },
      });
    } else {
      // No next node, complete execution
      await workflowExecutionService.completeExecution(execution.id, true);
    }
  }

  private async processLegacyAutomation(
    tenantId: string,
    automation: any,
    execution: any,
    stepIndex: number,
    job: Job<AutomationJobData>
  ): Promise<void> {
    const currentStep = automation.workflowSteps[stepIndex];
    if (!currentStep) {
      // Mark execution as completed
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      return;
    }

    await job.progress(50);

    // Process the current step
    await this.processAutomationStep(
      tenantId,
      automation,
      execution,
      currentStep,
      stepIndex
    );

    await job.progress(80);

    // Schedule next step
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < automation.workflowSteps.length) {
      const nextStep = automation.workflowSteps[nextStepIndex];
      const delay = this.calculateStepDelay(nextStep);

      await this.addAutomationJob({
        tenantId,
        automationId: automation.id,
        subscriberId: execution.subscriberId,
        stepIndex: nextStepIndex,
        executionId: execution.id,
      }, delay);
    }
  }

  private findNextNode(
    currentNodeId: string,
    connections: WorkflowConnection[],
    stepData?: Record<string, any>
  ): string | undefined {
    const outgoingConnections = connections.filter(conn => conn.sourceNodeId === currentNodeId);

    if (outgoingConnections.length === 0) {
      return undefined; // End of workflow
    }

    // For condition nodes, check if we have conditional connections
    if (stepData?.conditionResult !== undefined) {
      const conditionalConnection = outgoingConnections.find(
        conn => conn.condition?.type === 'conditional'
      );
      const defaultConnection = outgoingConnections.find(
        conn => conn.condition?.type === 'always' || !conn.condition
      );

      if (stepData.conditionResult && conditionalConnection) {
        return conditionalConnection.targetNodeId;
      } else if (!stepData.conditionResult && defaultConnection) {
        return defaultConnection.targetNodeId;
      }
    }

    // Default: return the first connection
    return outgoingConnections[0]?.targetNodeId;
  }

  // Queue Management Methods
  async getQueueStats() {
    this.setupProcessors();
    
    const [emailStats, campaignStats, automationStats, analyticsStats] = await Promise.all([
      this.getQueueJobCounts(emailQueue),
      this.getQueueJobCounts(campaignQueue),
      this.getQueueJobCounts(automationQueue),
      this.getQueueJobCounts(analyticsQueue),
    ]);

    return {
      email: emailStats,
      campaign: campaignStats,
      automation: automationStats,
      analytics: analyticsStats,
    };
  }

  private async getQueueJobCounts(queue: any) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  private getQueueByName(name: string) {
    switch (name) {
      case 'email':
        return emailQueue;
      case 'campaign':
        return campaignQueue;
      case 'automation':
        return automationQueue;
      case 'analytics':
        return analyticsQueue;
      default:
        return null;
    }
  }
}