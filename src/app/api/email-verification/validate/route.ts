import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { EmailVerificationService } from '@/services/email-verification.service';
import { z } from 'zod';

const prisma = new PrismaClient();
const emailVerificationService = new EmailVerificationService(prisma);

const validateEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
  useCache: z.boolean().optional().default(true),
});

/**
 * POST /api/email-verification/validate
 * Validate a single email address in real-time
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = validateEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { email, useCache } = validation.data;
    const tenantId = session.user.tenantId;

    // Validate the email
    const result = await emailVerificationService.validateEmail(email, tenantId, useCache);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Email validation error:', error);
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

/**
 * GET /api/email-verification/validate?email=test@example.com
 * Get validation result for a single email (from cache/database)
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
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId;

    // Get existing verification result
    const result = await emailVerificationService.getVerificationResult(email, tenantId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Email not found in verification database' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Get verification result error:', error);
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