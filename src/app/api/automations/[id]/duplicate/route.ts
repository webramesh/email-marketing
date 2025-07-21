import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { automationService } from '@/services/automation.service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const automation = await automationService.duplicateAutomation(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json(automation, { status: 201 });
  } catch (error) {
    console.error('Error duplicating automation:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate automation' },
      { status: 500 }
    );
  }
}