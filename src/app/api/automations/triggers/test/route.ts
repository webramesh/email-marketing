import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { triggerService } from '@/services/trigger.service';
import { TriggerType } from '@/types';
import { z } from 'zod';

const testTriggerSchema = z.object({
  triggerType: z.nativeEnum(TriggerType),
  triggerConfig: z.record(z.string(), z.any()),
  subscriberId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { triggerType, triggerConfig, subscriberId } = testTriggerSchema.parse(body);

    const result = await triggerService.testTrigger(
      session.user.tenantId,
      triggerType,
      triggerConfig,
      subscriberId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing trigger:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to test trigger' },
      { status: 500 }
    );
  }
}