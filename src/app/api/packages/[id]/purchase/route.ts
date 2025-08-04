import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';
import { z } from 'zod';
import { PackageBillingCycle } from '@/generated/prisma';

const purchasePackageSchema = z.object({
  billingCycle: z.nativeEnum(PackageBillingCycle).optional(),
  paymentProvider: z.string().optional(),
  customerPaymentId: z.string().optional(),
  subscriptionPaymentId: z.string().optional(),
  trialDays: z.number().min(0).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = purchasePackageSchema.parse(body);

    const packageService = new PackageManagementService(prisma);
    const purchase = await packageService.purchasePackage({
      packageId: params.id,
      customerId: session.user.tenantId,
      ...data,
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error('Error purchasing package:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && (
      error.message === 'Package not found' || 
      error.message === 'Package is not available for purchase'
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}