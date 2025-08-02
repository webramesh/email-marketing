import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';
import { z } from 'zod';
import { CommissionStatus } from '@/generated/prisma';

const querySchema = z.object({
  status: z.nativeEnum(CommissionStatus).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can view commissions
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { status, page, limit } = querySchema.parse({
      status: searchParams.get('status') as CommissionStatus || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    });

    const packageService = new PackageManagementService(prisma);
    const result = await packageService.getCommissions(session.user.tenantId, status, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching commissions:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}