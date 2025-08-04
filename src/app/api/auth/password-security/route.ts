import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { PasswordSecurityService } from '@/services/password-security.service';

const passwordValidationSchema = z.object({
  password: z.string().min(1),
  userInfo: z.object({
    email: z.string().email('Invalid email format').optional(),
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }).optional(),
});

const compromisedPasswordSchema = z.object({
  userId: z.string(),
  reason: z.string().optional(),
});

/**
 * GET /api/auth/password-security - Get password security status for current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = await PasswordSecurityService.getPasswordSecurityStatus(session.user.id);

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('Password security status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/password-security - Validate password strength
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = passwordValidationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { password, userInfo } = validation.data;

    // Validate password strength
    const strengthResult = await PasswordSecurityService.validatePasswordStrength(
      password,
      userInfo || {
        email: session.user.email,
        name: session.user.name || undefined,
      },
      session.user.tenantId
    );

    // Check if password has been compromised
    const isCompromised = await PasswordSecurityService.checkPasswordBreach(password);

    // Check password history
    const isReused = await PasswordSecurityService.checkPasswordHistory(session.user.id, password);

    return NextResponse.json({
      success: true,
      strength: strengthResult,
      isCompromised,
      isReused,
    });

  } catch (error) {
    console.error('Password validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/password-security - Mark password as compromised (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = compromisedPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId, reason } = validation.data;

    await PasswordSecurityService.markPasswordAsCompromised(userId, reason);

    return NextResponse.json({
      success: true,
      message: 'Password marked as compromised successfully.',
    });

  } catch (error) {
    console.error('Mark password compromised error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}