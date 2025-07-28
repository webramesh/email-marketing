import { NextRequest, NextResponse } from 'next/server';
import { supportEscalationService } from '@/services/support-escalation.service';

export async function POST(request: NextRequest) {
  try {
    // Verify this is called from a cron job or internal service
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run escalation checks
    await supportEscalationService.runEscalationChecks();

    return NextResponse.json({ 
      message: 'Escalation checks completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running escalation checks:', error);
    return NextResponse.json(
      { error: 'Failed to run escalation checks' },
      { status: 500 }
    );
  }
}

// Manual trigger for testing (admin only)
export async function GET(request: NextRequest) {
  try {
    // This would typically require admin authentication
    // For now, we'll allow it for testing purposes
    
    await supportEscalationService.runEscalationChecks();

    return NextResponse.json({ 
      message: 'Manual escalation check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running manual escalation check:', error);
    return NextResponse.json(
      { error: 'Failed to run escalation check' },
      { status: 500 }
    );
  }
}