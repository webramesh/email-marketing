import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SendingServerService } from '@/services/sending-server.service';

const sendingServerService = new SendingServerService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sendingServerService.testSendingServer(
      params.id,
      session.user.tenantId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing sending server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test sending server' },
      { status: 500 }
    );
  }
}