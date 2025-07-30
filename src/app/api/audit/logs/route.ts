import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  SecurityAuditService,
  AuditAction,
  SecurityRiskLevel,
} from '@/services/security-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';

const auditService = SecurityAuditService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role for audit log access
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = session.user.tenantId;

    // Parse query parameters
    const userId = searchParams.get('userId') || undefined;
    const action = (searchParams.get('action') as AuditAction) || undefined;
    const resource = searchParams.get('resource') || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const riskLevel = (searchParams.get('riskLevel') as SecurityRiskLevel) || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get audit trail
    const auditTrail = await auditService.getAuditTrail({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      riskLevel,
      startDate,
      endDate,
      limit,
      offset,
    });

    // Log the audit log access
    const context = await AuditMiddleware.extractAuditContext(request);
    await AuditMiddleware.logDataAccess(
      AuditAction.DATA_ACCESSED,
      'audit_logs',
      'audit_trail_query',
      context,
      undefined,
      {
        queryParams: {
          userId,
          action,
          resource,
          resourceId,
          riskLevel,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          limit,
          offset,
        },
        resultCount: auditTrail.entries.length,
      }
    );

    return NextResponse.json({
      success: true,
      data: auditTrail,
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, resource, resourceId, changes, metadata, riskLevel } = body;

    // Validate required fields
    if (!action || !resource) {
      return NextResponse.json({ error: 'Action and resource are required' }, { status: 400 });
    }

    // Create audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Log the audit event
    const auditId = await auditService.logAuditEvent({
      tenantId: context.tenantId,
      userId: session.user.id,
      action: action as AuditAction,
      resource,
      resourceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      changes,
      metadata,
      riskLevel: (riskLevel as SecurityRiskLevel) || SecurityRiskLevel.LOW,
      sessionId: context.sessionId,
      correlationId: context.correlationId,
    });

    return NextResponse.json({
      success: true,
      data: { auditId },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
