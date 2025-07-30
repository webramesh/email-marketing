import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SecurityAuditService, AuditAction } from '@/services/security-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';

const auditService = SecurityAuditService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role for security metrics access
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = session.user.tenantId;

    // Parse time range parameters
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const period = searchParams.get('period') || '7d'; // Default to 7 days

    let startDate: Date;
    let endDate: Date = new Date();

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      // Calculate date range based on period
      const now = new Date();
      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
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
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Get security metrics
    const metrics = await auditService.getSecurityMetrics(tenantId, {
      startDate,
      endDate,
    });

    // Log the security metrics access
    const context = await AuditMiddleware.extractAuditContext(request);
    await AuditMiddleware.logDataAccess(
      AuditAction.DATA_ACCESSED,
      'security_metrics',
      'security_dashboard',
      context,
      undefined,
      {
        timeRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          period,
        },
        metricsRequested: Object.keys(metrics),
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        ...metrics,
        timeRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          period,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get security metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { eventType, severity, description, metadata } = body;

    // Validate required fields
    if (!eventType || !severity || !description) {
      return NextResponse.json(
        { error: 'Event type, severity, and description are required' },
        { status: 400 }
      );
    }

    // Create audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Log the security event
    await auditService.logSecurityEvent({
      tenantId: context.tenantId,
      userId: session.user.id,
      eventType,
      severity,
      description,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata,
      correlationId: context.correlationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Security event logged successfully',
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
