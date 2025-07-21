import { prisma } from './prisma';
import { EmailEventType } from '@/generated/prisma';
import { GeoIPService, LocationData } from './geoip';
import crypto from 'crypto';

export interface TrackingPixelData {
  campaignId: string;
  subscriberId: string;
  tenantId: string;
}

export interface TrackingLinkData {
  campaignId: string;
  subscriberId: string;
  tenantId: string;
  originalUrl: string;
  linkId: string;
}

export class EmailTrackingService {
  private static readonly TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'track.example.com';
  private static readonly ENCRYPTION_KEY = process.env.TRACKING_ENCRYPTION_KEY || 'default-key-change-in-production';

  /**
   * Generate a tracking pixel URL for email opens
   */
  static generateTrackingPixel(data: TrackingPixelData): string {
    const encrypted = this.encryptTrackingData(data);
    return `https://${this.TRACKING_DOMAIN}/pixel/${encrypted}.png`;
  }

  /**
   * Generate a tracking link for click tracking
   */
  static generateTrackingLink(data: TrackingLinkData): string {
    const encrypted = this.encryptTrackingData(data);
    return `https://${this.TRACKING_DOMAIN}/click/${encrypted}`;
  }

  /**
   * Process email content to add tracking pixels and convert links
   */
  static processEmailContent(
    content: string,
    campaignId: string,
    subscriberId: string,
    tenantId: string
  ): string {
    let processedContent = content;

    // Add tracking pixel before closing body tag
    const trackingPixel = this.generateTrackingPixel({
      campaignId,
      subscriberId,
      tenantId,
    });

    const pixelHtml = `<img src="${trackingPixel}" width="1" height="1" style="display:none;" alt="" />`;
    
    if (processedContent.includes('</body>')) {
      processedContent = processedContent.replace('</body>', `${pixelHtml}</body>`);
    } else {
      processedContent += pixelHtml;
    }

    // Convert all links to tracking links
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let linkCounter = 0;

    processedContent = processedContent.replace(linkRegex, (match, url) => {
      // Skip if already a tracking link or unsubscribe link
      if (url.includes(this.TRACKING_DOMAIN) || url.includes('unsubscribe')) {
        return match;
      }

      linkCounter++;
      const trackingLink = this.generateTrackingLink({
        campaignId,
        subscriberId,
        tenantId,
        originalUrl: url,
        linkId: `link_${linkCounter}`,
      });

      return match.replace(url, trackingLink);
    });

    return processedContent;
  }

  /**
   * Record email event in database with enhanced tracking
   */
  static async recordEmailEvent(
    type: EmailEventType,
    data: {
      campaignId?: string;
      subscriberId?: string;
      email: string;
      tenantId: string;
      ipAddress?: string;
      userAgent?: string;
      location?: any;
      metadata?: any;
    }
  ) {
    try {
      // Get geographic data if IP address is provided
      let locationData = data.location;
      if (data.ipAddress && !locationData) {
        locationData = await GeoIPService.getLocationData(data.ipAddress);
      }

      // Get subscriber email if not provided but subscriberId is available
      let email = data.email;
      if (!email && data.subscriberId) {
        const subscriber = await prisma.subscriber.findFirst({
          where: { id: data.subscriberId, tenantId: data.tenantId },
          select: { email: true },
        });
        email = subscriber?.email || 'unknown';
      }

      await prisma.emailEvent.create({
        data: {
          type,
          campaignId: data.campaignId,
          subscriberId: data.subscriberId,
          email,
          tenantId: data.tenantId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          location: locationData,
          metadata: {
            ...data.metadata,
            timestamp: new Date().toISOString(),
            trackingVersion: '2.0',
          },
        },
      });

      // Update campaign statistics if campaign is provided
      if (data.campaignId) {
        await this.updateCampaignStats(data.campaignId, type);
      }

      // Update subscriber engagement score asynchronously
      if (data.subscriberId) {
        this.updateSubscriberEngagement(data.subscriberId, data.tenantId, type).catch(
          error => console.error('Failed to update subscriber engagement:', error)
        );
      }
    } catch (error) {
      console.error('Failed to record email event:', error);
    }
  }

