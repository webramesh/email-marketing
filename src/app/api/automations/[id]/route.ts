import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { automationService } from '@/services/automation.service';
import { UpdateAutomationRequest } from '@/types';
import { z } from 'zod';

const updateAutomationSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  triggerType: z.string().optional(),
  triggerConfig: z.record(z.string(), z.any()).optional(),
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
  }).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const automation = await automationService.getAutomation(
      params.id,
      session.user.tenantId
    );

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    return NextResponse.json(automation);
  } catch (error) {
    console.error('Error fetching automation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const validatedData = updateAutomationSchema.parse(body);

    const automation = await automationService.updateAutomation(
      params.id,
      session.user.tenantId,
      validatedData as UpdateAutomationRequest
    );

    return NextResponse.json(automation);
  } catch (error) {
    console.error('Error updating automation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update automation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    await automationService.deleteAutomation(params.id, session.user.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation:', error);
    return NextResponse.json(
      { error: 'Failed to delete automation' },
      { status: 500 }
    );
  }
}