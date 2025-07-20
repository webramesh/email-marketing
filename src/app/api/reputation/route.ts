import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BounceComplaintService } from '@/services/bounce-complaint.service';

const bounceComplaintService = new BounceComplaintService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const metrics = await bounceComplaintService.getReputationMetrics(
      session.user.tenantId,
      days
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching reputation metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reputation metrics' },
      { status: 500 }
    );
  }
}