import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportTicketService } from '@/services/support-ticket.service';
import { z } from 'zod';

const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  isInternal: z.boolean().optional().default(false),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, isInternal } = addCommentSchema.parse(body);

    const comment = await supportTicketService.addComment(
      session.user.tenantId,
      params.id,
      {
        content,
        isInternal,
        authorId: session.user.id,
        authorName: session.user.name || undefined,
        authorEmail: session.user.email,
      }
    );

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error adding comment to support ticket:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}