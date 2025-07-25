import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormService } from '@/services/form.service';

/**
 * POST /api/forms/[id]/publish - Publish a form
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await FormService.publishForm(session.user.tenantId, params.id);

    return NextResponse.json({ form });
  } catch (error) {
    console.error('Error publishing form:', error);
    return NextResponse.json(
      { error: 'Failed to publish form' },
      { status: 500 }
    );
  }
}