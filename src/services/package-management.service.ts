import { PrismaClient } from '@/generated/prisma';
import {
  Package,
  PackageCategory,
  PackageBillingCycle,
  PackageStatus,
  PurchaseStatus,
  CommissionStatus,
  ReviewStatus,
  PackageInvoiceStatus,
} from '@/generated/prisma';

export interface CreatePackageData {
  name: string;
  description?: string;
  shortDescription?: string;
  category: PackageCategory;
  price: number;
  currency?: string;
  billingCycle: PackageBillingCycle;
  setupFee?: number;
  trialDays?: number;
  features: Record<string, any>;
  quotas: Record<string, any>;
  isPublic?: boolean;
  isFeatured?: boolean;
  platformCommission?: number;
  images?: string[];
  tags?: string[];
  highlights?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdatePackageData extends Partial<CreatePackageData> {
  status?: PackageStatus;
}

export interface PackageFilters {
  category?: PackageCategory;
  status?: PackageStatus;
  isPublic?: boolean;
  isFeatured?: boolean;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  tags?: string[];
}

export interface PurchasePackageData {
  packageId: string;
  customerId: string;
  billingCycle?: PackageBillingCycle;
  paymentProvider?: string;
  customerPaymentId?: string;
  subscriptionPaymentId?: string;
  trialDays?: number;
}

export class PackageManagementService {
  constructor(private prisma: PrismaClient) {}

  // Package CRUD Operations
  async createPackage(creatorId: string, data: CreatePackageData): Promise<Package> {
    const slug = this.generateSlug(data.name);

    return this.prisma.package.create({
      data: {
        ...data,
        creatorId,
        slug,
        features: data.features,
        quotas: data.quotas,
        images: data.images || [],
        tags: data.tags || [],
        highlights: data.highlights || [],
        platformCommission: data.platformCommission || 10.0,
        creatorRevenue: 100 - (data.platformCommission || 10.0),
      },
    });
  }

  async updatePackage(
    packageId: string,
    creatorId: string,
    data: UpdatePackageData
  ): Promise<Package> {
    // Verify ownership
    const existingPackage = await this.prisma.package.findFirst({
      where: { id: packageId, creatorId },
    });

    if (!existingPackage) {
      throw new Error('Package not found or access denied');
    }

    const updateData: any = { ...data };

    if (data.name && data.name !== existingPackage.name) {
      updateData.slug = this.generateSlug(data.name);
    }

    if (data.platformCommission !== undefined) {
      updateData.creatorRevenue = 100 - data.platformCommission;
    }

    return this.prisma.package.update({
      where: { id: packageId },
      data: updateData,
    });
  }

  async deletePackage(packageId: string, creatorId: string): Promise<void> {
    // Check if package has active purchases
    const activePurchases = await this.prisma.packagePurchase.count({
      where: {
        packageId,
        status: { in: [PurchaseStatus.ACTIVE, PurchaseStatus.TRIALING] },
      },
    });

    if (activePurchases > 0) {
      throw new Error('Cannot delete package with active purchases');
    }

    await this.prisma.package.delete({
      where: { id: packageId, creatorId },
    });
  }

