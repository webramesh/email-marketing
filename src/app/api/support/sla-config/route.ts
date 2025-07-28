import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supportEscalationService } from '@/services/support-escalation.service';
import { prisma } from '@/lib/prisma';
import { SlaLevel, TicketPriority } from '@/generated/prisma';
import { z } from 'zod';

const createSLAConfigSchema = z.object({
  slaLevel: z.nativeEnum(SlaLevel),
  priority: z.nativeEnum(TicketPriority),
  firstResponseTime: z.number().min(1, 'First response time must be at least 1 minute'),
  resolutionTime: z.number().min(1, 'Resolution time must be at least 1 minute'),
  escalationTime: z.number().min(1, 'Escalation time must be at least 1 minute'),
  businessHoursOnly: z.boolean().optional().default(false),
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
    const validatedData = createSLAConfigSchema.parse(body);

    await supportEscalationService.createSLAConfig(
      session.user.tenantId,
      validatedData.slaLevel,
      validatedData.priority,
      validatedData.firstResponseTime,
      validatedData.resolutionTime,
      validatedData.escalationTime,
      validatedData.businessHoursOnly
    );

    return NextResponse.json({ 
      message: 'SLA configuration created successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating SLA config:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create SLA configuration' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slaConfigs = await prisma.supportSlaConfig.findMany({
      where: { 
        tenantId: session.user.tenantId,
        isActive: true,
      },
      orderBy: [
        { slaLevel: 'asc' },
        { priority: 'desc' },
      ],
    });

    return NextResponse.json(slaConfigs);
  } catch (error) {
    console.error('Error fetching SLA configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SLA configurations' },
      { status: 500 }
    );
  }
}