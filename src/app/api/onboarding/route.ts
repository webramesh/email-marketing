import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserOnboardingService } from '@/services/user-onboarding.service';
import { z } from 'zod';

const startOnboardingSchema = z.object({
  flowType: z.enum(['ADMIN_SETUP', 'CUSTOMER_PACKAGE', 'USER_REGISTRATION']),
});

const updateOnboardingSchema = z.object({
  onboardingId: z.string().min(1, 'Onboarding ID is required'),
  stepData: z.record(z.string(), z.any()),
  moveToNext: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { flowType } = startOnboardingSchema.parse(body);

    const result = await UserOnboardingService.startOnboardingFlow(
      session.user.id,
      session.user.tenantId,
      flowType
    );

    return NextResponse.json({
      success: true,
      onboardingId: result.onboardingId,
      currentStep: result.currentStep,
      totalSteps: result.totalSteps,
    }, { status: 201 });
  } catch (error) {
    console.error('Start onboarding error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to start onboarding flow' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { onboardingId, stepData, moveToNext } = updateOnboardingSchema.parse(body);

    const result = await UserOnboardingService.updateOnboardingStep(
      onboardingId,
      stepData,
      moveToNext
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      currentStep: result.currentStep,
      isCompleted: result.isCompleted,
    });
  } catch (error) {
    console.error('Update onboarding error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update onboarding step' },
      { status: 500 }
    );
  }
}