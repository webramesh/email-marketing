import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportEscalationService } from '@/services/support-escalation.service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createCompanyRuleSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  routingRules: z.object({
    keywords: z.array(z.string()).optional(),
    category: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    requesterDomain: z.array(z.string()).optional(),
  }),
  assignedAgents: z.array(z.string()).min(1, 'At least one agent must be assigned'),
  priority: z.number().min(1).optional().default(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createCompanyRuleSchema.parse(body);

    await supportEscalationService.createCompanyRule(
      session.user.tenantId,
      validatedData.companyName,
      validatedData.routingRules,
      validatedData.assignedAgents,
      validatedData.priority
    );

    return NextResponse.json(
      {
        message: 'Company rule created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating company rule:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create company rule' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyRules = await prisma.supportCompanyRule.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { priority: 'asc' },
    });

    // Parse JSON fields
    const formattedRules = companyRules.map(rule => ({
      ...rule,
      routingRules:
        typeof rule.routingRules === 'string' ? JSON.parse(rule.routingRules) : rule.routingRules,
      assignedAgents:
        typeof rule.assignedAgents === 'string'
          ? JSON.parse(rule.assignedAgents)
          : rule.assignedAgents,
    }));

    return NextResponse.json(formattedRules);
  } catch (error) {
    console.error('Error fetching company rules:', error);
    return NextResponse.json({ error: 'Failed to fetch company rules' }, { status: 500 });
  }
}
