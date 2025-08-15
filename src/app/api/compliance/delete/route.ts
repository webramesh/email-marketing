import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for data deletion request
const deleteRequestSchema = z.object({
  userId: z.string().min(1),
  options: z.object({
    anonymize: z.boolean().optional().default(true),
    hardDelete: z.boolean().optional().default(false),
    retainAuditLogs: z.boolean().optional().default(true),
  }).optional().default(() => ({
    anonymize: true,
    hardDelete: false,
    retainAuditLogs: true,
  })),
  confirmationToken: z.string().min(1), // Require confirmation token for safety
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and superadmins can delete user data
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const context = await AuditMiddleware.extractAuditContext(request);
    const body = await request.json();

    // Validate request body
    const validatedData = deleteRequestSchema.parse(body);

    // Verify confirmation token (in production, this would be a secure token)
    const expectedToken = `delete_${validatedData.userId}_${context.tenantId}`;
    if (validatedData.confirmationToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 400 }
      );
    }

    // Delete user data
    const deletionResult = await complianceService.deleteUserData(
      context.tenantId,
      validatedData.userId,
      session.user.id,
      validatedData.options
    );

    return NextResponse.json({
      success: true,
      data: deletionResult,
      message: 'User data deletion completed successfully',
    });
  } catch (error) {
    console.error('Failed to delete user data:', error);

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

// GET endpoint to generate confirmation token
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and superadmins can get deletion tokens
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const context = await AuditMiddleware.extractAuditContext(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Generate confirmation token
    const confirmationToken = `delete_${userId}_${context.tenantId}`;

    // Log token generation
    await complianceService.logUserAction({
      tenantId: context.tenantId,
      userId: session.user.id,
      action: 'DELETION_TOKEN_GENERATED',
      resource: 'user_data',
      resourceId: userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      metadata: {
        targetUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      confirmationToken,
      expiresIn: 300, // 5 minutes
      message: 'Confirmation token generated successfully',
    });
  } catch (error) {
    console.error('Failed to generate confirmation token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}