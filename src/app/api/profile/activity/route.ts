import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserProfileService } from '@/services/user-profile.service';

/**
 * GET /api/profile/activity - Get user activity history
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'timeline'; // timeline, profile, login
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let result;

    switch (type) {
      case 'profile':
        result = await UserProfileService.getProfileHistory(
          session.user.id,
          limit,
          offset
        );
        return NextResponse.json({
          success: true,
          type: 'profile_history',
          data: result.history,
          total: result.total,
          limit,
          offset,
        });

      case 'login':
        result = await UserProfileService.getLoginHistory(
          session.user.id,
          limit,
          offset
        );
        return NextResponse.json({
          success: true,
          type: 'login_history',
          data: result.history,
          total: result.total,
          limit,
          offset,
        });

      case 'timeline':
      default:
        result = await UserProfileService.getActivityTimeline(
          session.user.id,
          limit,
          offset
        );
        return NextResponse.json({
          success: true,
          type: 'activity_timeline',
          data: result.activities,
          total: result.total,
          limit,
          offset,
        });
    }
  } catch (error) {
    console.error('Error getting activity history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}