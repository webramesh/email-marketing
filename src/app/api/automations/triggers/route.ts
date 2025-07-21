import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { automationService } from '@/services/automation.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const triggers = automationService.getTriggerConfigurations();
    return NextResponse.json(triggers);
  } catch (error) {
    console.error('Error fetching trigger configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trigger configurations' },
      { status: 500 }
    );
  }
}