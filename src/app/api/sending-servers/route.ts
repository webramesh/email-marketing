import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SendingServerService } from '@/services/sending-server.service';
import { SendingServerType } from '@/types/email-sending';
import { z } from 'zod';

const createSendingServerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.nativeEnum(SendingServerType),
  configuration: z.record(z.string(), z.any()),
  isActive: z.boolean().optional(),
});

const sendingServerService = new SendingServerService();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const servers = await sendingServerService.getSendingServers(session.user.tenantId);

    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Error fetching sending servers:', error);
    return NextResponse.json({ error: 'Failed to fetch sending servers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSendingServerSchema.parse(body);

    const server = await sendingServerService.createSendingServer(
      session.user.tenantId,
      validatedData as any
    );

    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error('Error creating sending server:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sending server' },
      { status: 500 }
    );
  }
}
