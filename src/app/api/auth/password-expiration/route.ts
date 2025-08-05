import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PasswordSecurityService } from '@/services/password-security.service';

/**
 * POST /api/auth/password-expiration - Schedule password expiration notifications (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await PasswordSecurityService.schedulePasswordExpirationNotifications();

    return NextResponse.json({
      success: true,
      message: 'Password expiration notifications scheduled successfully.',
    });

  } catch (error) {
    console.error('Password expiration notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}