  /**
   * Update campaign statistics based on event type
   */
  private static async updateCampaignStats(campaignId: string, eventType: EmailEventType) {
    const updateData: any = {};

    switch (eventType) {
      case EmailEventType.SENT:
        updateData.totalSent = { increment: 1 };
        break;
      case EmailEventType.DELIVERED:
        updateData.totalDelivered = { increment: 1 };
        break;
      case EmailEventType.OPENED:
        updateData.totalOpened = { increment: 1 };
        break;
      case EmailEventType.CLICKED:
        updateData.totalClicked = { increment: 1 };
        break;
      case EmailEventType.UNSUBSCRIBED:
        updateData.totalUnsubscribed = { increment: 1 };
        break;
      case EmailEventType.BOUNCED:
        updateData.totalBounced = { increment: 1 };
        break;
      case EmailEventType.COMPLAINED:
        updateData.totalComplained = { increment: 1 };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
      });
    }
  }

  /**
   * Decrypt tracking data from URL parameter
   */
  static decryptTrackingData(encrypted: string): any {
    try {
      // Split the encrypted data to get IV and encrypted content
      const parts = encrypted.split(':');
      if (parts.length !== 2) {
        return null;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = Buffer.from(parts[1], 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.ENCRYPTION_KEY).subarray(0, 32), iv);
      let decrypted = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt tracking data:', error);
      return null;
    }
  }

  /**
   * Encrypt tracking data for URL parameter
   */
  private static encryptTrackingData(data: any): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.ENCRYPTION_KEY).subarray(0, 32), iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Failed to encrypt tracking data:', error);
      return '';
    }
  }

  /**
   * Generate unsubscribe link
   */
  static generateUnsubscribeLink(subscriberId: string, tenantId: string): string {
    const data = { subscriberId, tenantId, action: 'unsubscribe' };
    const encrypted = this.encryptTrackingData(data);
    return `https://${this.TRACKING_DOMAIN}/unsubscribe/${encrypted}`;
  }

  /**
   * Get email analytics for a campaign
   */
  static async getCampaignAnalytics(campaignId: string, tenantId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        emailEvents: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Calculate rates
    const openRate = campaign.totalSent > 0 ? (campaign.totalOpened / campaign.totalSent) * 100 : 0;
    const clickRate = campaign.totalSent > 0 ? (campaign.totalClicked / campaign.totalSent) * 100 : 0;
    const unsubscribeRate = campaign.totalSent > 0 ? (campaign.totalUnsubscribed / campaign.totalSent) * 100 : 0;
    const bounceRate = campaign.totalSent > 0 ? (campaign.totalBounced / campaign.totalSent) * 100 : 0;

    return {
      campaignId,
      totalSent: campaign.totalSent,
      totalDelivered: campaign.totalDelivered,
      totalOpened: campaign.totalOpened,
      totalClicked: campaign.totalClicked,
      totalUnsubscribed: campaign.totalUnsubscribed,
      totalBounced: campaign.totalBounced,
      totalComplained: campaign.totalComplained,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      recentEvents: campaign.emailEvents,
    };
  }

  /**
   * Get subscriber engagement analytics
   */
  static async getSubscriberAnalytics(subscriberId: string, tenantId: string) {
    const events = await prisma.emailEvent.findMany({
      where: { subscriberId, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: {
          select: { id: true, name: true, subject: true },
        },
      },
    });

    const eventCounts = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      subscriberId,
      totalEvents: events.length,
      eventCounts,
      recentEvents: events.slice(0, 20),
      engagementScore: this.calculateEngagementScore(eventCounts),
    };
  }

  /**
   * Calculate engagement score based on event types
   */
  private static calculateEngagementScore(eventCounts: Record<string, number>): number {
    const weights = {
      OPENED: 1,
      CLICKED: 3,
      UNSUBSCRIBED: -5,
      COMPLAINED: -10,
      BOUNCED: -2,
    };

    let score = 0;
    Object.entries(eventCounts).forEach(([type, count]) => {
      const weight = weights[type as keyof typeof weights] || 0;
      score += count * weight;
    });

    return Math.max(0, score);
  }

  /**
   * Update subscriber engagement score (async)
   */
  private static async updateSubscriberEngagement(
    subscriberId: string,
    tenantId: string,
    eventType: EmailEventType
  ) {
    try {
      // Get recent events for this subscriber to calculate engagement
      const recentEvents = await prisma.emailEvent.findMany({
        where: {
          subscriberId,
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        select: { type: true },
      });

      const eventCounts = recentEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const engagementScore = this.calculateEngagementScore(eventCounts);

      // Update subscriber with engagement data (if we had an engagement field)
      // For now, we'll just log it - in a real implementation, you might want to
      // store this in a separate engagement table or add fields to the subscriber model
      console.log(`Subscriber ${subscriberId} engagement score: ${engagementScore}`);
    } catch (error) {
      console.error('Failed to update subscriber engagement:', error);
    }
  }

  /**
   * Get detailed link analytics for a campaign
   */
  static async getLinkAnalytics(campaignId: string, tenantId: string) {
    const clickEvents = await prisma.emailEvent.findMany({
      where: {
        campaignId,
        tenantId,
        type: EmailEventType.CLICKED,
      },
      select: {
        metadata: true,
        createdAt: true,
        ipAddress: true,
        location: true,
      },
    });

    const linkStats: Record<string, {
      clicks: number;
      uniqueClicks: number;
      originalUrl: string;
      clicksByCountry: Record<string, number>;
      clicksByHour: Record<string, number>;
    }> = {};

    const uniqueClicksByLink: Record<string, Set<string>> = {};

    clickEvents.forEach(event => {
      if (event.metadata && typeof event.metadata === 'object') {
        const metadata = event.metadata as any;
        const linkId = metadata.linkId || 'unknown';
        const originalUrl = metadata.originalUrl || 'unknown';

        if (!linkStats[linkId]) {
          linkStats[linkId] = {
            clicks: 0,
            uniqueClicks: 0,
            originalUrl,
            clicksByCountry: {},
            clicksByHour: {},
          };
          uniqueClicksByLink[linkId] = new Set();
        }

        linkStats[linkId].clicks++;

        // Track unique clicks by IP
        if (event.ipAddress) {
          uniqueClicksByLink[linkId].add(event.ipAddress);
        }

        // Track clicks by country
        if (event.location && typeof event.location === 'object') {
          const location = event.location as LocationData;
          const country = location.country || 'Unknown';
          linkStats[linkId].clicksByCountry[country] = 
            (linkStats[linkId].clicksByCountry[country] || 0) + 1;
        }

        // Track clicks by hour
        const hour = event.createdAt.getHours();
        const hourKey = `${hour}:00`;
        linkStats[linkId].clicksByHour[hourKey] = 
          (linkStats[linkId].clicksByHour[hourKey] || 0) + 1;
      }
    });

    // Calculate unique clicks
    Object.keys(linkStats).forEach(linkId => {
      linkStats[linkId].uniqueClicks = uniqueClicksByLink[linkId]?.size || 0;
    });

    return Object.entries(linkStats).map(([linkId, stats]) => ({
      linkId,
      ...stats,
    }));
  }

  /**
   * Get unsubscribe pattern analysis
   */
  static async getUnsubscribePatterns(tenantId: string, timeRange?: { start: Date; end: Date }) {
    const whereClause: any = {
      tenantId,
      type: EmailEventType.UNSUBSCRIBED,
    };

    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const unsubscribeEvents = await prisma.emailEvent.findMany({
      where: whereClause,
      include: {
        campaign: {
          select: { id: true, name: true, subject: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Analyze patterns
    const patterns = {
      byDay: {} as Record<string, number>,
      byHour: {} as Record<number, number>,
      byCampaign: {} as Record<string, { count: number; campaignName: string }>,
      byCountry: {} as Record<string, number>,
      total: unsubscribeEvents.length,
    };

    unsubscribeEvents.forEach(event => {
      // By day
      const day = event.createdAt.toISOString().split('T')[0];
      patterns.byDay[day] = (patterns.byDay[day] || 0) + 1;

      // By hour
      const hour = event.createdAt.getHours();
      patterns.byHour[hour] = (patterns.byHour[hour] || 0) + 1;

      // By campaign
      if (event.campaign) {
        const campaignId = event.campaign.id;
        if (!patterns.byCampaign[campaignId]) {
          patterns.byCampaign[campaignId] = {
            count: 0,
            campaignName: event.campaign.name,
          };
        }
        patterns.byCampaign[campaignId].count++;
      }

      // By country
      if (event.location && typeof event.location === 'object') {
        const location = event.location as LocationData;
        const country = location.country || 'Unknown';
        patterns.byCountry[country] = (patterns.byCountry[country] || 0) + 1;
      }
    });

    return patterns;
  }
}