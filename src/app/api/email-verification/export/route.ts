import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { EmailVerificationService } from '@/services/email-verification.service';
import { VerificationStatus } from '@/types';
import { z } from 'zod';

const prisma = new PrismaClient();
const emailVerificationService = new EmailVerificationService(prisma);

const exportSchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

/**
 * GET /api/email-verification/export
 * Export verification results
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = exportSchema.safeParse({
      status: searchParams.get('status'),
      format: searchParams.get('format'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { status, format } = validation.data;
    const tenantId = session.user.tenantId;

    const exportData = await emailVerificationService.exportVerificationResults(
      tenantId,
      status,
      format
    );

    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `email-verification-results-${Date.now()}.${format}`;

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export verification results error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}