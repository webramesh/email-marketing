import { prisma } from '@/lib/prisma';
import { BounceComplaintType } from '@prisma/client';

export interface BounceData {
  email: string;
  bounceType: 'hard' | 'soft';
  bounceSubType?: string;
  reason?: string;
  campaignId?: string;
  messageId?: string;
  timestamp: Date;
  rawData?: any;
}

export interface ComplaintData {
  email: string;
  reason?: string;
  campaignId?: string;
  messageId?: string;
  timestamp: Date;
  rawData?: any;
}

export interface UnsubscribeData {
  email: string;
  campaignId?: string;
  messageId?: string;
  timestamp: Date;
  rawData?: any;
}

export interface ReputationMetrics {
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
  totalSent: number;
  totalBounced: number;
  totalComplaints: number;
  totalUnsubscribed: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export class BounceComplaintService {
  async processBounce(tenantId: string, bounceData: BounceData): Promise<void> {
    try {
      // Create bounce record
      await prisma.bounceComplaint.create({
        data: {
          tenantId,
          email: bounceData.email,
          type: bounceData.bounceType === 'hard' ? BounceComplaintType.HARD_BOUNCE : BounceComplaintType.SOFT_BOUNCE,
          reason: bounceData.reason,
          bounceType: bounceData.bounceSubType,
          campaignId: bounceData.campaignId,
          rawData: bounceData.rawData,
          createdAt: bounceData.timestamp,
        },
      });

      // Update subscriber status for hard bounces
      if (bounceData.bounceType === 'hard') {
        await this.updateSubscriberStatus(tenantId, bounceData.email, 'BOUNCED');
      }

      // Update campaign statistics
      if (bounceData.campaignId) {
        await this.updateCampaignStats(bounceData.campaignId, 'bounce');
      }

      // Check reputation and send alerts if necessary
      await this.checkReputationThresholds(tenantId);

    } catch (error) {
      console.error('Error processing bounce:', error);
      throw error;
    }
  }

  async processComplaint(tenantId: string, complaintData: ComplaintData): Promise<void> {
    try {
      // Create complaint record
      await prisma.bounceComplaint.create({
        data: {
          tenantId,
          email: complaintData.email,
          type: BounceComplaintType.COMPLAINT,
          reason: complaintData.reason,
          campaignId: complaintData.campaignId,
          rawData: complaintData.rawData,
          createdAt: complaintData.timestamp,
        },
      });

      // Automatically unsubscribe complainant
      await this.updateSubscriberStatus(tenantId, complaintData.email, 'COMPLAINED');

      // Update campaign statistics
      if (complaintData.campaignId) {
        await this.updateCampaignStats(complaintData.campaignId, 'complaint');
      }

      // Check reputation and send alerts if necessary
      await this.checkReputationThresholds(tenantId);

    } catch (error) {
      console.error('Error processing complaint:', error);
      throw error;
    }
  }

  async processUnsubscribe(tenantId: string, unsubscribeData: UnsubscribeData): Promise<void> {
    try {
      // Update subscriber status
      await this.updateSubscriberStatus(tenantId, unsubscribeData.email, 'UNSUBSCRIBED');

      // Update campaign statistics
      if (unsubscribeData.campaignId) {
        await this.updateCampaignStats(unsubscribeData.campaignId, 'unsubscribe');
      }

      // Log the unsubscribe event
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'UNSUBSCRIBE',
          resource: 'subscriber',
          resourceId: unsubscribeData.email,
          metadata: {
            campaignId: unsubscribeData.campaignId,
            messageId: unsubscribeData.messageId,
            timestamp: unsubscribeData.timestamp,
            rawData: unsubscribeData.rawData,
          },
        },
      });

    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      throw error;
    }
  }

  async getSuppressionList(tenantId: string): Promise<string[]> {
    const suppressedSubscribers = await prisma.subscriber.findMany({
      where: {
        tenantId,
        status: {
          in: ['BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'],
        },
      },
      select: {
        email: true,
      },
    });

    return suppressedSubscribers.map(s => s.email);
  }

  async isEmailSuppressed(tenantId: string, email: string): Promise<boolean> {
    const subscriber = await prisma.subscriber.findFirst({
      where: {
        tenantId,
        email,
        status: {
          in: ['BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'],
        },
      },
    });

    return !!subscriber;
  }

  async getReputationMetrics(tenantId: string, days: number = 30): Promise<ReputationMetrics> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get total sent emails
    const totalSent = await prisma.auditLog.count({
      where: {
        tenantId,
        action: 'EMAIL_SEND',
        createdAt: { gte: since },
        metadata: {
          path: ['success'],
          equals: true,
        },
      },
    });

    // Get bounce statistics
    const totalBounced = await prisma.bounceComplaint.count({
      where: {
        tenantId,
        type: {
          in: [BounceComplaintType.HARD_BOUNCE, BounceComplaintType.SOFT_BOUNCE],
        },
        createdAt: { gte: since },
      },
    });

    // Get complaint statistics
    const totalComplaints = await prisma.bounceComplaint.count({
      where: {
        tenantId,
        type: BounceComplaintType.COMPLAINT,
        createdAt: { gte: since },
      },
    });

    // Get unsubscribe statistics
    const totalUnsubscribed = await prisma.auditLog.count({
      where: {
        tenantId,
        action: 'UNSUBSCRIBE',
        createdAt: { gte: since },
      },
    });

    // Calculate rates
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0;
    const unsubscribeRate = totalSent > 0 ? (totalUnsubscribed / totalSent) * 100 : 0;

    // Determine risk level and recommendations
    const { riskLevel, recommendations } = this.assessRisk(bounceRate, complaintRate, unsubscribeRate);

    return {
      bounceRate,
      complaintRate,
      unsubscribeRate,
      totalSent,
      totalBounced,
      totalComplaints,
      totalUnsubscribed,
      riskLevel,
      recommendations,
    };
  }

  async getBounceComplaintHistory(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{
    id: string;
    email: string;
    type: string;
    reason: string | null;
    campaignId: string | null;
    createdAt: Date;
  }>> {
    const records = await prisma.bounceComplaint.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        type: true,
        reason: true,
        campaignId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    return records;
  }

  async cleanSuppressionList(tenantId: string, olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Only clean soft bounces older than the cutoff date
    const result = await prisma.bounceComplaint.deleteMany({
      where: {
        tenantId,
        type: BounceComplaintType.SOFT_BOUNCE,
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  private async updateSubscriberStatus(
    tenantId: string,
    email: string,
    status: 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED'
  ): Promise<void> {
    await prisma.subscriber.updateMany({
      where: {
        tenantId,
        email,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  private async updateCampaignStats(
    campaignId: string,
    eventType: 'bounce' | 'complaint' | 'unsubscribe'
  ): Promise<void> {
    const updateData: any = {};

    switch (eventType) {
      case 'bounce':
        updateData.totalBounced = { increment: 1 };
        break;
      case 'complaint':
        updateData.totalComplained = { increment: 1 };
        break;
      case 'unsubscribe':
        updateData.totalUnsubscribed = { increment: 1 };
        break;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
    });
  }

  private async checkReputationThresholds(tenantId: string): Promise<void> {
    const metrics = await this.getReputationMetrics(tenantId, 7); // Check last 7 days

    // Define thresholds
    const BOUNCE_THRESHOLD = 5; // 5%
    const COMPLAINT_THRESHOLD = 0.1; // 0.1%

    const alerts: string[] = [];

    if (metrics.bounceRate > BOUNCE_THRESHOLD) {
      alerts.push(`High bounce rate detected: ${metrics.bounceRate.toFixed(2)}%`);
    }

    if (metrics.complaintRate > COMPLAINT_THRESHOLD) {
      alerts.push(`High complaint rate detected: ${metrics.complaintRate.toFixed(2)}%`);
    }

    if (alerts.length > 0) {
      // Log alerts
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'REPUTATION_ALERT',
          resource: 'tenant',
          resourceId: tenantId,
          metadata: {
            alerts,
            metrics,
            timestamp: new Date(),
          },
        },
      });

      // In a real application, you would send notifications here
      console.warn(`Reputation alerts for tenant ${tenantId}:`, alerts);
    }
  }

  private assessRisk(
    bounceRate: number,
    complaintRate: number,
    unsubscribeRate: number
  ): { riskLevel: 'low' | 'medium' | 'high'; recommendations: string[] } {
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Bounce rate assessment
    if (bounceRate > 10) {
      riskLevel = 'high';
      recommendations.push('Clean your email list to remove invalid addresses');
      recommendations.push('Implement double opt-in for new subscribers');
    } else if (bounceRate > 5) {
      riskLevel = 'medium';
      recommendations.push('Review your email list quality');
    }

    // Complaint rate assessment
    if (complaintRate > 0.5) {
      riskLevel = 'high';
      recommendations.push('Review your email content and sending frequency');
      recommendations.push('Ensure clear unsubscribe options');
    } else if (complaintRate > 0.1) {
      if (riskLevel === 'low') riskLevel = 'medium';
      recommendations.push('Monitor email content relevance');
    }

    // Unsubscribe rate assessment
    if (unsubscribeRate > 5) {
      if (riskLevel === 'low') riskLevel = 'medium';
      recommendations.push('Review email frequency and content relevance');
      recommendations.push('Consider segmentation to improve targeting');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your email reputation is healthy');
    }

    return { riskLevel, recommendations };
  }

  // Webhook processing methods for different providers
  async processAmazonSESWebhook(tenantId: string, webhookData: any): Promise<void> {
    const message = JSON.parse(webhookData.Message);
    
    if (message.notificationType === 'Bounce') {
      const bounce = message.bounce;
      for (const recipient of bounce.bouncedRecipients) {
        await this.processBounce(tenantId, {
          email: recipient.emailAddress,
          bounceType: bounce.bounceType === 'Permanent' ? 'hard' : 'soft',
          bounceSubType: bounce.bounceSubType,
          reason: recipient.diagnosticCode,
          timestamp: new Date(message.mail.timestamp),
          rawData: webhookData,
        });
      }
    } else if (message.notificationType === 'Complaint') {
      const complaint = message.complaint;
      for (const recipient of complaint.complainedRecipients) {
        await this.processComplaint(tenantId, {
          email: recipient.emailAddress,
          reason: complaint.complaintFeedbackType,
          timestamp: new Date(message.mail.timestamp),
          rawData: webhookData,
        });
      }
    }
  }

  async processSendGridWebhook(tenantId: string, events: any[]): Promise<void> {
    for (const event of events) {
      switch (event.event) {
        case 'bounce':
          await this.processBounce(tenantId, {
            email: event.email,
            bounceType: event.type === 'bounce' ? 'hard' : 'soft',
            reason: event.reason,
            timestamp: new Date(event.timestamp * 1000),
            rawData: event,
          });
          break;
        
        case 'spamreport':
          await this.processComplaint(tenantId, {
            email: event.email,
            reason: 'spam report',
            timestamp: new Date(event.timestamp * 1000),
            rawData: event,
          });
          break;
        
        case 'unsubscribe':
          await this.processUnsubscribe(tenantId, {
            email: event.email,
            timestamp: new Date(event.timestamp * 1000),
            rawData: event,
          });
          break;
      }
    }
  }

  async processMailgunWebhook(tenantId: string, webhookData: any): Promise<void> {
    const eventData = webhookData['event-data'];
    
    switch (eventData.event) {
      case 'failed':
        if (eventData.severity === 'permanent') {
          await this.processBounce(tenantId, {
            email: eventData.recipient,
            bounceType: 'hard',
            reason: eventData['delivery-status']?.description,
            timestamp: new Date(eventData.timestamp * 1000),
            rawData: webhookData,
          });
        }
        break;
      
      case 'complained':
        await this.processComplaint(tenantId, {
          email: eventData.recipient,
          reason: 'complaint',
          timestamp: new Date(eventData.timestamp * 1000),
          rawData: webhookData,
        });
        break;
      
      case 'unsubscribed':
        await this.processUnsubscribe(tenantId, {
          email: eventData.recipient,
          timestamp: new Date(eventData.timestamp * 1000),
          rawData: webhookData,
        });
        break;
    }
  }
}