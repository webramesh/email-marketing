import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for audit log creation
const auditLogSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  oldValues: z.record(z.string(), z.any()).optional(),
  newValues: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schema for audit trail query
const auditTrailQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const context = await AuditMiddleware.extractAuditContext(request);
    const body = await request.json();

    // Validate request body
    const validatedData = auditLogSchema.parse(body);

    // Log user action
    const auditId = await complianceService.logUserAction({
      tenantId: context.tenantId,
      userId: session.user.id,
      action: validatedData.action,
      resource: validatedData.resource,
      resourceId: validatedData.resourceId,
      oldValues: validatedData.oldValues,
      newValues: validatedData.newValues,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      metadata: validatedData.metadata,
    });

    return NextResponse.json({
      success: true,
      auditId,
      message: 'User action logged successfully',
    });
  } catch (error) {
    console.error('Failed to log user action:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const context = await AuditMiddleware.extractAuditContext(request);
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const queryData = {
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      resource: searchParams.get('resource') || undefined,
      resourceId: searchParams.get('resourceId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      riskLevel: searchParams.get('riskLevel') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    // Validate query parameters
    const validatedQuery = auditTrailQuerySchema.parse(queryData);

    // Get audit trail
    const auditTrail = await complianceService.getAuditTrail({
      tenantId: context.tenantId,
      ...validatedQuery,
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
    });

    // Log audit trail access
    await complianceService.logUserAction({
      tenantId: context.tenantId,
      userId: session.user.id,
      action: 'AUDIT_TRAIL_ACCESSED',
      resource: 'audit_trail',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      metadata: {
        queryParams: validatedQuery,
        resultCount: auditTrail.entries.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: auditTrail,
    });
  } catch (error) {
    console.error('Failed to get audit trail:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}