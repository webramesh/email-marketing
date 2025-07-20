import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { EmailVerificationService } from '@/services/email-verification.service';
import { VerificationStatus } from '@/types';
import { z } from 'zod';

const prisma = new PrismaClient();
const emailVerificationService = new EmailVerificationService(prisma);

const getResultsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.nativeEnum(VerificationStatus).optional(),
});

/**
 * GET /api/email-verification/results
 * Get paginated verification results
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = getResultsSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { page, limit, status } = validation.data;
    const tenantId = session.user.tenantId;

    const results = await emailVerificationService.getVerificationResults(
      tenantId,
      page,
      limit,
      status
    );

    return NextResponse.json({
      success: true,
      data: results.data,
      meta: results.meta,
    });

  } catch (error) {
    console.error('Get verification results error:', error);
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

