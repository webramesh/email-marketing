import { AnalyticsService } from '../analytics.service';
import { prisma } from '@/lib/prisma';
import { EmailEventType } from '@/generated/prisma';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    subscriber: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    emailEvent: {
      findMany: jest.fn(),
    },
  },
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCampaignAnalytics', () => {
    it('should return campaign analytics with calculated rates', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        name: 'Test Campaign',
        totalSent: 1000,
        totalDelivered: 950,
        totalOpened: 400,
        totalClicked: 100,
        totalUnsubscribed: 5,
        totalBounced: 50,
        totalComplained: 2,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const analytics = await AnalyticsService.getCampaignAnalytics(
        'campaign-123',
        'tenant-789'
      );

      expect(analytics).toEqual({
        campaignId: 'campaign-123',
        campaignName: 'Test Campaign',
        totalSent: 1000,
        totalDelivered: 950,
        totalOpened: 400,
        totalClicked: 100,
        totalUnsubscribed: 5,
        totalBounced: 50,
        totalComplained: 2,
        deliveryRate: 95, // 950/1000 * 100
        openRate: 42.11, // 400/950 * 100
        clickRate: 10.53, // 100/950 * 100
        unsubscribeRate: 0.5, // 5/1000 * 100
        bounceRate: 5, // 50/1000 * 100
      });
    });

    it('should handle zero division gracefully', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        name: 'Test Campaign',
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalUnsubscribed: 0,
        totalBounced: 0,
        totalComplained: 0,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const analytics = await AnalyticsService.getCampaignAnalytics(
        'campaign-123',
        'tenant-789'
      );

      expect(analytics.deliveryRate).toBe(0);
      expect(analytics.openRate).toBe(0);
      expect(analytics.clickRate).toBe(0);
      expect(analytics.unsubscribeRate).toBe(0);
      expect(analytics.bounceRate).toBe(0);
    });

    it('should throw error for non-existent campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AnalyticsService.getCampaignAnalytics('non-existent', 'tenant-789')
      ).rejects.toThrow('Campaign not found');
    });
  });

  describe('getEngagementAnalytics', () => {
    it('should return engagement analytics', async () => {
      const mockSubscriberCounts = [1000, 850]; // total, active
      const mockRecentEvents = [
        { subscriberId: 'sub1' },
        { subscriberId: 'sub2' },
        { subscriberId: 'sub3' },
      ];
      const mockCampaigns = [
        {
          id: 'camp1',
          name: 'Campaign 1',
          totalSent: 500,
          totalDelivered: 475,
          totalOpened: 200,
          totalClicked: 50,
          totalUnsubscribed: 2,
          totalBounced: 25,
          totalComplained: 1,
        },
      ];
      const mockRecentActivity = [
        {
          type: EmailEventType.OPENED,
          createdAt: new Date(),
          campaign: { name: 'Test Campaign' },
          subscriber: { email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        },
      ];

      (prisma.subscriber.count as jest.Mock)
        .mockResolvedValueOnce(mockSubscriberCounts[0])
        .mockResolvedValueOnce(mockSubscriberCounts[1]);
      
      (prisma.emailEvent.findMany as jest.Mock)
        .mockResolvedValueOnce(mockRecentEvents)
        .mockResolvedValueOnce(mockRecentActivity);
      
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const analytics = await AnalyticsService.getEngagementAnalytics('tenant-789');

      expect(analytics).toEqual({
        totalSubscribers: 1000,
        activeSubscribers: 850,
        engagementRate: 0.35, // 3/850 * 100
        topPerformingCampaigns: expect.any(Array),
        recentActivity: mockRecentActivity,
      });
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      const mockCounts = [10, 8, 1000, 850]; // totalCampaigns, activeCampaigns, totalSubscribers, activeSubscribers
      const mockRecentEvents = [
        { type: EmailEventType.OPENED, createdAt: new Date() },
        { type: EmailEventType.CLICKED, createdAt: new Date() },
      ];
      const mockCampaignStats = {
        _sum: {
          totalSent: 5000,
          totalDelivered: 4750,
          totalOpened: 2000,
          totalClicked: 500,
          totalUnsubscribed: 25,
          totalBounced: 250,
        },
      };

      (prisma.campaign.count as jest.Mock)
        .mockResolvedValueOnce(mockCounts[0])
        .mockResolvedValueOnce(mockCounts[1]);
      
      (prisma.subscriber.count as jest.Mock)
        .mockResolvedValueOnce(mockCounts[2])
        .mockResolvedValueOnce(mockCounts[3]);
      
      (prisma.emailEvent.findMany as jest.Mock).mockResolvedValue(mockRecentEvents);
      (prisma.campaign.aggregate as jest.Mock).mockResolvedValue(mockCampaignStats);

      const metrics = await AnalyticsService.getDashboardMetrics('tenant-789');

      expect(metrics).toEqual({
        overview: {
          totalCampaigns: 10,
          activeCampaigns: 8,
          totalSubscribers: 1000,
          activeSubscribers: 850,
          totalSent: 5000,
          totalDelivered: 4750,
          totalOpened: 2000,
          totalClicked: 500,
          deliveryRate: 95, // 4750/5000 * 100
          openRate: 42.11, // 2000/4750 * 100
          clickRate: 10.53, // 500/4750 * 100
        },
        timeline: expect.any(Array),
        recentActivity: mockRecentEvents.slice(0, 10),
      });
    });
  });

  describe('getCampaignComparison', () => {
    it('should return comparison data for multiple campaigns', async () => {
      const mockCampaigns = [
        {
          id: 'camp1',
          name: 'Campaign 1',
          totalSent: 1000,
          totalDelivered: 950,
          totalOpened: 400,
          totalClicked: 100,
          totalUnsubscribed: 5,
          totalBounced: 50,
          totalComplained: 2,
          sentAt: new Date(),
        },
        {
          id: 'camp2',
          name: 'Campaign 2',
          totalSent: 1500,
          totalDelivered: 1425,
          totalOpened: 570,
          totalClicked: 142,
          totalUnsubscribed: 7,
          totalBounced: 75,
          totalComplained: 3,
          sentAt: new Date(),
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const comparison = await AnalyticsService.getCampaignComparison(
        ['camp1', 'camp2'],
        'tenant-789'
      );

      expect(comparison).toHaveLength(2);
      expect(comparison[0]).toEqual({
        campaignId: 'camp1',
        campaignName: 'Campaign 1',
        totalSent: 1000,
        totalDelivered: 950,
        totalOpened: 400,
        totalClicked: 100,
        totalUnsubscribed: 5,
        totalBounced: 50,
        totalComplained: 2,
        deliveryRate: 95,
        openRate: 42.11,
        clickRate: 10.53,
        unsubscribeRate: 0.5,
        bounceRate: 5,
      });
    });
  });

  describe('getEnhancedGeographicAnalytics', () => {
    it('should return geographic analytics with country stats', async () => {
      const mockEvents = [
        {
          type: EmailEventType.OPENED,
          location: { country: 'United States', city: 'New York' },
          subscriberId: 'sub1',
        },
        {
          type: EmailEventType.CLICKED,
          location: { country: 'United States', city: 'Los Angeles' },
          subscriberId: 'sub2',
        },
        {
          type: EmailEventType.OPENED,
          location: { country: 'Canada', city: 'Toronto' },
          subscriberId: 'sub3',
        },
      ];

      (prisma.emailEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const analytics = await AnalyticsService.getEnhancedGeographicAnalytics('tenant-789');

      expect(analytics).toHaveLength(2);
      expect(analytics[0]).toEqual({
        country: 'United States',
        opens: 1,
        clicks: 1,
        unsubscribes: 0,
        uniqueSubscribers: 2,
        engagementRate: 100, // (1+1)/(1+1+0) * 100
        topCities: [
          { city: 'New York', count: 1 },
          { city: 'Los Angeles', count: 1 },
        ],
      });
    });
  });
});