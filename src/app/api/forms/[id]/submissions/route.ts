import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormService } from '@/services/form.service';

/**
 * GET /api/forms/[id]/submissions - Get form submissions
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const submissions = await FormService.getFormSubmissions(session.user.tenantId, params.id, {
      limit,
      offset,
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    return NextResponse.json({ error: 'Failed to fetch form submissions' }, { status: 500 });
  }
}
