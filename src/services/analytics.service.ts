import { prisma } from '@/lib/prisma';
import { EmailEventType } from '@/generated/prisma';

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
}

export interface CampaignPerformanceMetrics {
  campaignId: string;
  campaignName: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalBounced: number;
  totalComplained: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  deliveryRate: number;
}

export interface EngagementAnalytics {
  totalSubscribers: number;
  activeSubscribers: number;
  engagementRate: number;
  topPerformingCampaigns: CampaignPerformanceMetrics[];
  recentActivity: any[];
}

export interface GeographicAnalytics {
  country: string;
  opens: number;
  clicks: number;
  subscribers: number;
}

export interface UnsubscribePattern {
  date: string;
  count: number;
  campaigns: string[];
  reasons: string[];
}

export class AnalyticsService {
  /**
   * Get comprehensive campaign analytics
   */
  static async getCampaignAnalytics(
    campaignId: string,
    tenantId: string
  ): Promise<CampaignPerformanceMetrics> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: {
        id: true,
        name: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalUnsubscribed: true,
        totalBounced: true,
        totalComplained: true,
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const deliveryRate = campaign.totalSent > 0 
      ? (campaign.totalDelivered / campaign.totalSent) * 100 
      : 0;
    
    const openRate = campaign.totalDelivered > 0 
      ? (campaign.totalOpened / campaign.totalDelivered) * 100 
      : 0;
    
    const clickRate = campaign.totalDelivered > 0 
      ? (campaign.totalClicked / campaign.totalDelivered) * 100 
      : 0;
    
    const unsubscribeRate = campaign.totalSent > 0 
      ? (campaign.totalUnsubscribed / campaign.totalSent) * 100 
      : 0;
    
    const bounceRate = campaign.totalSent > 0 
      ? (campaign.totalBounced / campaign.totalSent) * 100 
      : 0;

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalSent: campaign.totalSent,
      totalDelivered: campaign.totalDelivered,
      totalOpened: campaign.totalOpened,
      totalClicked: campaign.totalClicked,
      totalUnsubscribed: campaign.totalUnsubscribed,
      totalBounced: campaign.totalBounced,
      totalComplained: campaign.totalComplained,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
    };
  }

  /**
   * Get engagement analytics for a tenant
   */
  static async getEngagementAnalytics(
    tenantId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<EngagementAnalytics> {
    const whereClause: any = { tenantId };
    
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    // Get subscriber counts
    const totalSubscribers = await prisma.subscriber.count({
      where: { tenantId },
    });

    const activeSubscribers = await prisma.subscriber.count({
      where: { 
        tenantId,
        status: 'ACTIVE',
      },
    });

    // Get recent email events for engagement calculation
    const recentEvents = await prisma.emailEvent.findMany({
      where: {
        tenantId,
        type: { in: [EmailEventType.OPENED, EmailEventType.CLICKED] },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      distinct: ['subscriberId'],
    });

    const engagementRate = activeSubscribers > 0 
      ? (recentEvents.length / activeSubscribers) * 100 
      : 0;

    // Get top performing campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { 
        tenantId,
        status: 'SENT',
        ...(timeRange && {
          sentAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }),
      },
      orderBy: [
        { totalOpened: 'desc' },
        { totalClicked: 'desc' },
      ],
      take: 5,
    });

    const topPerformingCampaigns = campaigns.map(campaign => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalSent: campaign.totalSent,
      totalDelivered: campaign.totalDelivered,
      totalOpened: campaign.totalOpened,
      totalClicked: campaign.totalClicked,
      totalUnsubscribed: campaign.totalUnsubscribed,
      totalBounced: campaign.totalBounced,
      totalComplained: campaign.totalComplained,
      deliveryRate: campaign.totalSent > 0 ? (campaign.totalDelivered / campaign.totalSent) * 100 : 0,
      openRate: campaign.totalDelivered > 0 ? (campaign.totalOpened / campaign.totalDelivered) * 100 : 0,
      clickRate: campaign.totalDelivered > 0 ? (campaign.totalClicked / campaign.totalDelivered) * 100 : 0,
      unsubscribeRate: campaign.totalSent > 0 ? (campaign.totalUnsubscribed / campaign.totalSent) * 100 : 0,
      bounceRate: campaign.totalSent > 0 ? (campaign.totalBounced / campaign.totalSent) * 100 : 0,
    }));

    // Get recent activity
    const recentActivity = await prisma.emailEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        campaign: {
          select: { name: true },
        },
        subscriber: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    return {
      totalSubscribers,
      activeSubscribers,
      engagementRate: Math.round(engagementRate * 100) / 100,
      topPerformingCampaigns,
      recentActivity,
    };
  }

  /**
   * Get geographic analytics
   */
  static async getGeographicAnalytics(
    tenantId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<GeographicAnalytics[]> {
    const whereClause: any = { tenantId };
    
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    // Get events with location data
    const events = await prisma.emailEvent.findMany({
      where: {
        ...whereClause,
        location: { not: null },
      },
      select: {
        type: true,
        location: true,
      },
    });

    // Group by country and count events
    const countryStats: Record<string, { opens: number; clicks: number }> = {};

    events.forEach(event => {
      if (event.location && typeof event.location === 'object') {
        const location = event.location as any;
        const country = location.country || 'Unknown';
        
        if (!countryStats[country]) {
          countryStats[country] = { opens: 0, clicks: 0 };
        }

        if (event.type === EmailEventType.OPENED) {
          countryStats[country].opens++;
        } else if (event.type === EmailEventType.CLICKED) {
          countryStats[country].clicks++;
        }
      }
    });

    // Convert to array and sort by total activity
    return Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        opens: stats.opens,
        clicks: stats.clicks,
        subscribers: 0, // We'd need additional logic to count unique subscribers per country
      }))
      .sort((a, b) => (b.opens + b.clicks) - (a.opens + a.clicks));
  }

  /**
   * Analyze unsubscribe patterns
   */
  static async getUnsubscribePatterns(
    tenantId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<UnsubscribePattern[]> {
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
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by date
    const dailyPatterns: Record<string, {
      count: number;
      campaigns: Set<string>;
      reasons: string[];
    }> = {};

    unsubscribeEvents.forEach(event => {
      const date = event.createdAt.toISOString().split('T')[0];
      
      if (!dailyPatterns[date]) {
        dailyPatterns[date] = {
          count: 0,
          campaigns: new Set(),
          reasons: [],
        };
      }

      dailyPatterns[date].count++;
      
      if (event.campaign?.name) {
        dailyPatterns[date].campaigns.add(event.campaign.name);
      }

      // Extract reason from metadata if available
      if (event.metadata && typeof event.metadata === 'object') {
        const metadata = event.metadata as any;
        if (metadata.reason) {
          dailyPatterns[date].reasons.push(metadata.reason);
        }
      }
    });

    return Object.entries(dailyPatterns)
      .map(([date, data]) => ({
        date,
        count: data.count,
        campaigns: Array.from(data.campaigns),
        reasons: data.reasons,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get email event timeline for a specific campaign
   */
  static async getCampaignTimeline(
    campaignId: string,
    tenantId: string,
    timeRange?: AnalyticsTimeRange
  ) {
    const whereClause: any = { 
      campaignId,
      tenantId,
    };
    
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const events = await prisma.emailEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: {
        subscriber: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    // Group events by hour for timeline visualization
    const hourlyStats: Record<string, Record<string, number>> = {};

    events.forEach(event => {
      const hour = event.createdAt.toISOString().slice(0, 13) + ':00:00.000Z';
      
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = {};
      }

      hourlyStats[hour][event.type] = (hourlyStats[hour][event.type] || 0) + 1;
    });

    return {
      timeline: Object.entries(hourlyStats)
        .map(([hour, stats]) => ({
          timestamp: hour,
          ...stats,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      totalEvents: events.length,
      eventsByType: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Get subscriber engagement score distribution
   */
  static async getEngagementScoreDistribution(tenantId: string) {
    const subscribers = await prisma.subscriber.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        emailEvents: {
          select: { type: true },
        },
      },
    });

    const scoreDistribution = {
      high: 0,    // Score > 10
      medium: 0,  // Score 5-10
      low: 0,     // Score 1-4
      inactive: 0, // Score 0
    };

    subscribers.forEach(subscriber => {
      const eventCounts = subscriber.emailEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const score = this.calculateEngagementScore(eventCounts);

      if (score > 10) {
        scoreDistribution.high++;
      } else if (score >= 5) {
        scoreDistribution.medium++;
      } else if (score >= 1) {
        scoreDistribution.low++;
      } else {
        scoreDistribution.inactive++;
      }
    });

    return scoreDistribution;
  }

  /**
   * Calculate engagement score (same as in tracking service)
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
   * Get real-time dashboard metrics
   */
  static async getDashboardMetrics(tenantId: string) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get campaign counts and statistics
    const [
      totalCampaigns,
      activeCampaigns,
      totalSubscribers,
      activeSubscribers,
      recentEvents,
      campaignStats,
    ] = await Promise.all([
      prisma.campaign.count({ where: { tenantId } }),
      prisma.campaign.count({ where: { tenantId, status: 'SENT' } }),
      prisma.subscriber.count({ where: { tenantId } }),
      prisma.subscriber.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.emailEvent.findMany({
        where: {
          tenantId,
          createdAt: { gte: last24Hours },
        },
        select: { type: true, createdAt: true },
      }),
      prisma.campaign.aggregate({
        where: { tenantId, status: 'SENT' },
        _sum: {
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalUnsubscribed: true,
          totalBounced: true,
        },
      }),
    ]);

    // Calculate rates
    const totalSent = campaignStats._sum.totalSent || 0;
    const totalDelivered = campaignStats._sum.totalDelivered || 0;
    const totalOpened = campaignStats._sum.totalOpened || 0;
    const totalClicked = campaignStats._sum.totalClicked || 0;

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;

    // Group recent events by hour for timeline
    const eventTimeline = this.groupEventsByHour(recentEvents, 24);

    return {
      overview: {
        totalCampaigns,
        activeCampaigns,
        totalSubscribers,
        activeSubscribers,
        totalSent: campaignStats._sum.totalSent || 0,
        totalDelivered: campaignStats._sum.totalDelivered || 0,
        totalOpened: campaignStats._sum.totalOpened || 0,
        totalClicked: campaignStats._sum.totalClicked || 0,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
      },
      timeline: eventTimeline,
      recentActivity: recentEvents.slice(0, 10),
    };
  }

  /**
   * Get campaign comparison analytics
   */
  static async getCampaignComparison(
    campaignIds: string[],
    tenantId: string
  ): Promise<CampaignPerformanceMetrics[]> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        id: { in: campaignIds },
        tenantId,
      },
      select: {
        id: true,
        name: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalUnsubscribed: true,
        totalBounced: true,
        totalComplained: true,
        sentAt: true,
      },
    });

    return campaigns.map(campaign => {
      const deliveryRate = campaign.totalSent > 0 
        ? (campaign.totalDelivered / campaign.totalSent) * 100 
        : 0;
      
      const openRate = campaign.totalDelivered > 0 
        ? (campaign.totalOpened / campaign.totalDelivered) * 100 
        : 0;
      
      const clickRate = campaign.totalDelivered > 0 
        ? (campaign.totalClicked / campaign.totalDelivered) * 100 
        : 0;
      
      const unsubscribeRate = campaign.totalSent > 0 
        ? (campaign.totalUnsubscribed / campaign.totalSent) * 100 
        : 0;
      
      const bounceRate = campaign.totalSent > 0 
        ? (campaign.totalBounced / campaign.totalSent) * 100 
        : 0;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        totalSent: campaign.totalSent,
        totalDelivered: campaign.totalDelivered,
        totalOpened: campaign.totalOpened,
        totalClicked: campaign.totalClicked,
        totalUnsubscribed: campaign.totalUnsubscribed,
        totalBounced: campaign.totalBounced,
        totalComplained: campaign.totalComplained,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
      };
    });
  }

  /**
   * Get cohort analysis data
   */
  static async getCohortAnalysis(tenantId: string, timeRange?: AnalyticsTimeRange) {
    const whereClause: any = { tenantId };
    
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    // Get subscribers grouped by signup month
    const subscribers = await prisma.subscriber.findMany({
      where: whereClause,
      select: {
        id: true,
        createdAt: true,
        emailEvents: {
          select: {
            type: true,
            createdAt: true,
          },
        },
      },
    });

    // Group subscribers by cohort (month they signed up)
    const cohorts: Record<string, {
      subscribers: string[];
      engagementByMonth: Record<string, number>;
    }> = {};

    subscribers.forEach(subscriber => {
      const cohortMonth = subscriber.createdAt.toISOString().slice(0, 7); // YYYY-MM
      
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = {
          subscribers: [],
          engagementByMonth: {},
        };
      }

      cohorts[cohortMonth].subscribers.push(subscriber.id);

      // Track engagement by month for this subscriber
      subscriber.emailEvents.forEach(event => {
        if (event.type === EmailEventType.OPENED || event.type === EmailEventType.CLICKED) {
          const eventMonth = event.createdAt.toISOString().slice(0, 7);
          const monthsAfterSignup = this.getMonthsDifference(
            new Date(cohortMonth + '-01'),
            new Date(eventMonth + '-01')
          );

          const key = `month_${monthsAfterSignup}`;
          cohorts[cohortMonth].engagementByMonth[key] = 
            (cohorts[cohortMonth].engagementByMonth[key] || 0) + 1;
        }
      });
    });

    // Convert to cohort table format
    return Object.entries(cohorts).map(([cohortMonth, data]) => ({
      cohort: cohortMonth,
      size: data.subscribers.length,
      engagementByMonth: data.engagementByMonth,
    }));
  }

  /**
   * Get enhanced geographic analytics with GeoIP data
   */
  static async getEnhancedGeographicAnalytics(
    tenantId: string,
    timeRange?: AnalyticsTimeRange
  ) {
    const whereClause: any = { 
      tenantId,
      location: { not: null },
    };
    
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const events = await prisma.emailEvent.findMany({
      where: whereClause,
      select: {
        type: true,
        location: true,
        subscriberId: true,
      },
    });

    const countryStats: Record<string, {
      opens: number;
      clicks: number;
      unsubscribes: number;
      uniqueSubscribers: Set<string>;
      cities: Record<string, number>;
    }> = {};

    events.forEach(event => {
      if (event.location && typeof event.location === 'object') {
        const location = event.location as any;
        const country = location.country || 'Unknown';
        const city = location.city || 'Unknown';

        if (!countryStats[country]) {
          countryStats[country] = {
            opens: 0,
            clicks: 0,
            unsubscribes: 0,
            uniqueSubscribers: new Set(),
            cities: {},
          };
        }

        if (event.subscriberId) {
          countryStats[country].uniqueSubscribers.add(event.subscriberId);
        }

        countryStats[country].cities[city] = (countryStats[country].cities[city] || 0) + 1;

        switch (event.type) {
          case EmailEventType.OPENED:
            countryStats[country].opens++;
            break;
          case EmailEventType.CLICKED:
            countryStats[country].clicks++;
            break;
          case EmailEventType.UNSUBSCRIBED:
            countryStats[country].unsubscribes++;
            break;
        }
      }
    });

    return Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        opens: stats.opens,
        clicks: stats.clicks,
        unsubscribes: stats.unsubscribes,
        uniqueSubscribers: stats.uniqueSubscribers.size,
        engagementRate: (stats.opens + stats.clicks) > 0 
          ? ((stats.opens + stats.clicks) / (stats.opens + stats.clicks + stats.unsubscribes)) * 100 
          : 0,
        topCities: Object.entries(stats.cities)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([city, count]) => ({ city, count })),
      }))
      .sort((a, b) => (b.opens + b.clicks) - (a.opens + a.clicks));
  }

  /**
   * Helper method to group events by hour
   */
  private static groupEventsByHour(events: any[], hours: number) {
    const now = new Date();
    const timeline: Record<string, Record<string, number>> = {};

    // Initialize timeline with empty hours
    for (let i = 0; i < hours; i++) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = hour.toISOString().slice(0, 13) + ':00:00.000Z';
      timeline[hourKey] = {};
    }

    // Fill timeline with actual events
    events.forEach(event => {
      const hourKey = event.createdAt.toISOString().slice(0, 13) + ':00:00.000Z';
      if (timeline[hourKey]) {
        timeline[hourKey][event.type] = (timeline[hourKey][event.type] || 0) + 1;
      }
    });

    return Object.entries(timeline)
      .map(([hour, stats]) => ({
        timestamp: hour,
        ...stats,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Helper method to calculate months difference
   */
  private static getMonthsDifference(date1: Date, date2: Date): number {
    return (date2.getFullYear() - date1.getFullYear()) * 12 + 
           (date2.getMonth() - date1.getMonth());
  }
}