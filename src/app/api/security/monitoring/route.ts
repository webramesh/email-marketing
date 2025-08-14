import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SecurityMonitoringService } from '@/services/security-monitoring.service';
import { z } from 'zod';

const securityMonitoringService = SecurityMonitoringService.getInstance();

// Schema for query parameters
const metricsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
});

/**
 * GET /api/security/monitoring
 * Get security monitoring metrics and dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow ADMIN and SUPERADMIN roles to access security monitoring
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to last 7 days if no date range provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Validate date range
    const validation = metricsQuerySchema.safeParse({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid date range', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Get security metrics
    const metrics = await securityMonitoringService.getSecurityMetrics(
      session.user.tenantId,
      { startDate: validation.data.startDate, endDate: validation.data.endDate }
    );

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        dateRange: {
          startDate: validation.data.startDate,
          endDate: validation.data.endDate,
        },
      },
    });
  } catch (error) {
    console.error('Security monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}