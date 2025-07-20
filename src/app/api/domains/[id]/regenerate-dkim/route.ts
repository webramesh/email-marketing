import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DomainService } from '@/services/domain.service';

const domainService = new DomainService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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