import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportTicketService } from '@/services/support-ticket.service';
import { z } from 'zod';

const statsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const { dateFrom, dateTo } = statsQuerySchema.parse(queryParams);

    const stats = await supportTicketService.getTicketStats(
      session.user.tenantId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching support ticket stats:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch support ticket stats' },
      { status: 500 }
    );
  }
}