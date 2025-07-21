import { EmailTrackingService } from '../tracking';
import { prisma } from '../prisma';
import { EmailEventType } from '@/generated/prisma';

// Mock the prisma client
jest.mock('../prisma', () => ({
  prisma: {
    emailEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    campaign: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    subscriber: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock the GeoIP service
jest.mock('../geoip', () => ({
  GeoIPService: {
    getLocationData: jest.fn().mockResolvedValue({
      country: 'United States',
      countryCode: 'US',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.0060,
    }),
  },
}));

describe('EmailTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTrackingPixel', () => {
    it('should generate a valid tracking pixel URL', () => {
      const data = {
        campaignId: 'campaign-123',
        subscriberId: 'subscriber-456',
        tenantId: 'tenant-789',
      };

      const pixelUrl = EmailTrackingService.generateTrackingPixel(data);
      
      expect(pixelUrl).toMatch(/^https:\/\/.*\/pixel\/.*\.png$/);
      expect(pixelUrl).toContain('track.example.com');
    });
  });

  describe('generateTrackingLink', () => {
    it('should generate a valid tracking link URL', () => {
      const data = {
        campaignId: 'campaign-123',
        subscriberId: 'subscriber-456',
        tenantId: 'tenant-789',
        originalUrl: 'https://example.com',
        linkId: 'link_1',
      };

      const trackingUrl = EmailTrackingService.generateTrackingLink(data);
      
      expect(trackingUrl).toMatch(/^https:\/\/.*\/click\/.*$/);
      expect(trackingUrl).toContain('track.example.com');
    });
  });

  describe('processEmailContent', () => {
    it('should add tracking pixel and convert links', () => {
      const content = `
        <html>
          <body>
            <p>Hello World!</p>
            <a href="https://example.com">Click here</a>
            <a href="https://another.com">Another link</a>
          </body>
        </html>
      `;

      const processed = EmailTrackingService.processEmailContent(
        content,
        'campaign-123',
        'subscriber-456',
        'tenant-789'
      );

      // Should contain tracking pixel
      expect(processed).toContain('<img src="https://track.example.com/pixel/');
      expect(processed).toContain('width="1" height="1"');
      
      // Should convert links to tracking links
      expect(processed).toContain('https://track.example.com/click/');
      expect(processed).not.toContain('href="https://example.com"');
      expect(processed).not.toContain('href="https://another.com"');
    });

    it('should not convert unsubscribe links', () => {
      const content = `
        <html>
          <body>
            <a href="https://example.com/unsubscribe">Unsubscribe</a>
            <a href="https://example.com">Normal link</a>
          </body>
        </html>
      `;

      const processed = EmailTrackingService.processEmailContent(
        content,
        'campaign-123',
        'subscriber-456',
        'tenant-789'
      );

      // Unsubscribe link should remain unchanged
      expect(processed).toContain('href="https://example.com/unsubscribe"');
      
      // Normal link should be converted
      expect(processed).toContain('https://track.example.com/click/');
    });
  });

  describe('recordEmailEvent', () => {
    it('should record email event with geographic data', async () => {
      const mockSubscriber = {
        email: 'test@example.com',
      };

      (prisma.subscriber.findFirst as jest.Mock).mockResolvedValue(mockSubscriber);
      (prisma.emailEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.campaign.update as jest.Mock).mockResolvedValue({});

      await EmailTrackingService.recordEmailEvent(EmailEventType.OPENED, {
        campaignId: 'campaign-123',
        subscriberId: 'subscriber-456',
        email: '',
        tenantId: 'tenant-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { test: 'data' },
      });

      expect(prisma.emailEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: EmailEventType.OPENED,
          campaignId: 'campaign-123',
          subscriberId: 'subscriber-456',
          email: 'test@example.com',
          tenantId: 'tenant-789',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          location: expect.objectContaining({
            country: 'United States',
            countryCode: 'US',
          }),
          metadata: expect.objectContaining({
            test: 'data',
            timestamp: expect.any(String),
            trackingVersion: '2.0',
          }),
        }),
      });

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-123' },
        data: { totalOpened: { increment: 1 } },
      });
    });

    it('should handle missing subscriber gracefully', async () => {
      (prisma.subscriber.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.emailEvent.create as jest.Mock).mockResolvedValue({});

      await EmailTrackingService.recordEmailEvent(EmailEventType.OPENED, {
        subscriberId: 'non-existent',
        email: '',
        tenantId: 'tenant-789',
      });

      expect(prisma.emailEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'unknown',
        }),
      });
    });
  });

  describe('getCampaignAnalytics', () => {
    it('should return comprehensive campaign analytics', async () => {
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
        emailEvents: [
          { type: EmailEventType.OPENED, createdAt: new Date() },
          { type: EmailEventType.CLICKED, createdAt: new Date() },
        ],
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const analytics = await EmailTrackingService.getCampaignAnalytics(
        'campaign-123',
        'tenant-789'
      );

      expect(analytics).toEqual({
        campaignId: 'campaign-123',
        totalSent: 1000,
        totalDelivered: 950,
        totalOpened: 400,
        totalClicked: 100,
        totalUnsubscribed: 5,
        totalBounced: 50,
        totalComplained: 2,
        openRate: 40, // 400/1000 * 100 (based on totalSent)
        clickRate: 10, // 100/1000 * 100 (based on totalSent)
        unsubscribeRate: 0.5, // 5/1000 * 100
        bounceRate: 5, // 50/1000 * 100
        recentEvents: mockCampaign.emailEvents,
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
        emailEvents: [],
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const analytics = await EmailTrackingService.getCampaignAnalytics(
        'campaign-123',
        'tenant-789'
      );

      expect(analytics.openRate).toBe(0);
      expect(analytics.clickRate).toBe(0);
      expect(analytics.unsubscribeRate).toBe(0);
      expect(analytics.bounceRate).toBe(0);
    });
  });

  describe('getSubscriberAnalytics', () => {
    it('should return subscriber engagement analytics', async () => {
      const mockEvents = [
        { type: EmailEventType.OPENED, createdAt: new Date(), campaign: { id: '1', name: 'Campaign 1', subject: 'Test' } },
        { type: EmailEventType.CLICKED, createdAt: new Date(), campaign: { id: '1', name: 'Campaign 1', subject: 'Test' } },
        { type: EmailEventType.OPENED, createdAt: new Date(), campaign: { id: '2', name: 'Campaign 2', subject: 'Test 2' } },
      ];

      (prisma.emailEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const analytics = await EmailTrackingService.getSubscriberAnalytics(
        'subscriber-456',
        'tenant-789'
      );

      expect(analytics).toEqual({
        subscriberId: 'subscriber-456',
        totalEvents: 3,
        eventCounts: {
          OPENED: 2,
          CLICKED: 1,
        },
        recentEvents: mockEvents.slice(0, 20),
        engagementScore: 5, // (2 * 1) + (1 * 3) = 5
      });
    });
  });

  describe('generateUnsubscribeLink', () => {
    it('should generate a valid unsubscribe link', () => {
      const link = EmailTrackingService.generateUnsubscribeLink(
        'subscriber-456',
        'tenant-789'
      );

      expect(link).toMatch(/^https:\/\/.*\/unsubscribe\/.*$/);
      expect(link).toContain('track.example.com');
    });
  });

  describe('decryptTrackingData', () => {
    it('should decrypt data that was encrypted', () => {
      const originalData = {
        campaignId: 'campaign-123',
        subscriberId: 'subscriber-456',
        tenantId: 'tenant-789',
      };

      // Use the private method through a public method that uses it
      const pixelUrl = EmailTrackingService.generateTrackingPixel(originalData);
      const token = pixelUrl.split('/pixel/')[1].replace('.png', '');
      
      const decryptedData = EmailTrackingService.decryptTrackingData(token);

      expect(decryptedData).toEqual(originalData);
    });

    it('should return null for invalid tokens', () => {
      const result = EmailTrackingService.decryptTrackingData('invalid-token');
      expect(result).toBeNull();
    });
  });
});