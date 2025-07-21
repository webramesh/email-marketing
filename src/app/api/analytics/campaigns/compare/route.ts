import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/services/analytics.service';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { campaignIds } = await request.json();

    if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
      return NextResponse.json(
        { error: 'Campaign IDs array is required' },
        { status: 400 }
      );
    }

    const comparison = await AnalyticsService.getCampaignComparison(campaignIds, tenantId);
    
    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Campaign comparison error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign comparison' },
      { status: 500 }
    );
  }
}