  async getPackage(packageId: string, includeAnalytics = false): Promise<Package | null> {
    const include: any = {
      creator: {
        select: { id: true, name: true, subdomain: true },
      },
      reviews: {
        where: { status: ReviewStatus.PUBLISHED },
        include: {
          reviewer: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    };

    if (includeAnalytics) {
      include.analytics = {
        orderBy: { date: 'desc' },
        take: 30,
      };
    }

    return this.prisma.package.findUnique({
      where: { id: packageId },
      include,
    });
  }

  async getPackages(filters: PackageFilters = {}, page = 1, limit = 20) {
    const where: any = {};

    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.price = {};
      if (filters.priceMin !== undefined) where.price.gte = filters.priceMin;
      if (filters.priceMax !== undefined) where.price.lte = filters.priceMax;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { shortDescription: { contains: filters.search } },
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        array_contains: filters.tags,
      };
    }

    const [packages, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        include: {
          creator: {
            select: { id: true, name: true, subdomain: true },
          },
          _count: {
            select: { reviews: true, purchases: true },
          },
        },
        orderBy: [{ isFeatured: 'desc' }, { totalPurchases: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.package.count({ where }),
    ]);

    return {
      packages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCreatorPackages(creatorId: string, page = 1, limit = 20) {
    const [packages, total] = await Promise.all([
      this.prisma.package.findMany({
        where: { creatorId },
        include: {
          _count: {
            select: { reviews: true, purchases: true },
          },
          analytics: {
            where: {
              date: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
            orderBy: { date: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.package.count({ where: { creatorId } }),
    ]);

    return {
      packages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Package Purchase Operations
  async purchasePackage(data: PurchasePackageData) {
    const packageData = await this.prisma.package.findUnique({
      where: { id: data.packageId },
    });

    if (!packageData) {
      throw new Error('Package not found');
    }

    if (packageData.status !== PackageStatus.PUBLISHED) {
      throw new Error('Package is not available for purchase');
    }

    // Calculate period dates
    const now = new Date();
    const currentPeriodStart = now;
    const currentPeriodEnd = this.calculatePeriodEnd(
      now,
      data.billingCycle || packageData.billingCycle
    );
    const trialEnd = data.trialDays
      ? new Date(now.getTime() + data.trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Create purchase
    const purchase = await this.prisma.packagePurchase.create({
      data: {
        packageId: data.packageId,
        customerId: data.customerId,
        purchasePrice: packageData.price,
        currency: packageData.currency,
        billingCycle: data.billingCycle || packageData.billingCycle,
        status: trialEnd ? PurchaseStatus.TRIALING : PurchaseStatus.ACTIVE,
        currentPeriodStart,
        currentPeriodEnd,
        trialEnd,
        paymentProvider: data.paymentProvider,
        customerPaymentId: data.customerPaymentId,
        subscriptionPaymentId: data.subscriptionPaymentId,
        quotas: packageData.quotas as any,
        usage: {},
      },
    });

    // Create sale record for commission tracking
    await this.prisma.packageSale.create({
      data: {
        packageId: data.packageId,
        sellerId: packageData.creatorId,
        purchaseId: purchase.id,
        totalAmount: packageData.price,
        platformCommission: (packageData.price * packageData.platformCommission) / 100,
        sellerRevenue: (packageData.price * packageData.creatorRevenue) / 100,
        currency: packageData.currency,
        paymentProvider: data.paymentProvider,
      },
    });

    // Update package statistics
    await this.prisma.package.update({
      where: { id: data.packageId },
      data: {
        totalPurchases: { increment: 1 },
        totalRevenue: { increment: packageData.price },
      },
    });

    return purchase;
  }

  async cancelPurchase(purchaseId: string, customerId: string): Promise<void> {
    const purchase = await this.prisma.packagePurchase.findFirst({
      where: { id: purchaseId, customerId },
    });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    await this.prisma.packagePurchase.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.CANCELLED,
        cancelAtPeriodEnd: true,
      },
    });
  }

  async getPurchases(customerId: string, page = 1, limit = 20) {
    const [purchases, total] = await Promise.all([
      this.prisma.packagePurchase.findMany({
        where: { customerId },
        include: {
          package: {
            include: {
              creator: {
                select: { id: true, name: true, subdomain: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.packagePurchase.count({ where: { customerId } }),
    ]);

    return {
      purchases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Package Reviews
  async createReview(
    packageId: string,
    reviewerId: string,
    rating: number,
    title?: string,
    content?: string
  ) {
    // Check if user has purchased the package
    const purchase = await this.prisma.packagePurchase.findFirst({
      where: {
        packageId,
        customerId: reviewerId,
        status: { in: [PurchaseStatus.ACTIVE, PurchaseStatus.CANCELLED] },
      },
    });

    const review = await this.prisma.packageReview.create({
      data: {
        packageId,
        reviewerId,
        rating,
        title,
        content,
        isVerifiedPurchase: !!purchase,
      },
    });

    // Update package average rating
    await this.updatePackageRating(packageId);

    return review;
  }

  async updatePackageRating(packageId: string): Promise<void> {
    const reviews = await this.prisma.packageReview.findMany({
      where: { packageId, status: ReviewStatus.PUBLISHED },
      select: { rating: true },
    });

    if (reviews.length > 0) {
      const averageRating =
        reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

      await this.prisma.package.update({
        where: { id: packageId },
        data: {
          averageRating,
          totalReviews: reviews.length,
        },
      });
    }
  }

  // Analytics
  async trackPackageView(packageId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.packageAnalytics.upsert({
      where: {
        packageId_date: {
          packageId,
          date: today,
        },
      },
      update: {
        views: { increment: 1 },
      },
      create: {
        packageId,
        date: today,
        views: 1,
        uniqueViews: 1,
      },
    });

    // Update package total views
    await this.prisma.package.update({
      where: { id: packageId },
      data: { totalViews: { increment: 1 } },
    });
  }

  async getPackageAnalytics(packageId: string, creatorId: string, days = 30) {
    // Verify ownership
    const packageData = await this.prisma.package.findFirst({
      where: { id: packageId, creatorId },
    });

    if (!packageData) {
      throw new Error('Package not found or access denied');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const analytics = await this.prisma.packageAnalytics.findMany({
      where: {
        packageId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const sales = await this.prisma.packageSale.findMany({
      where: {
        packageId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      analytics,
      sales,
      summary: {
        totalViews: analytics.reduce((sum, a) => sum + a.views, 0),
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, s) => sum + s.sellerRevenue, 0),
        conversionRate:
          analytics.length > 0
            ? (sales.length / analytics.reduce((sum, a) => sum + a.views, 0)) * 100
            : 0,
      },
    };
  }

  // Commission Management
  async getCommissions(sellerId: string, status?: CommissionStatus, page = 1, limit = 20) {
    const where: any = { sellerId };
    if (status) where.commissionStatus = status;

    const [commissions, total] = await Promise.all([
      this.prisma.packageSale.findMany({
        where,
        include: {
          package: {
            select: { id: true, name: true },
          },
          purchase: {
            include: {
              customer: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.packageSale.count({ where }),
    ]);

    return {
      commissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markCommissionPaid(saleId: string, transactionId?: string): Promise<void> {
    await this.prisma.packageSale.update({
      where: { id: saleId },
      data: {
        commissionStatus: CommissionStatus.PAID,
        commissionPaidAt: new Date(),
        transactionId,
      },
    });
  }

  // Utility Methods
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private calculatePeriodEnd(start: Date, billingCycle: PackageBillingCycle): Date {
    const end = new Date(start);

    switch (billingCycle) {
      case PackageBillingCycle.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case PackageBillingCycle.QUARTERLY:
        end.setMonth(end.getMonth() + 3);
        break;
      case PackageBillingCycle.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
      case PackageBillingCycle.ONE_TIME:
        end.setFullYear(end.getFullYear() + 100); // Effectively never expires
        break;
    }

    return end;
  }
}
