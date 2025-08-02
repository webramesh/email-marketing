import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PackageManagementService } from '@/services/package-management.service';
import { z } from 'zod';
import { PackageCategory, PackageBillingCycle } from '@/generated/prisma';

const createPackageSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  category: z.nativeEnum(PackageCategory),
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().default('USD'),
  billingCycle: z.nativeEnum(PackageBillingCycle),
  setupFee: z.number().min(0).optional(),
  trialDays: z.number().min(0).optional(),
  features: z.record(z.string(), z.any()),
  quotas: z.record(z.string(), z.any()),
  isPublic: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  platformCommission: z.number().min(0).max(100).default(10),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

const packageFiltersSchema = z.object({
  category: z.nativeEnum(PackageCategory).optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = packageFiltersSchema.parse({
      category: searchParams.get('category') || undefined,
      isPublic: searchParams.get('isPublic') ? searchParams.get('isPublic') === 'true' : undefined,
      isFeatured: searchParams.get('isFeatured') ? searchParams.get('isFeatured') === 'true' : undefined,
      priceMin: searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : undefined,
      priceMax: searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    });

    const packageService = new PackageManagementService(prisma);
    const result = await packageService.getPackages(filters, filters.page, filters.limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching packages:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can create packages
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const data = createPackageSchema.parse(body);

    const packageService = new PackageManagementService(prisma);
    const package_ = await packageService.createPackage(session.user.tenantId, data);

    return NextResponse.json(package_, { status: 201 });
  } catch (error) {
    console.error('Error creating package:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}