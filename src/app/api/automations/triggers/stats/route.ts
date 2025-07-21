import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { triggerService } from '@/services/trigger.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get('automationId') || undefined;

    const stats = await triggerService.getTriggerStats(
      session.user.tenantId,
      automationId
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching trigger stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trigger stats' },
      { status: 500 }
    );
  }
}