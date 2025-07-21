import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { DomainService } from '@/services/domain.service';

const domainService = new DomainService();

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
    const result = await domainService.regenerateDKIMKeys(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error regenerating DKIM keys:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate DKIM keys' },
      { status: error instanceof Error && error.message === 'Domain not found' ? 404 : 500 }
    );
  }
}