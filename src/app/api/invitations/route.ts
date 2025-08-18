import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserOnboardingService } from '@/services/user-onboarding.service';
import { z } from 'zod';
import { UserRole } from '@/generated/prisma';

const createInvitationSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.nativeEnum(UserRole),
  packageId: z.string().optional(),
  customMessage: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

    // Only ADMIN and SUPERADMIN can create invitations
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, packageId, customMessage, expiresAt } = createInvitationSchema.parse(body);

    const result = await UserOnboardingService.createUserInvitation({
      email,
      role,
      tenantId: session.user.tenantId,
      invitedBy: session.user.id,
      packageId,
      customMessage,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({
      success: true,
      invitationId: result.invitationId,
      expiresAt: result.expiresAt,
      message: 'Invitation sent successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Create invitation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, firstName, lastName, password } = acceptInvitationSchema.parse(body);

    const result = await UserOnboardingService.acceptInvitation(token, {
      name,
      firstName,
      lastName,
      password,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      tenantId: result.tenantId,
      packageId: result.packageId,
      message: 'Invitation accepted successfully',
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}