import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SendingServerService } from '@/services/sending-server.service';
import { z } from 'zod';

const createSendingServerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['amazon_ses', 'sendgrid', 'mailgun', 'sparkpost', 'elasticemail', 'smtp', 'postal']),
  configuration: z.record(z.any()),
  isActive: z.boolean().optional(),
});

const sendingServerService = new SendingServerService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const servers = await sendingServerService.getSendingServers(session.user.tenantId);
    
    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Error fetching sending servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sending servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSendingServerSchema.parse(body);

    const server = await sendingServerService.createSendingServer(
      session.user.tenantId,
      validatedData
    );

    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error('Error creating sending server:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sending server' },
      { status: 500 }
    );
  }
}