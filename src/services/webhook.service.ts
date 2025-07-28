/**
 * Webhook Service
 * Manages webhook endpoints and event delivery
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import axios from 'axios';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string | null;
  isActive: boolean;
  lastTriggeredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  tenantId: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  httpStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  deliveredAt?: Date;
  failedAt?: Date;
  retryCount: number;
  nextRetryAt?: Date;
  error?: string;
}

export class WebhookService {
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  /**
   * Create a new webhook
   */
  static async createWebhook(tenantId: string, data: CreateWebhookRequest): Promise<Webhook> {
    // Validate URL
    try {
      new URL(data.url);
    } catch (error) {
      throw new Error('Invalid webhook URL');
    }

    // Validate events
    const validEvents = this.getAvailableEvents().map(e => e.type);
    const invalidEvents = data.events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        secret: data.secret,
        tenantId,
        isActive: true,
      },
    });

    return {
      ...webhook,
      events: webhook.events as string[],
    };
  }

  /**
   * Get all webhooks for a tenant
   */
  static async getWebhooks(tenantId: string): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map(webhook => ({
      ...webhook,
      events: webhook.events as string[],
    }));
  }

  /**
   * Get webhook by ID
   */
  static async getWebhookById(tenantId: string, webhookId: string): Promise<Webhook | null> {
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        tenantId,
      },
    });

    if (!webhook) return null;

    return {
      ...webhook,
      events: webhook.events as string[],
    };
  }

  /**
   * Update webhook
   */
  static async updateWebhook(
    tenantId: string,
    webhookId: string,
    data: Partial<CreateWebhookRequest & { isActive: boolean }>
  ): Promise<Webhook | null> {
    // Validate URL if provided
    if (data.url) {
      try {
        new URL(data.url);
      } catch (error) {
        throw new Error('Invalid webhook URL');
      }
    }

    // Validate events if provided
    if (data.events) {
      const validEvents = this.getAvailableEvents().map(e => e.type);
      const invalidEvents = data.events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        tenantId,
      },
    });

    if (!webhook) return null;

    const updatedWebhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return {
      ...updatedWebhook,
      events: updatedWebhook.events as string[],
    };
  }

  /**
   * Delete webhook
   */
  static async deleteWebhook(tenantId: string, webhookId: string): Promise<boolean> {
    const result = await prisma.webhook.deleteMany({
      where: {
        id: webhookId,
        tenantId,
      },
    });

    return result.count > 0;
  }

  /**
   * Trigger webhook for an event
   */
  static async triggerWebhook(tenantId: string, eventType: string, eventData: any): Promise<void> {
    // Get all active webhooks for this tenant that listen to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const relevantWebhooks = webhooks.filter(webhook => {
      const events = webhook.events as string[];
      return events.includes(eventType) || events.includes('*');
    });

    if (relevantWebhooks.length === 0) return;

    // Create webhook event record
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      data: eventData,
      timestamp: new Date(),
      tenantId,
    };

    // Convert to properly typed Webhook objects and deliver
    const typedWebhooks = relevantWebhooks.map(webhook => ({
      ...webhook,
      events: webhook.events as string[]
    }));

    const deliveryPromises = typedWebhooks.map(webhook => this.deliverWebhook(webhook, event));

    // Execute deliveries in parallel (don't wait for completion)
    Promise.allSettled(deliveryPromises).catch(error => {
      console.error('Error in webhook deliveries:', error);
    });
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  private static async deliverWebhook(webhook: Webhook, event: WebhookEvent): Promise<void> {
    const deliveryId = crypto.randomUUID();

    try {
      // Create webhook payload
      const payload = {
        id: event.id,
        type: event.type,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
        webhook_id: webhook.id,
      };

      // Create signature if secret is provided
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailPlatform-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Event-ID': event.id,
        'X-Event-Type': event.type,
      };

      if (webhook.secret) {
        const signature = this.createSignature(JSON.stringify(payload), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Make HTTP request
      const startTime = Date.now();
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: status => status < 500, // Don't throw on 4xx errors
      });

      const responseTime = Date.now() - startTime;

      // Update last triggered timestamp
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() },
      });

      // Log successful delivery
      console.log(
        `Webhook delivered successfully: ${webhook.id} -> ${webhook.url} (${response.status}) in ${responseTime}ms`
      );
    } catch (error: any) {
      console.error(`Webhook delivery failed: ${webhook.id} -> ${webhook.url}`, error.message);

      // Schedule retry if appropriate
      await this.scheduleRetry(webhook, event, error.message);
    }
  }

  /**
   * Schedule webhook retry
   */
  private static async scheduleRetry(
    webhook: Webhook,
    event: WebhookEvent,
    error: string,
    retryCount: number = 0
  ): Promise<void> {
    if (retryCount >= this.MAX_RETRIES) {
      console.error(`Max retries exceeded for webhook ${webhook.id}`);
      return;
    }

    const delay = this.RETRY_DELAYS[retryCount] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
    const nextRetryAt = new Date(Date.now() + delay);

    // In a production environment, you would use a job queue like Bull
    // For now, we'll use setTimeout (not recommended for production)
    setTimeout(async () => {
      try {
        await this.deliverWebhook(webhook, event);
      } catch (retryError: any) {
        await this.scheduleRetry(webhook, event, retryError.message, retryCount + 1);
      }
    }, delay);
  }

  /**
   * Create webhook signature
   */
  private static createSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Test webhook endpoint
   */
  static async testWebhook(
    tenantId: string,
    webhookId: string
  ): Promise<{ success: boolean; status?: number; error?: string; responseTime?: number }> {
    const webhook = await this.getWebhookById(tenantId, webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        webhook_id: webhook.id,
        webhook_name: webhook.name,
      },
      timestamp: new Date(),
      tenantId,
    };

    try {
      const payload = {
        id: testEvent.id,
        type: testEvent.type,
        data: testEvent.data,
        timestamp: testEvent.timestamp.toISOString(),
        webhook_id: webhook.id,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailPlatform-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Event-ID': testEvent.id,
        'X-Event-Type': testEvent.type,
      };

      if (webhook.secret) {
        const signature = this.createSignature(JSON.stringify(payload), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const startTime = Date.now();
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 10000, // 10 second timeout for tests
        validateStatus: status => status < 500,
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        responseTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get available webhook events
   */
  static getAvailableEvents(): Array<{
    type: string;
    name: string;
    description: string;
    category: string;
  }> {
    return [
      // Campaign events
      {
        type: 'campaign.created',
        name: 'Campaign Created',
        description: 'Triggered when a new campaign is created',
        category: 'Campaigns',
      },
      {
        type: 'campaign.sent',
        name: 'Campaign Sent',
        description: 'Triggered when a campaign is sent',
        category: 'Campaigns',
      },
      {
        type: 'campaign.completed',
        name: 'Campaign Completed',
        description: 'Triggered when a campaign sending is completed',
        category: 'Campaigns',
      },

      // Subscriber events
      {
        type: 'subscriber.created',
        name: 'Subscriber Created',
        description: 'Triggered when a new subscriber is added',
        category: 'Subscribers',
      },
      {
        type: 'subscriber.updated',
        name: 'Subscriber Updated',
        description: 'Triggered when subscriber information is updated',
        category: 'Subscribers',
      },
      {
        type: 'subscriber.unsubscribed',
        name: 'Subscriber Unsubscribed',
        description: 'Triggered when a subscriber unsubscribes',
        category: 'Subscribers',
      },

      // Email events
      {
        type: 'email.opened',
        name: 'Email Opened',
        description: 'Triggered when an email is opened',
        category: 'Email Events',
      },
      {
        type: 'email.clicked',
        name: 'Email Clicked',
        description: 'Triggered when a link in an email is clicked',
        category: 'Email Events',
      },
      {
        type: 'email.bounced',
        name: 'Email Bounced',
        description: 'Triggered when an email bounces',
        category: 'Email Events',
      },
      {
        type: 'email.complained',
        name: 'Email Complained',
        description: 'Triggered when an email is marked as spam',
        category: 'Email Events',
      },

      // List events
      {
        type: 'list.created',
        name: 'List Created',
        description: 'Triggered when a new list is created',
        category: 'Lists',
      },
      {
        type: 'list.subscriber_added',
        name: 'Subscriber Added to List',
        description: 'Triggered when a subscriber is added to a list',
        category: 'Lists',
      },

      // Automation events
      {
        type: 'automation.started',
        name: 'Automation Started',
        description: 'Triggered when an automation is started for a subscriber',
        category: 'Automations',
      },
      {
        type: 'automation.completed',
        name: 'Automation Completed',
        description: 'Triggered when an automation is completed for a subscriber',
        category: 'Automations',
      },

      // Form events
      {
        type: 'form.submitted',
        name: 'Form Submitted',
        description: 'Triggered when a subscription form is submitted',
        category: 'Forms',
      },

      // Billing events
      {
        type: 'billing.payment_succeeded',
        name: 'Payment Succeeded',
        description: 'Triggered when a payment is successful',
        category: 'Billing',
      },
      {
        type: 'billing.payment_failed',
        name: 'Payment Failed',
        description: 'Triggered when a payment fails',
        category: 'Billing',
      },

      // System events
      {
        type: 'webhook.test',
        name: 'Webhook Test',
        description: 'Test event for webhook validation',
        category: 'System',
      },
      {
        type: '*',
        name: 'All Events',
        description: 'Subscribe to all webhook events',
        category: 'System',
      },
    ];
  }

  /**
   * Get webhook delivery statistics
   */
  static async getWebhookStats(
    tenantId: string,
    webhookId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    deliveriesByEvent: Record<string, number>;
    deliveriesByDay: Array<{ date: string; count: number }>;
  }> {
    // This would typically query a webhook_deliveries table
    // For now, return mock data
    return {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      deliveriesByEvent: {},
      deliveriesByDay: [],
    };
  }
}
