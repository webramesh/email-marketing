import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { DomainService } from '@/services/domain.service';
import { z } from 'zod';

const updateDomainSchema = z.object({
  name: z.string().min(1).regex(
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/,
    'Invalid domain name format'
  ).optional(),
});

const domainService = new DomainService();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await domainService.getDomain(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching domain:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch domain' },
      { status: error instanceof Error && error.message === 'Domain not found' ? 404 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const validatedData = updateDomainSchema.parse(body);

    const domain = await domainService.updateDomain(
      params.id,
      session.user.tenantId,
      validatedData
    );

    return NextResponse.json({ domain });
  } catch (error) {
    console.error('Error updating domain:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update domain' },
      { status: error instanceof Error && error.message === 'Domain not found' ? 404 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    await domainService.deleteDomain(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete domain' },
      { status: error instanceof Error && error.message === 'Domain not found' ? 404 : 500 }
    );
  }
}