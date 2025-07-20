import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SendingServerService } from '@/services/sending-server.service';
import { z } from 'zod';

const updateSendingServerSchema = z.object({
  name: z.string().min(1).optional(),
  configuration: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const sendingServerService = new SendingServerService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const server = await sendingServerService.getSendingServer(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json({ server });
  } catch (error) {
    console.error('Error fetching sending server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sending server' },
      { status: error instanceof Error && error.message === 'Sending server not found' ? 404 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateSendingServerSchema.parse(body);

    const server = await sendingServerService.updateSendingServer(
      params.id,
      session.user.tenantId,
      validatedData
    );

    return NextResponse.json({ server });
  } catch (error) {
    console.error('Error updating sending server:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sending server' },
      { status: error instanceof Error && error.message === 'Sending server not found' ? 404 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sendingServerService.deleteSendingServer(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sending server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete sending server' },
      { status: error instanceof Error && error.message === 'Sending server not found' ? 404 : 500 }
    );
  }
}