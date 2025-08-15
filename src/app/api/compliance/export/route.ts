import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for data export request
const exportRequestSchema = z.object({
  userId: z.string().min(1),
  format: z.enum(['JSON', 'CSV']).optional().default('JSON'),
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
    const validatedData = exportRequestSchema.parse(body);

    // Check if user has permission to export data
    // For now, only allow users to export their own data or admins to export any data
    if (validatedData.userId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: You can only export your own data' },
        { status: 403 }
      );
    }

    // Export user data
    const exportResult = await complianceService.exportUserData(
      context.tenantId,
      validatedData.userId,
      session.user.id,
      validatedData.format
    );

    return NextResponse.json({
      success: true,
      data: exportResult,
      message: 'User data export initiated successfully',
    });
  } catch (error) {
    console.error('Failed to export user data:', error);

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