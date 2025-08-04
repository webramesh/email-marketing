import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportTicketService } from '@/services/support-ticket.service';
import { TicketPriority, TicketCategory, TicketStatus } from '@/generated/prisma';
import { z } from 'zod';

const updateTicketSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedToUserId: z.string().optional(),
  assignedCompany: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await supportTicketService.getTicketById(session.user.tenantId, params.id);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch support ticket' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateTicketSchema.parse(body);

    const ticket = await supportTicketService.updateTicket(
      session.user.tenantId,
      params.id,
      validatedData
    );

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error updating support ticket:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to update support ticket' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if ticket exists and belongs to tenant
    const ticket = await supportTicketService.getTicketById(session.user.tenantId, params.id);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Instead of deleting, we'll close the ticket
    await supportTicketService.updateTicket(session.user.tenantId, params.id, {
      status: TicketStatus.CLOSED,
    });

    return NextResponse.json({ message: 'Ticket closed successfully' });
  } catch (error) {
    console.error('Error closing support ticket:', error);
    return NextResponse.json({ error: 'Failed to close support ticket' }, { status: 500 });
  }
}
