import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormService } from '@/services/form.service';
import { z } from 'zod';

const duplicateFormSchema = z.object({
  name: z.string().min(1, 'Form name is required'),
});

/**
 * POST /api/forms/[id]/duplicate - Duplicate a form
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = duplicateFormSchema.parse(body);

    const form = await FormService.duplicateForm(session.user.tenantId, params.id, name);

    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    console.error('Error duplicating form:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to duplicate form' }, { status: 500 });
  }
}
