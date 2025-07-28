import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportTicketService } from '@/services/support-ticket.service';
import {
  TicketPriority,
  TicketCategory,
  TicketStatus,
  SlaLevel,
  TicketSource,
} from '@/generated/prisma';
import { z } from 'zod';

const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(1, 'Description is required'),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  language: z.string().optional(),
  requesterEmail: z.string().email('Valid email is required'),
  requesterName: z.string().optional(),
  assignedCompany: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  source: z.nativeEnum(TicketSource).optional(),
  slaLevel: z.nativeEnum(SlaLevel).optional(),
});

const ticketFiltersSchema = z.object({
  status: z.array(z.nativeEnum(TicketStatus)).optional(),
  priority: z.array(z.nativeEnum(TicketPriority)).optional(),
  category: z.array(z.nativeEnum(TicketCategory)).optional(),
  assignedToUserId: z.string().optional(),
  assignedCompany: z.string().optional(),
  requesterEmail: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTicketSchema.parse(body);

    // If no requesterUserId provided, use current user
    const ticketData = {
      ...validatedData,
      requesterUserId:
        validatedData.requesterEmail === session.user.email ? session.user.id : undefined,
    };

    const ticket = await supportTicketService.createTicket(session.user.tenantId, ticketData);

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating support ticket:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());

    // Parse array parameters
    const queryParams: Record<string, any> = { ...rawParams };
    if (rawParams.status) {
      queryParams.status = rawParams.status.split(',');
    }
    if (rawParams.priority) {
      queryParams.priority = rawParams.priority.split(',');
    }
    if (rawParams.category) {
      queryParams.category = rawParams.category.split(',');
    }
    if (rawParams.tags) {
      queryParams.tags = rawParams.tags.split(',');
    }

    const validatedFilters = ticketFiltersSchema.parse(queryParams);

    const filters = {
      ...validatedFilters,
      dateFrom: validatedFilters.dateFrom ? new Date(validatedFilters.dateFrom) : undefined,
      dateTo: validatedFilters.dateTo ? new Date(validatedFilters.dateTo) : undefined,
    };

    const page = validatedFilters.page || 1;
    const limit = validatedFilters.limit || 20;

    const result = await supportTicketService.getTickets(
      session.user.tenantId,
      filters,
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching support tickets:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch support tickets' }, { status: 500 });
  }
}

const bulkUpdateSchema = z.object({
  ticketIds: z.array(z.string()).min(1, 'At least one ticket ID is required'),
  updates: z.object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category: z.nativeEnum(TicketCategory).optional(),
    assignedToUserId: z.string().optional(),
    assignedCompany: z.string().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.string(), z.any()).optional(),
  }),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ticketIds, updates } = bulkUpdateSchema.parse(body);

    const result = await supportTicketService.bulkUpdateTickets(
      session.user.tenantId,
      ticketIds,
      updates
    );

    return NextResponse.json({
      message: `Updated ${result.count} tickets`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error bulk updating support tickets:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to bulk update support tickets' }, { status: 500 });
  }
}
