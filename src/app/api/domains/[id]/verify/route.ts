import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { DomainService } from '@/services/domain.service';

const domainService = new DomainService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await domainService.verifyDomain(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify domain' },
      { status: error instanceof Error && error.message === 'Domain not found' ? 404 : 500 }
    );
  }
}