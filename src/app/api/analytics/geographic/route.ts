import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/services/analytics.service';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    
    // Parse time range if provided
    let timeRange;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const geographicAnalytics = await AnalyticsService.getEnhancedGeographicAnalytics(
      tenantId,
      timeRange
    );
    
    return NextResponse.json(geographicAnalytics);
  } catch (error) {
    console.error('Geographic analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch geographic analytics' },
      { status: 500 }
    );
  }
}