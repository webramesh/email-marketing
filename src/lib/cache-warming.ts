import { cache, CacheKeys, CacheTTL } from './cache';
import { prisma } from './prisma';

/**
 * Cache warming strategies for frequently accessed data
 */
export class CacheWarmingService {
  /**
   * Warm up tenant-specific data
   */
  static async warmTenantData(tenantId: string): Promise<void> {
    try {
      console.log(`Starting cache warming for tenant: ${tenantId}`);

      await Promise.all([
        this.warmTenantSettings(tenantId),
        this.warmUserPermissions(tenantId),
        this.warmSubscriberCounts(tenantId),
        this.warmActiveCampaigns(tenantId),
        this.warmSendingServers(tenantId),
        this.warmDomains(tenantId),
      ]);

      console.log(`Cache warming completed for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`Cache warming failed for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Warm tenant settings
   */
  private static async warmTenantSettings(tenantId: string): Promise<void> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (tenant) {
        await cache.set(CacheKeys.tenant(tenantId), tenant, { ttl: CacheTTL.TENANT_SETTINGS });

        // Cache tenant quota information
        const planQuotas = tenant.subscription?.plan?.quotas as any;
        const quota = {
          emailsPerMonth: planQuotas?.emailsPerMonth || 0,
          subscribersLimit: planQuotas?.subscribersLimit || 0,
          currentEmailsSent: 0, // This would be calculated from usage
          currentSubscribers: 0, // This would be calculated from subscriber count
        };

        await cache.set(CacheKeys.tenantQuota(tenantId), quota, { ttl: CacheTTL.MEDIUM });
      }
    } catch (error) {
      console.error(`Failed to warm tenant settings for ${tenantId}:`, error);
    }
  }

  /**
   * Warm user permissions for active users
   */
  private static async warmUserPermissions(tenantId: string): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      const cachePromises = users.map(user => {
        const permissions = {
          role: user.role,
          permissions: [], // User permissions would be derived from role or stored elsewhere
        };

        return cache.set(CacheKeys.userPermissions(tenantId, user.id), permissions, {
          ttl: CacheTTL.USER_PERMISSIONS,
        });
      });

      await Promise.all(cachePromises);
    } catch (error) {
      console.error(`Failed to warm user permissions for ${tenantId}:`, error);
    }
  }

  /**
   * Warm subscriber counts for lists and segments
   */
  private static async warmSubscriberCounts(tenantId: string): Promise<void> {
    try {
      // Total subscriber count
      const totalCount = await prisma.subscriber.count({
        where: { tenantId, status: 'ACTIVE' },
      });

      await cache.set(CacheKeys.subscriberCount(tenantId), totalCount, {
        ttl: CacheTTL.SUBSCRIBER_COUNT,
      });

      // List-specific counts
      const lists = await prisma.list.findMany({
        where: { tenantId },
        select: { id: true },
      });

      const listCountPromises = lists.map(async list => {
        const count = await prisma.listSubscriber.count({
          where: {
            listId: list.id,
            subscriber: { tenantId, status: 'ACTIVE' },
          },
        });

        return cache.set(CacheKeys.subscriberCount(tenantId, list.id), count, {
          ttl: CacheTTL.SUBSCRIBER_COUNT,
        });
      });

      await Promise.all(listCountPromises);

      // Segment-specific counts
      const segments = await prisma.segment.findMany({
        where: { tenantId },
        select: { id: true, conditions: true },
      });

      const segmentCountPromises = segments.map(async segment => {
        // This would require implementing segment condition evaluation
        // For now, we'll cache a placeholder
        const count = 0; // TODO: Implement segment subscriber counting

        return cache.set(CacheKeys.segmentCount(tenantId, segment.id), count, {
          ttl: CacheTTL.SUBSCRIBER_COUNT,
        });
      });

      await Promise.all(segmentCountPromises);
    } catch (error) {
      console.error(`Failed to warm subscriber counts for ${tenantId}:`, error);
    }
  }

  /**
   * Warm active campaign data
   */
  private static async warmActiveCampaigns(tenantId: string): Promise<void> {
    try {
      const activeCampaigns = await prisma.campaign.findMany({
        where: {
          tenantId,
          status: { in: ['DRAFT', 'SCHEDULED', 'SENDING'] },
        },
        include: {
          analytics: true,
        },
      });

      const cachePromises = activeCampaigns.map(campaign => {
        return Promise.all([
          cache.set(CacheKeys.campaign(tenantId, campaign.id), campaign, { ttl: CacheTTL.MEDIUM }),
          campaign.analytics
            ? cache.set(CacheKeys.campaignStats(tenantId, campaign.id), campaign.analytics, {
                ttl: CacheTTL.CAMPAIGN_STATS,
              })
            : Promise.resolve(),
        ]);
      });

      await Promise.all(cachePromises);
    } catch (error) {
      console.error(`Failed to warm active campaigns for ${tenantId}:`, error);
    }
  }

  /**
   * Warm sending server configurations
   */
  private static async warmSendingServers(tenantId: string): Promise<void> {
    try {
      const sendingServers = await prisma.sendingServer.findMany({
        where: { tenantId, isActive: true },
      });

      const cachePromises = sendingServers.map(server => {
        return cache.set(CacheKeys.sendingServer(tenantId, server.id), server, {
          ttl: CacheTTL.LONG,
        });
      });

      await Promise.all(cachePromises);
    } catch (error) {
      console.error(`Failed to warm sending servers for ${tenantId}:`, error);
    }
  }

  /**
   * Warm domain configurations
   */
  private static async warmDomains(tenantId: string): Promise<void> {
    try {
      const domains = await prisma.domain.findMany({
        where: { tenantId },
      });

      const cachePromises = domains.map(domain => {
        return cache.set(CacheKeys.domain(tenantId, domain.id), domain, { ttl: CacheTTL.LONG });
      });

      await Promise.all(cachePromises);
    } catch (error) {
      console.error(`Failed to warm domains for ${tenantId}:`, error);
    }
  }

  /**
   * Warm dashboard statistics
   */
  static async warmDashboardStats(tenantId: string): Promise<void> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalSubscribers, totalCampaigns, recentCampaigns, totalEmailsSent] =
        await Promise.all([
          prisma.subscriber.count({
            where: { tenantId, status: 'ACTIVE' },
          }),
          prisma.campaign.count({
            where: { tenantId },
          }),
          prisma.campaign.count({
            where: {
              tenantId,
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.campaignAnalytics.aggregate({
            where: {
              campaign: { tenantId },
              createdAt: { gte: thirtyDaysAgo },
            },
            _sum: { totalSent: true },
          }),
        ]);

      const dashboardStats = {
        totalSubscribers,
        totalCampaigns,
        recentCampaigns,
        totalEmailsSent: totalEmailsSent._sum.totalSent || 0,
        lastUpdated: now.toISOString(),
      };

      await cache.set(CacheKeys.dashboardStats(tenantId), dashboardStats, {
        ttl: CacheTTL.ANALYTICS,
      });
    } catch (error) {
      console.error(`Failed to warm dashboard stats for ${tenantId}:`, error);
    }
  }

  /**
   * Warm frequently accessed analytics data
   */
  static async warmAnalyticsData(tenantId: string): Promise<void> {
    try {
      const periods = ['7d', '30d', '90d'];
      const types = ['campaigns', 'subscribers', 'engagement'];

      const warmingPromises = [];

      for (const period of periods) {
        for (const type of types) {
          warmingPromises.push(this.warmAnalyticsForPeriod(tenantId, type, period));
        }
      }

      await Promise.all(warmingPromises);
    } catch (error) {
      console.error(`Failed to warm analytics data for ${tenantId}:`, error);
    }
  }

  /**
   * Warm analytics data for a specific period
   */
  private static async warmAnalyticsForPeriod(
    tenantId: string,
    type: string,
    period: string
  ): Promise<void> {
    try {
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      let analyticsData: any = {};

      switch (type) {
        case 'campaigns':
          analyticsData = await this.getCampaignAnalytics(tenantId, startDate, now);
          break;
        case 'subscribers':
          analyticsData = await this.getSubscriberAnalytics(tenantId, startDate, now);
          break;
        case 'engagement':
          analyticsData = await this.getEngagementAnalytics(tenantId, startDate, now);
          break;
      }

      await cache.set(CacheKeys.analytics(tenantId, type, period), analyticsData, {
        ttl: CacheTTL.ANALYTICS,
      });
    } catch (error) {
      console.error(`Failed to warm analytics for ${tenantId}, ${type}, ${period}:`, error);
    }
  }

  /**
   * Get campaign analytics data
   */
  private static async getCampaignAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { analytics: true },
    });

    return {
      totalCampaigns: campaigns.length,
      totalSent: campaigns.reduce(
        (sum, c) => sum + (c.analytics?.totalSent || c.totalSent || 0),
        0
      ),
      totalOpened: campaigns.reduce(
        (sum, c) => sum + (c.analytics?.totalOpened || c.totalOpened || 0),
        0
      ),
      totalClicked: campaigns.reduce(
        (sum, c) => sum + (c.analytics?.totalClicked || c.totalClicked || 0),
        0
      ),
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        sent: c.analytics?.totalSent || c.totalSent || 0,
        opened: c.analytics?.totalOpened || c.totalOpened || 0,
        clicked: c.analytics?.totalClicked || c.totalClicked || 0,
        createdAt: c.createdAt,
      })),
    };
  }

  /**
   * Get subscriber analytics data
   */
  private static async getSubscriberAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [newSubscribers, unsubscribes, totalActive] = await Promise.all([
      prisma.subscriber.count({
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.subscriber.count({
        where: {
          tenantId,
          status: 'UNSUBSCRIBED',
          updatedAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.subscriber.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
    ]);

    return {
      newSubscribers,
      unsubscribes,
      totalActive,
      netGrowth: newSubscribers - unsubscribes,
    };
  }

  /**
   * Get engagement analytics data
   */
  private static async getEngagementAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const stats = await prisma.campaignAnalytics.aggregate({
      where: {
        campaign: { tenantId },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        totalUnsubscribed: true,
      },
    });

    const sums = stats._sum;
    const sent = sums.totalSent || 0;
    const delivered = sums.totalDelivered || 0;
    const opened = sums.totalOpened || 0;
    const clicked = sums.totalClicked || 0;

    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced: sums.totalBounced || 0,
      complained: sums.totalComplained || 0,
      unsubscribed: sums.totalUnsubscribed || 0,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0,
    };
  }

  /**
   * Schedule cache warming for all active tenants
   */
  static async scheduleWarmingForAllTenants(): Promise<void> {
    try {
      const activeTenants = await prisma.tenant.findMany({
        select: { id: true },
      });

      console.log(`Scheduling cache warming for ${activeTenants.length} active tenants`);

      // Warm tenants in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < activeTenants.length; i += batchSize) {
        const batch = activeTenants.slice(i, i + batchSize);

        await Promise.all(batch.map(tenant => this.warmTenantData(tenant.id)));

        // Small delay between batches
        if (i + batchSize < activeTenants.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('Cache warming completed for all active tenants');
    } catch (error) {
      console.error('Failed to schedule cache warming for all tenants:', error);
    }
  }
}
