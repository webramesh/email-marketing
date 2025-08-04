import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const packageService = new PackageManagementService(prisma);
    await packageService.cancelPurchase(params.id, session.user.tenantId);

    return NextResponse.json({ message: 'Purchase cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling purchase:', error);
    if (error instanceof Error && error.message === 'Purchase not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}