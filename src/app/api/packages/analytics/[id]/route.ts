import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';
import { z } from 'zod';

const querySchema = z.object({
  days: z.number().min(1).max(365).default(30),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { days } = querySchema.parse({
      days: searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30,
    });

    const packageService = new PackageManagementService(prisma);
    const analytics = await packageService.getPackageAnalytics(params.id, session.user.tenantId, days);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching package analytics:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters', details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Package not found or access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}