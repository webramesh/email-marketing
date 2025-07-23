import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { EmailQueueService } from '@/services/email-queue.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to view queue stats
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Instantiate service only when needed (at runtime, not build time)
    const emailQueueService = new EmailQueueService();
    const stats = await emailQueueService.getQueueStats();
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    );
  }
}