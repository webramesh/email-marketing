import { prisma } from '@/lib/prisma';
import { EmailEventType } from '@/generated/prisma';
import { AnalyticsService } from './analytics.service';

export interface ReportConfig {
  id?: string;
  name: string;
  description?: string;
  type: 'campaign' | 'subscriber' | 'engagement' | 'geographic' | 'custom';
  filters: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    campaignIds?: string[];
    subscriberSegments?: string[];
    eventTypes?: EmailEventType[];
    countries?: string[];
    customFilters?: Record<string, any>;
  };
  metrics: string[];
  groupBy?: string[];
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  format: 'json' | 'csv' | 'pdf' | 'excel';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:MM format
    recipients: string[];
    enabled: boolean;
  };
}

export interface ReportData {
  metadata: {
    reportId: string;
    name: string;
    generatedAt: Date;
    dateRange: {
      start: Date;
      end: Date;
    };
    totalRecords: number;
  };
  data: any[];
  summary?: {
    totals: Record<string, number>;
    averages: Record<string, number>;
    trends: Record<string, number>;
  };
}

export class ReportingService {
  /**
   * Generate a custom report based on configuration
   */
  static async generateReport(config: ReportConfig, tenantId: string): Promise<ReportData> {
    const reportId = config.id || `report_${Date.now()}`;
    const generatedAt = new Date();

    let data: any[] = [];
    let summary: any = {};

    switch (config.type) {
      case 'campaign':
        data = await this.generateCampaignReport(config, tenantId);
        break;
      case 'subscriber':
        data = await this.generateSubscriberReport(config, tenantId);
        break;
      case 'engagement':
        data = await this.generateEngagementReport(config, tenantId);
        break;
      case 'geographic':
        data = await this.generateGeographicReport(config, tenantId);
        break;
      case 'custom':
        data = await this.generateCustomReport(config, tenantId);
        break;
      default:
        throw new Error(`Unsupported report type: ${config.type}`);
    }

    // Apply sorting
    if (config.sortBy) {
      data.sort((a, b) => {
        const aVal = a[config.sortBy!.field];
        const bVal = b[config.sortBy!.field];
        const direction = config.sortBy!.direction === 'asc' ? 1 : -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * direction;
        }
        return String(aVal).localeCompare(String(bVal)) * direction;
      });
    }

    // Generate summary statistics
    summary = this.generateSummary(data, config.metrics);

