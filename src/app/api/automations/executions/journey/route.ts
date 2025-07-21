import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { workflowExecutionService } from '@/services/workflow-execution.service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('subscriberId');
    const automationId = searchParams.get('automationId');

    if (!subscriberId) {
      return NextResponse.json(
        { error: 'Subscriber ID is required' },
        { status: 400 }
      );
    }

    // Get automation executions for the subscriber
    const executions = await prisma.automationExecution.findMany({
      where: {
        tenantId: session.user.tenantId,
        subscriberId,
        ...(automationId && { automationId }),
      },
      include: {
        automation: {
          select: {
            id: true,
            name: true,
            workflowData: true,
          },
        },
        subscriber: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Transform executions into journey format
    const journeys = await Promise.all(
      executions.map(async (execution) => {
        // Get execution timeline
        const timeline = await workflowExecutionService.getExecutionTimeline(execution.id);

        return {
          executionId: execution.id,
          automationId: execution.automationId,
          automationName: execution.automation.name,
          subscriberId: execution.subscriberId,
          subscriberEmail: execution.subscriber.email,
          status: execution.status.toLowerCase(),
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          currentStep: (execution.executionData as any)?.currentNodeId,
          steps: timeline,
        };
      })
    );

    return NextResponse.json(journeys);
  } catch (error) {
    console.error('Error fetching subscriber journey:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriber journey' },
      { status: 500 }
    );
  }
}