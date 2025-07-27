import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export interface FormAnalyticsData {
  formId: string;
  date: Date;
  views: number;
  submissions: number;
  conversionRate: number;
  uniqueVisitors?: number;
  bounceRate?: number;
  averageTimeOnForm?: number;
  deviceBreakdown?: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  locationData?: {
    country: string;
    count: number;
  }[];
}

export interface ConversionFunnelData {
  step: string;
  visitors: number;
  dropoffRate: number;
}

export class FormAnalyticsService {
  /**
   * Track form view with enhanced analytics
   */
  static async trackFormView(
    formId: string,
    data: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
    }
  ) {
    // Update form view count
    await prisma.form.update({
      where: { id: formId },
      data: {
        totalViews: { increment: 1 },
      },
    });

    // Update daily analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.formAnalytics.upsert({
      where: {
        formId_date: {
          formId,
          date: today,
        },
      },
      create: {
        formId,
        date: today,
        views: 1,
        submissions: 0,
        conversionRate: 0,
      },
      update: {
        views: { increment: 1 },
      },
    });

    // Track detailed view event (optional - for advanced analytics)
    if (data.ipAddress || data.userAgent) {
      await this.trackDetailedEvent(formId, 'view', data);
    }
  }

  /**
   * Track form submission with conversion analytics
   */
  static async trackFormSubmission(
    formId: string,
    data: {
      email: string;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
      timeOnForm?: number;
    }
  ) {
    // Update form submission count
    await prisma.form.update({
      where: { id: formId },
      data: {
        totalSubmissions: { increment: 1 },
      },
    });

    // Update daily analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analytics = await prisma.formAnalytics.upsert({
      where: {
        formId_date: {
          formId,
          date: today,
        },
      },
      create: {
        formId,
        date: today,
        views: 0,
        submissions: 1,
        conversionRate: 0,
      },
      update: {
        submissions: { increment: 1 },
      },
    });

    // Calculate and update conversion rate
    if (analytics.views > 0) {
      const conversionRate = (analytics.submissions / analytics.views) * 100;
      await prisma.formAnalytics.update({
        where: {
          formId_date: {
            formId,
            date: today,
          },
        },
        data: {
          conversionRate,
        },
      });
    }

    // Update overall form conversion rate
    await this.updateFormConversionRate(formId);

    // Track detailed submission event
    if (data.ipAddress || data.userAgent) {
      await this.trackDetailedEvent(formId, 'submission', data);
    }
  }

  /**
   * Get form analytics for a date range
   */
  static async getFormAnalytics(
    tenantId: string,
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FormAnalyticsData[]> {
    const analytics = await prisma.formAnalytics.findMany({
      where: {
        formId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        form: { tenantId },
      },
      orderBy: { date: 'asc' },
    });

    return analytics.map(record => ({
      formId: record.formId,
      date: record.date,
      views: record.views,
      submissions: record.submissions,
      conversionRate: record.conversionRate,
    }));
  }

  /**
   * Get conversion funnel data
   */
  static async getConversionFunnel(
    tenantId: string,
    formId: string,
    days: number = 30
  ): Promise<ConversionFunnelData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await prisma.formAnalytics.findMany({
      where: {
        formId,
        date: { gte: startDate },
        form: { tenantId },
      },
    });

    const totalViews = analytics.reduce((sum, record) => sum + record.views, 0);
    const totalSubmissions = analytics.reduce((sum, record) => sum + record.submissions, 0);

    // Simulate funnel steps (in a real implementation, you'd track these separately)
    const funnelData: ConversionFunnelData[] = [
      {
        step: 'Form Views',
        visitors: totalViews,
        dropoffRate: 0,
      },
      {
        step: 'Form Interactions',
        visitors: Math.floor(totalViews * 0.7), // Assume 70% interact
        dropoffRate: 30,
      },
      {
        step: 'Form Submissions',
        visitors: totalSubmissions,
        dropoffRate: totalViews > 0 ? ((totalViews - totalSubmissions) / totalViews) * 100 : 0,
      },
    ];

    return funnelData;
  }

  /**
   * Get form performance comparison
   */
  static async getFormComparison(
    tenantId: string,
    formIds: string[],
    days: number = 30
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await prisma.formAnalytics.findMany({
      where: {
        formId: { in: formIds },
        date: { gte: startDate },
        form: { tenantId },
      },
      include: {
        form: {
          select: {
            id: true,
            name: true,
            formType: true,
          },
        },
      },
    });

    const comparison = formIds.map(formId => {
      const formAnalytics = analytics.filter(a => a.formId === formId);
      const form = formAnalytics[0]?.form;
      
      const totalViews = formAnalytics.reduce((sum, record) => sum + record.views, 0);
      const totalSubmissions = formAnalytics.reduce((sum, record) => sum + record.submissions, 0);
      const avgConversionRate = formAnalytics.length > 0 
        ? formAnalytics.reduce((sum, record) => sum + record.conversionRate, 0) / formAnalytics.length
        : 0;

      return {
        formId,
        name: form?.name || 'Unknown Form',
        formType: form?.formType || 'SUBSCRIPTION',
        totalViews,
        totalSubmissions,
        conversionRate: avgConversionRate,
        performance: totalViews > 0 ? (totalSubmissions / totalViews) * 100 : 0,
      };
    });

    return comparison.sort((a, b) => b.performance - a.performance);
  }

  /**
   * Get top performing forms
   */
  static async getTopPerformingForms(tenantId: string, limit: number = 10) {
    const forms = await prisma.form.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        name: true,
        formType: true,
        totalViews: true,
        totalSubmissions: true,
        conversionRate: true,
        createdAt: true,
      },
      orderBy: [
        { conversionRate: 'desc' },
        { totalSubmissions: 'desc' },
      ],
      take: limit,
    });

    return forms;
  }

  /**
   * Get form insights and recommendations
   */
  static async getFormInsights(tenantId: string, formId: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, tenantId },
      include: {
        analytics: {
          take: 30,
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!form) {
      throw new Error('Form not found');
    }

    const insights = [];
    const recommendations = [];

    // Analyze conversion rate
    if (form.conversionRate < 2) {
      insights.push({
        type: 'warning',
        title: 'Low Conversion Rate',
        description: `Your form has a ${form.conversionRate.toFixed(1)}% conversion rate, which is below average.`,
      });
      
      recommendations.push({
        title: 'Optimize Form Fields',
        description: 'Consider reducing the number of required fields or improving your value proposition.',
        priority: 'high',
      });
    } else if (form.conversionRate > 10) {
      insights.push({
        type: 'success',
        title: 'High Conversion Rate',
        description: `Excellent! Your form has a ${form.conversionRate.toFixed(1)}% conversion rate.`,
      });
    }

    // Analyze traffic trends
    const recentAnalytics = form.analytics.slice(0, 7);
    const olderAnalytics = form.analytics.slice(7, 14);
    
    if (recentAnalytics.length > 0 && olderAnalytics.length > 0) {
      const recentAvgViews = recentAnalytics.reduce((sum, a) => sum + a.views, 0) / recentAnalytics.length;
      const olderAvgViews = olderAnalytics.reduce((sum, a) => sum + a.views, 0) / olderAnalytics.length;
      
      const viewsChange = ((recentAvgViews - olderAvgViews) / olderAvgViews) * 100;
      
      if (viewsChange > 20) {
        insights.push({
          type: 'success',
          title: 'Increasing Traffic',
          description: `Form views have increased by ${viewsChange.toFixed(1)}% in the last week.`,
        });
      } else if (viewsChange < -20) {
        insights.push({
          type: 'warning',
          title: 'Declining Traffic',
          description: `Form views have decreased by ${Math.abs(viewsChange).toFixed(1)}% in the last week.`,
        });
        
        recommendations.push({
          title: 'Review Form Placement',
          description: 'Check if your form is still properly embedded and visible on your website.',
          priority: 'medium',
        });
      }
    }

    // Form type specific recommendations
    if (form.formType === 'POPUP') {
      recommendations.push({
        title: 'Test Popup Timing',
        description: 'Experiment with different trigger timings to optimize user engagement.',
        priority: 'low',
      });
    }

    return {
      insights,
      recommendations,
      summary: {
        totalViews: form.totalViews,
        totalSubmissions: form.totalSubmissions,
        conversionRate: form.conversionRate,
        trend: recentAnalytics.length > 0 ? 'stable' : 'unknown',
      },
    };
  }

  /**
   * Track detailed event for advanced analytics
   */
  private static async trackDetailedEvent(
    formId: string,
    eventType: 'view' | 'submission',
    data: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
      timeOnForm?: number;
    }
  ) {
    // This would typically go to a separate analytics table or external service
    // For now, we'll just log it (in production, you might use a service like Mixpanel, Amplitude, etc.)
    console.log(`Form ${eventType} tracked:`, {
      formId,
      eventType,
      timestamp: new Date(),
      ...data,
    });
  }

  /**
   * Update overall form conversion rate
   */
  private static async updateFormConversionRate(formId: string) {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        totalViews: true,
        totalSubmissions: true,
      },
    });

    if (form && form.totalViews > 0) {
      const conversionRate = (form.totalSubmissions / form.totalViews) * 100;
      
      await prisma.form.update({
        where: { id: formId },
        data: { conversionRate },
      });
    }
  }
}