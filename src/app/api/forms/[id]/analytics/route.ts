import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormAnalyticsService } from '@/services/form-analytics.service';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  type: z.enum(['overview', 'funnel', 'insights', 'comparison']).default('overview'),
});

/**
 * GET /api/forms/[id]/analytics - Get form analytics data
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      days: searchParams.get('days'),
      type: searchParams.get('type'),
    });

    const formId = params.id;
    const tenantId = session.user.tenantId;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - query.days);

    let data;

    switch (query.type) {
      case 'overview':
        data = await FormAnalyticsService.getFormAnalytics(tenantId, formId, startDate, endDate);
        break;

      case 'funnel':
        data = await FormAnalyticsService.getConversionFunnel(tenantId, formId, query.days);
        break;

      case 'insights':
        data = await FormAnalyticsService.getFormInsights(tenantId, formId);
        break;

      case 'comparison':
        // For comparison, we'll get top performing forms
        data = await FormAnalyticsService.getTopPerformingForms(tenantId, 10);
        break;

      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching form analytics:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

/**
 * POST /api/forms/[id]/analytics - Track form events
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formId = params.id;
    const body = await request.json();

    const eventSchema = z.object({
      event: z.enum(['view', 'submission']),
      data: z
        .object({
          email: z.string().email().optional(),
          ipAddress: z.string().optional(),
          userAgent: z.string().optional(),
          referrer: z.string().optional(),
          sessionId: z.string().optional(),
          timeOnForm: z.number().optional(),
        })
        .optional(),
    });

    const { event, data = {} } = eventSchema.parse(body);

    if (event === 'view') {
      await FormAnalyticsService.trackFormView(formId, data);
    } else if (event === 'submission') {
      if (!data.email) {
        return NextResponse.json(
          { error: 'Email is required for submission events' },
          { status: 400 }
        );
      }
      await FormAnalyticsService.trackFormSubmission(formId, data as any);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking form event:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
