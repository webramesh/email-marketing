import { ReportingService, ReportConfig } from '../reporting.service';
import { prisma } from '@/lib/prisma';
import { EmailEventType } from '@/generated/prisma';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: jest.fn(),
    },
    subscriber: {
      findMany: jest.fn(),
    },
    emailEvent: {
      findMany: jest.fn(),
    },
    scheduledReport: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock the AnalyticsService
jest.mock('../analytics.service', () => ({
  AnalyticsService: {
    getEnhancedGeographicAnalytics: jest.fn(),
  },
}));

describe('ReportingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should generate a campaign report', async () => {
      const mockCampaigns = [
        {
          id: 'camp1',
          name: 'Test Campaign',
          subject: 'Test Subject',
          status: 'SENT',
          sentAt: new Date(),
          totalSent: 1000,
          totalDelivered: 950,
          totalOpened: 400,
          totalClicked: 100,
          totalUnsubscribed: 5,
          totalBounced: 50,
          totalComplained: 2,
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const config: ReportConfig = {
        name: 'Campaign Performance Report',
        type: 'campaign',
        filters: {},
        metrics: ['campaignName', 'totalSent', 'openRate', 'clickRate'],
        format: 'json',
      };

      const report = await ReportingService.generateReport(config, 'tenant-123');

      expect(report.metadata.name).toBe('Campaign Performance Report');
      expect(report.metadata.totalRecords).toBe(1);
      expect(report.data).toHaveLength(1);
      expect(report.data[0]).toEqual({
        campaignId: 'camp1',
        campaignName: 'Test Campaign',
        subject: 'Test Subject',
        status: 'SENT',
        sentAt: expect.any(Date),
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
      });
    });

    it('should generate a subscriber report', async () => {
      const mockSubscribers = [
        {
          id: 'sub1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          status: 'ACTIVE',
          createdAt: new Date(),
          customFields: { age: 25 },
          emailEvents: [
            { type: EmailEventType.OPENED, createdAt: new Date(), campaignId: 'camp1' },
            { type: EmailEventType.CLICKED, createdAt: new Date(), campaignId: 'camp1' },
          ],
          lists: [{ list: { name: 'Newsletter' } }],
        },
      ];

      (prisma.subscriber.findMany as jest.Mock).mockResolvedValue(mockSubscribers);

      const config: ReportConfig = {
        name: 'Subscriber Report',
        type: 'subscriber',
        filters: {},
        metrics: ['email', 'firstName', 'opens', 'clicks', 'engagementScore'],
        format: 'json',
      };

      const report = await ReportingService.generateReport(config, 'tenant-123');

      expect(report.data).toHaveLength(1);
      expect(report.data[0]).toEqual({
        subscriberId: 'sub1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        createdAt: expect.any(Date),
        lastActivity: expect.any(Date),
        totalEvents: 2,
        opens: 1,
        clicks: 1,
        unsubscribes: 0,
        bounces: 0,
        complaints: 0,
        engagementScore: 4, // 1 * 1 + 1 * 3 = 4
        lists: ['Newsletter'],
        customFields: { age: 25 },
      });
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const config: ReportConfig = {
        name: 'Filtered Campaign Report',
        type: 'campaign',
        filters: {
          dateRange: { start: startDate, end: endDate },
        },
        metrics: ['campaignName', 'totalSent'],
        format: 'json',
      };

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);

      await ReportingService.generateReport(config, 'tenant-123');

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          sentAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          emailEvents: false,
        },
      });
    });

    it('should apply sorting', async () => {
      const mockCampaigns = [
        { id: '1', name: 'Campaign A', totalSent: 500 },
        { id: '2', name: 'Campaign B', totalSent: 1000 },
        { id: '3', name: 'Campaign C', totalSent: 750 },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(
        mockCampaigns.map(c => ({
          ...c,
          subject: 'Test',
          status: 'SENT',
          sentAt: new Date(),
          totalDelivered: c.totalSent * 0.95,
          totalOpened: c.totalSent * 0.4,
          totalClicked: c.totalSent * 0.1,
          totalUnsubscribed: 5,
          totalBounced: 50,
          totalComplained: 2,
        }))
      );

      const config: ReportConfig = {
        name: 'Sorted Campaign Report',
        type: 'campaign',
        filters: {},
        metrics: ['campaignName', 'totalSent'],
        sortBy: {
          field: 'totalSent',
          direction: 'desc',
        },
        format: 'json',
      };

      const report = await ReportingService.generateReport(config, 'tenant-123');

      expect(report.data[0].totalSent).toBe(1000); // Campaign B
      expect(report.data[1].totalSent).toBe(750); // Campaign C
      expect(report.data[2].totalSent).toBe(500); // Campaign A
    });
  });

  describe('exportReport', () => {
    const mockReportData = {
      metadata: {
        reportId: 'test-report',
        name: 'Test Report',
        generatedAt: new Date(),
        dateRange: { start: new Date(), end: new Date() },
        totalRecords: 2,
      },
      data: [
        { name: 'Campaign 1', opens: 100, clicks: 25 },
        { name: 'Campaign 2', opens: 150, clicks: 30 },
      ],
      summary: {
        totals: { opens: 250, clicks: 55 },
        averages: { opens: 125, clicks: 27.5 },
        trends: {},
      },
    };

    it('should export to JSON format', async () => {
      const result = await ReportingService.exportReport(mockReportData, 'json');

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result as string);
      expect(parsed.metadata.name).toBe('Test Report');
      expect(parsed.data).toHaveLength(2);
    });

    it('should export to CSV format', async () => {
      const result = await ReportingService.exportReport(mockReportData, 'csv');

      expect(typeof result).toBe('string');
      const lines = (result as string).split('\n');
      expect(lines[0]).toBe('name,opens,clicks'); // Header
      expect(lines[1]).toBe('Campaign 1,100,25'); // First row
      expect(lines[2]).toBe('Campaign 2,150,30'); // Second row
    });

    it('should handle CSV with special characters', async () => {
      const dataWithSpecialChars = {
        ...mockReportData,
        data: [{ name: 'Campaign "Special"', description: 'Has, comma', opens: 100 }],
      };

      const result = await ReportingService.exportReport(dataWithSpecialChars, 'csv');

      expect(result).toContain('"Campaign ""Special"""'); // Escaped quotes
      expect(result).toContain('"Has, comma"'); // Quoted comma
    });

    it('should throw error for unsupported format', async () => {
      await expect(ReportingService.exportReport(mockReportData, 'unsupported')).rejects.toThrow(
        'Unsupported export format: unsupported'
      );
    });
  });

  describe('scheduleReport', () => {
    it('should create a scheduled report', async () => {
      const mockScheduledReport = {
        id: 'scheduled-1',
        name: 'Daily Campaign Report',
        tenantId: 'tenant-123',
        isActive: true,
        nextRunAt: new Date(),
      };

      (prisma.scheduledReport.create as jest.Mock).mockResolvedValue(mockScheduledReport);

      const config: ReportConfig = {
        name: 'Daily Campaign Report',
        type: 'campaign',
        filters: {},
        metrics: ['campaignName', 'openRate'],
        format: 'csv',
        schedule: {
          frequency: 'daily',
          time: '09:00',
          recipients: ['admin@example.com'],
          enabled: true,
        },
      };

      const result = await ReportingService.scheduleReport(config, 'tenant-123');

      expect(result).toEqual(mockScheduledReport);
      expect(prisma.scheduledReport.create).toHaveBeenCalledWith({
        data: {
          name: 'Daily Campaign Report',
          description: undefined,
          tenantId: 'tenant-123',
          reportConfig: config,
          schedule: config.schedule,
          isActive: true,
          nextRunAt: expect.any(Date),
        },
      });
    });
  });

  describe('getScheduledReports', () => {
    it('should return scheduled reports for tenant', async () => {
      const mockReports = [
        { id: '1', name: 'Daily Report', isActive: true },
        { id: '2', name: 'Weekly Report', isActive: false },
      ];

      (prisma.scheduledReport.findMany as jest.Mock).mockResolvedValue(mockReports);

      const result = await ReportingService.getScheduledReports('tenant-123');

      expect(result).toEqual(mockReports);
      expect(prisma.scheduledReport.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
