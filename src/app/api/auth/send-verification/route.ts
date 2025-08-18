import { NextRequest, NextResponse } from 'next/server';
import { UserOnboardingService } from '@/services/user-onboarding.service';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const sendVerificationSchema = z.object({
  email: z.string().email('Valid email is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  verificationType: z.enum(['REGISTRATION', 'EMAIL_CHANGE', 'INVITATION']).default('REGISTRATION'),
  userId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, tenantId, verificationType, userId, metadata } = sendVerificationSchema.parse(body);

    // For email changes, require authentication
    if (verificationType === 'EMAIL_CHANGE') {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    const result = await UserOnboardingService.sendEmailVerification(
      email,
      tenantId,
      verificationType,
      userId,
      metadata
    );

    return NextResponse.json({
      success: true,
      expiresAt: result.expiresAt,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Send verification error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}