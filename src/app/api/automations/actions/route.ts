import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { automationService } from '@/services/automation.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actions = automationService.getActionConfigurations();
    return NextResponse.json(actions);
  } catch (error) {
    console.error('Error fetching action configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch action configurations' },
      { status: 500 }
    );
  }
}