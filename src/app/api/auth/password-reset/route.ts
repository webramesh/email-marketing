import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PasswordSecurityService } from '@/services/password-security.service';
import { UserService } from '@/services/user.service';
import { PasswordResetMethod } from '@/generated/prisma';

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  method: z.enum(['EMAIL', 'SMS', 'SECURITY_QUESTIONS', 'BACKUP_EMAIL']),
  tenantId: z.string().optional(),
});

const passwordResetVerifySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * POST /api/auth/password-reset - Request password reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = passwordResetRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, method, tenantId } = validation.data;

    // Find user by email
    let user;
    if (tenantId) {
      user = await UserService.findUserByEmailAndTenant(email, tenantId);
    } else {
      const users = await UserService.findUserByEmail(email);
      user = users.length > 0 ? users[0] : null;
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive password reset instructions.',
      });
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create password reset token
    const result = await PasswordSecurityService.createPasswordResetToken({
      userId: user.id,
      method: method as PasswordResetMethod,
      verificationData: { email },
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // In a real application, you would send the token via email/SMS
    // For now, we'll return it in the response (only for development)
    const isDevelopment = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      message: 'Password reset instructions have been sent.',
      ...(isDevelopment && { token: result.token }), // Only in development
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/password-reset - Verify token and reset password
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = passwordResetVerifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { token, newPassword } = validation.data;

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Reset password with token
    const result = await PasswordSecurityService.resetPasswordWithToken({
      token,
      newPassword,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, warnings: result.warnings },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
      warnings: result.warnings,
    });

  } catch (error) {
    console.error('Password reset verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}