    return {
      metadata: {
        reportId,
        name: config.name,
        generatedAt,
        dateRange: config.filters.dateRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        totalRecords: data.length,
      },
      data,
      summary,
    };
  }

  /**
   * Generate campaign performance report
   */
  private static async generateCampaignReport(config: ReportConfig, tenantId: string) {
    const whereClause: any = { tenantId };

    // Apply filters
    if (config.filters.campaignIds?.length) {
      whereClause.id = { in: config.filters.campaignIds };
    }

    if (config.filters.dateRange) {
      whereClause.sentAt = {
        gte: config.filters.dateRange.start,
        lte: config.filters.dateRange.end,
      };
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        emailEvents: config.metrics.includes('events')
          ? {
              select: {
                type: true,
                createdAt: true,
                location: true,
              },
            }
          : false,
      },
    });

    return campaigns.map(campaign => {
      const deliveryRate =
        campaign.totalSent > 0 ? (campaign.totalDelivered / campaign.totalSent) * 100 : 0;

      const openRate =
        campaign.totalDelivered > 0 ? (campaign.totalOpened / campaign.totalDelivered) * 100 : 0;

      const clickRate =
        campaign.totalDelivered > 0 ? (campaign.totalClicked / campaign.totalDelivered) * 100 : 0;

      const baseData: any = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt,
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
      };

      // Add event details if requested
      if (config.metrics.includes('events') && campaign.emailEvents) {
        baseData.events = campaign.emailEvents;
      }

      return baseData;
    });
  }

  /**
   * Generate subscriber engagement report
   */
  private static async generateSubscriberReport(config: ReportConfig, tenantId: string) {
    const whereClause: any = { tenantId };

    if (config.filters.subscriberSegments?.length) {
      // This would need segment logic implementation
      // For now, we'll skip this filter
    }

    const subscribers = await prisma.subscriber.findMany({
      where: whereClause,
      include: {
        emailEvents: {
          where: config.filters.dateRange
            ? {
                createdAt: {
                  gte: config.filters.dateRange.start,
                  lte: config.filters.dateRange.end,
                },
              }
            : undefined,
          select: {
            type: true,
            createdAt: true,
            campaignId: true,
          },
        },
        lists: {
          include: {
            list: {
              select: { name: true },
            },
          },
        },
      },
    });

    return subscribers.map(subscriber => {
      const eventCounts = subscriber.emailEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const engagementScore = this.calculateEngagementScore(eventCounts);
      const lastActivity =
        subscriber.emailEvents.length > 0
          ? Math.max(...subscriber.emailEvents.map(e => e.createdAt.getTime()))
          : null;

      return {
        subscriberId: subscriber.id,
        email: subscriber.email,
        firstName: subscriber.firstName,
        lastName: subscriber.lastName,
        status: subscriber.status,
        createdAt: subscriber.createdAt,
        lastActivity: lastActivity ? new Date(lastActivity) : null,
        totalEvents: subscriber.emailEvents.length,
        opens: eventCounts.OPENED || 0,
        clicks: eventCounts.CLICKED || 0,
        unsubscribes: eventCounts.UNSUBSCRIBED || 0,
        bounces: eventCounts.BOUNCED || 0,
        complaints: eventCounts.COMPLAINED || 0,
        engagementScore,
        lists: subscriber.lists.map(l => l.list.name),
        customFields: subscriber.customFields,
      };
    });
  }

  /**
   * Generate engagement timeline report
   */
  private static async generateEngagementReport(config: ReportConfig, tenantId: string) {
    const whereClause: any = { tenantId };

    if (config.filters.dateRange) {
      whereClause.createdAt = {
        gte: config.filters.dateRange.start,
        lte: config.filters.dateRange.end,
      };
    }

    if (config.filters.eventTypes?.length) {
      whereClause.type = { in: config.filters.eventTypes };
    }

    if (config.filters.campaignIds?.length) {
      whereClause.campaignId = { in: config.filters.campaignIds };
    }

    const events = await prisma.emailEvent.findMany({
      where: whereClause,
      include: {
        campaign: {
          select: { name: true, subject: true },
        },
        subscriber: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by time period if specified
    if (config.groupBy?.includes('hour')) {
      return this.groupEventsByHour(events);
    } else if (config.groupBy?.includes('day')) {
      return this.groupEventsByDay(events);
    } else if (config.groupBy?.includes('week')) {
      return this.groupEventsByWeek(events);
    }

    return events.map(event => ({
      eventId: event.id,
      type: event.type,
      createdAt: event.createdAt,
      campaignId: event.campaignId,
      campaignName: event.campaign?.name,
      campaignSubject: event.campaign?.subject,
      subscriberId: event.subscriberId,
      subscriberEmail: event.subscriber?.email,
      subscriberName: event.subscriber
        ? `${event.subscriber.firstName || ''} ${event.subscriber.lastName || ''}`.trim()
        : null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      location: event.location,
      metadata: event.metadata,
    }));
  }

  /**
   * Generate geographic performance report
   */
  private static async generateGeographicReport(config: ReportConfig, tenantId: string) {
    const analytics = await AnalyticsService.getEnhancedGeographicAnalytics(
      tenantId,
      config.filters.dateRange
    );

    let filteredAnalytics = analytics;

    if (config.filters.countries?.length) {
      filteredAnalytics = analytics.filter(item =>
        config.filters.countries!.includes(item.country)
      );
    }

    return filteredAnalytics;
  }

  /**
   * Generate custom report with flexible queries
   */
  private static async generateCustomReport(_config: ReportConfig, tenantId: string) {
    // This would implement custom query building based on config.filters.customFilters
    // For now, return a basic implementation
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        totalSent: true,
        totalOpened: true,
        totalClicked: true,
      },
    });

    return campaigns;
  }

  /**
   * Export report data to different formats
   */
  static async exportReport(reportData: ReportData, format: string): Promise<Buffer | string> {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(reportData, null, 2);

      case 'csv':
        return this.exportToCSV(reportData);

      case 'pdf':
        return await this.exportToPDF(reportData);

      case 'excel':
        return await this.exportToExcel(reportData);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private static exportToCSV(reportData: ReportData): string {
    if (reportData.data.length === 0) {
      return 'No data available';
    }

    const headers = Object.keys(reportData.data[0]);
    const csvRows = [headers.join(',')];

    reportData.data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"') || value.includes('\n'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Export to PDF format (placeholder - would need PDF library)
   */
  private static async exportToPDF(reportData: ReportData): Promise<Buffer> {
    // This would use a PDF library like puppeteer or jsPDF
    // For now, return a placeholder
    const content = `
      Report: ${reportData.metadata.name}
      Generated: ${reportData.metadata.generatedAt}
      Records: ${reportData.metadata.totalRecords}
      
      Data:
      ${JSON.stringify(reportData.data, null, 2)}
    `;

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Export to Excel format (placeholder - would need Excel library)
   */
  private static async exportToExcel(reportData: ReportData): Promise<Buffer> {
    // This would use a library like exceljs
    // For now, return CSV as buffer
    const csvContent = this.exportToCSV(reportData);
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Schedule a report for automatic generation
   */
  static async scheduleReport(config: ReportConfig, tenantId: string) {
    // This would integrate with a job scheduler like Bull Queue
    // For now, just store the configuration

    const scheduledReport = await prisma.scheduledReport.create({
      data: {
        name: config.name,
        description: config.description,
        tenantId,
        reportConfig: config as any,
        schedule: config.schedule as any,
        isActive: config.schedule?.enabled || false,
        nextRunAt: this.calculateNextRunTime(config.schedule!),
      },
    });

    return scheduledReport;
  }

  /**
   * Get scheduled reports for a tenant
   */
  static async getScheduledReports(tenantId: string) {
    return await prisma.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Helper methods
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

  private static groupEventsByHour(events: any[]) {
    const grouped: Record<string, any> = {};

    events.forEach(event => {
      const hour = event.createdAt.toISOString().slice(0, 13) + ':00:00.000Z';
      if (!grouped[hour]) {
        grouped[hour] = {
          timestamp: hour,
          events: [],
          counts: {},
        };
      }
      grouped[hour].events.push(event);
      grouped[hour].counts[event.type] = (grouped[hour].counts[event.type] || 0) + 1;
    });

    return Object.values(grouped);
  }

  private static groupEventsByDay(events: any[]) {
    const grouped: Record<string, any> = {};

    events.forEach(event => {
      const day = event.createdAt.toISOString().slice(0, 10);
      if (!grouped[day]) {
        grouped[day] = {
          date: day,
          events: [],
          counts: {},
        };
      }
      grouped[day].events.push(event);
      grouped[day].counts[event.type] = (grouped[day].counts[event.type] || 0) + 1;
    });

    return Object.values(grouped);
  }

  private static groupEventsByWeek(events: any[]) {
    const grouped: Record<string, any> = {};

    events.forEach(event => {
      const date = new Date(event.createdAt);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().slice(0, 10);

      if (!grouped[weekKey]) {
        grouped[weekKey] = {
          weekStart: weekKey,
          events: [],
          counts: {},
        };
      }
      grouped[weekKey].events.push(event);
      grouped[weekKey].counts[event.type] = (grouped[weekKey].counts[event.type] || 0) + 1;
    });

    return Object.values(grouped);
  }

  private static generateSummary(data: any[], metrics: string[]) {
    if (data.length === 0) return {};

    const summary: any = {
      totals: {},
      averages: {},
      trends: {},
    };

    // Calculate totals and averages for numeric fields
    const numericFields = metrics.filter(metric => {
      const sampleValue = data[0][metric];
      return typeof sampleValue === 'number';
    });

    numericFields.forEach(field => {
      const values = data.map(item => item[field] || 0);
      summary.totals[field] = values.reduce((sum, val) => sum + val, 0);
      summary.averages[field] = summary.totals[field] / values.length;
    });

    return summary;
  }

  private static calculateNextRunTime(schedule: NonNullable<ReportConfig['schedule']>): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        const targetDay = schedule.dayOfWeek || 0;
        const currentDay = nextRun.getDay();
        let daysUntilTarget = targetDay - currentDay;

        if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          daysUntilTarget += 7;
        }

        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;

      case 'monthly':
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);

        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
    }

    return nextRun;
  }
}
