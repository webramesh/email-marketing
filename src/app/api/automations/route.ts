import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { automationService } from '@/services/automation.service';
import { CreateAutomationRequest } from '@/types';
import { z } from 'zod';

const createAutomationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  triggerType: z.string().min(1, 'Trigger type is required'),
  triggerConfig: z.record(z.string(), z.any()),
  workflowData: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      data: z.object({
        label: z.string(),
        description: z.string().optional(),
        config: z.record(z.string(), z.any()),
        isValid: z.boolean().optional(),
        errors: z.array(z.string()).optional(),
      }),
      connections: z.object({
        inputs: z.array(z.string()),
        outputs: z.array(z.string()),
      }),
    })),
    connections: z.array(z.object({
      id: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
      condition: z.object({
        type: z.enum(['always', 'conditional']),
        expression: z.string().optional(),
        value: z.any().optional(),
      }).optional(),
    })),
  }),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await automationService.getAutomations(session.user.tenantId, {
      page,
      limit,
      status: status as any,
      search,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching automations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createAutomationSchema.parse(body);

    const automation = await automationService.createAutomation(
      session.user.tenantId,
      validatedData as CreateAutomationRequest
    );

    return NextResponse.json(automation, { status: 201 });
  } catch (error) {
    console.error('Error creating automation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create automation' },
      { status: 500 }
    );
  }
}