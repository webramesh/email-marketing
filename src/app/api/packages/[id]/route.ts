import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';
import { z } from 'zod';
import { PackageCategory, PackageBillingCycle, PackageStatus } from '@/generated/prisma';

const updatePackageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  category: z.nativeEnum(PackageCategory).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  billingCycle: z.nativeEnum(PackageBillingCycle).optional(),
  setupFee: z.number().min(0).optional(),
  trialDays: z.number().min(0).optional(),
  features: z.record(z.string(), z.any()).optional(),
  quotas: z.record(z.string(), z.any()).optional(),
  status: z.nativeEnum(PackageStatus).optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  platformCommission: z.number().min(0).max(100).optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true';

    const packageService = new PackageManagementService(prisma);
    const package_ = await packageService.getPackage(params.id, includeAnalytics);

    if (!package_) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Track view if it's a public package and not the creator viewing
    if (package_.isPublic && package_.creatorId !== session.user.tenantId) {
      await packageService.trackPackageView(params.id);
    }

    return NextResponse.json(package_);
  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = updatePackageSchema.parse(body);

    const packageService = new PackageManagementService(prisma);
    const package_ = await packageService.updatePackage(params.id, session.user.tenantId, data);

    return NextResponse.json(package_);
  } catch (error) {
    console.error('Error updating package:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Package not found or access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const packageService = new PackageManagementService(prisma);
    await packageService.deletePackage(params.id, session.user.tenantId);

    return NextResponse.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    if (error instanceof Error && error.message.includes('Cannot delete package')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Package not found or access denied') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}