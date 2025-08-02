import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserProfileService } from '@/services/user-profile.service';
import { z } from 'zod';

// Validation schemas
const profileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  bio: z.string().max(1000).optional(),
  phoneNumber: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  emailNotifications: z.object({
    campaigns: z.boolean(),
    system: z.boolean(),
    security: z.boolean(),
  }).optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const accountActionSchema = z.object({
  action: z.enum(['deactivate', 'reactivate']),
  reason: z.string().optional(),
});

/**
 * GET /api/profile - Get user profile
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

    const profile = await UserProfileService.getUserProfile(session.user.id);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Remove sensitive data
    const { password, mfaSecret, mfaBackupCodes, ...safeProfile } = profile;

    return NextResponse.json({
      success: true,
      profile: safeProfile,
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile - Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = profileUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const context = {
      userId: session.user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    };

    const result = await UserProfileService.updateProfile(
      session.user.id,
      validation.data,
      context
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Remove sensitive data
    const { password, mfaSecret, mfaBackupCodes, ...safeUser } = result.user!;

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: safeUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile - Handle profile actions (password change, account deactivation)
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
    const { action } = body;

    const context = {
      userId: session.user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    };

    switch (action) {
      case 'change_password': {
        const validation = passwordChangeSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { 
              error: 'Invalid input',
              details: validation.error.issues,
            },
            { status: 400 }
          );
        }

        const result = await UserProfileService.changePassword(
          session.user.id,
          validation.data.currentPassword,
          validation.data.newPassword,
          context
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully',
        });
      }

      case 'deactivate':
      case 'reactivate': {
        const validation = accountActionSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { 
              error: 'Invalid input',
              details: validation.error.issues,
            },
            { status: 400 }
          );
        }

        let result;
        if (action === 'deactivate') {
          result = await UserProfileService.deactivateAccount(
            session.user.id,
            validation.data.reason || 'User requested deactivation',
            context
          );
        } else {
          result = await UserProfileService.reactivateAccount(
            session.user.id,
            context
          );
        }

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Account ${action}d successfully`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling profile action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}