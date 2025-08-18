import { NextRequest, NextResponse } from 'next/server';
import { UserOnboardingService } from '@/services/user-onboarding.service';
import { z } from 'zod';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, tenantId } = verifyEmailSchema.parse(body);

    const result = await UserOnboardingService.verifyEmail(token, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      email: result.email,
      verificationType: result.verificationType,
    });
  } catch (error) {
    console.error('Email verification error:', error);
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