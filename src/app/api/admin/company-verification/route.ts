import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserOnboardingService } from '@/services/user-onboarding.service';
import { z } from 'zod';

const submitVerificationSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  contactEmail: z.string().email('Valid contact email is required'),
  contactPhone: z.string().optional(),
  businessAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  businessDocuments: z.array(z.string()).optional(),
  verificationNotes: z.string().optional(),
});

const processVerificationSchema = z.object({
  verificationId: z.string().min(1, 'Verification ID is required'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
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

    // Only ADMIN can submit verification requests
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admin companies can submit verification requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = submitVerificationSchema.parse(body);

    const result = await UserOnboardingService.submitAdminCompanyVerification({
      ...data,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({
      success: true,
      verificationId: result.verificationId,
      message: 'Verification request submitted successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Submit verification error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to submit verification request' },
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

    // Only SUPERADMIN can process verification requests
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only superadmins can process verification requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { verificationId, decision, reviewNotes } = processVerificationSchema.parse(body);

    const result = await UserOnboardingService.processAdminCompanyVerification(
      verificationId,
      decision,
      session.user.id,
      reviewNotes
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification request ${decision.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Process verification error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process verification request' },
      { status: 500 }
    );
  }
}