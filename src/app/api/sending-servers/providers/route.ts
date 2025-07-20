import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SendingServerService } from '@/services/sending-server.service';

const sendingServerService = new SendingServerService();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providers = await sendingServerService.getAvailableProviders();
    
    return NextResponse.json({ providers });
  } catch (error) {
    console.error('Error fetching available providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available providers' },
      { status: 500 }
    );
  }
}