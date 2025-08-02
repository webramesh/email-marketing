import { PackageManagementService } from '../package-management.service';
import { PrismaClient } from '@/generated/prisma';
import { PackageCategory, PackageBillingCycle, PackageStatus, PurchaseStatus } from '@/generated/prisma';

// Mock Prisma Client
const mockPrisma = {
  package: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  packagePurchase: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  packageSale: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  packageReview: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  packageAnalytics: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PackageManagementService', () => {
  let service: PackageManagementService;

  beforeEach(() => {
    service = new PackageManagementService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('createPackage', () => {
    it('should create a package with correct data', async () => {
      const packageData = {
        name: 'Test Package',
        description: 'A test package',
        category: PackageCategory.EMAIL_MARKETING,
        price: 99.99,
        billingCycle: PackageBillingCycle.MONTHLY,
        features: { emailCampaigns: true },
        quotas: { emailsPerMonth: 10000 },
      };

      const createdPackage = {
        id: 'pkg_123',
        ...packageData,
        creatorId: 'tenant_123',
        slug: 'test-package',
        platformCommission: 10.0,
        creatorRevenue: 90.0,
      };

      (mockPrisma.package.create as jest.Mock).mockResolvedValue(createdPackage);

      const result = await service.createPackage('tenant_123', packageData);

      expect(mockPrisma.package.create).toHaveBeenCalledWith({
        data: {
          ...packageData,
          creatorId: 'tenant_123',
          slug: 'test-package',
          features: packageData.features,
          quotas: packageData.quotas,
          images: [],
          tags: [],
          highlights: [],
          platformCommission: 10.0,
          creatorRevenue: 90.0,
        },
      });

      expect(result).toEqual(createdPackage);
    });

    it('should generate correct slug from package name', async () => {
      const packageData = {
        name: 'My Awesome Package!',
        category: PackageCategory.EMAIL_MARKETING,
        price: 99.99,
        billingCycle: PackageBillingCycle.MONTHLY,
        features: {},
        quotas: {},
      };

      (mockPrisma.package.create as jest.Mock).mockResolvedValue({});

      await service.createPackage('tenant_123', packageData);

      expect(mockPrisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'my-awesome-package',
          }),
        })
      );
    });
  });

  describe('updatePackage', () => {
    it('should update package when user is owner', async () => {
      const existingPackage = {
        id: 'pkg_123',
        name: 'Original Package',
        creatorId: 'tenant_123',
      };

      const updateData = {
        name: 'Updated Package',
        price: 149.99,
      };

      (mockPrisma.package.findFirst as jest.Mock).mockResolvedValue(existingPackage);
      (mockPrisma.package.update as jest.Mock).mockResolvedValue({
        ...existingPackage,
        ...updateData,
      });

      const result = await service.updatePackage('pkg_123', 'tenant_123', updateData);

      expect(mockPrisma.package.findFirst).toHaveBeenCalledWith({
        where: { id: 'pkg_123', creatorId: 'tenant_123' },
      });

      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: 'pkg_123' },
        data: expect.objectContaining(updateData),
      });
    });

    it('should throw error when user is not owner', async () => {
      (mockPrisma.package.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updatePackage('pkg_123', 'tenant_456', { name: 'Updated' })
      ).rejects.toThrow('Package not found or access denied');
    });

    it('should update slug when name changes', async () => {
      const existingPackage = {
        id: 'pkg_123',
        name: 'Original Package',
        creatorId: 'tenant_123',
      };

      (mockPrisma.package.findFirst as jest.Mock).mockResolvedValue(existingPackage);
      (mockPrisma.package.update as jest.Mock).mockResolvedValue({});

      await service.updatePackage('pkg_123', 'tenant_123', { name: 'New Package Name' });

      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: 'pkg_123' },
        data: expect.objectContaining({
          name: 'New Package Name',
          slug: 'new-package-name',
        }),
      });
    });
  });

  describe('deletePackage', () => {
    it('should delete package when no active purchases', async () => {
      (mockPrisma.packagePurchase.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.package.delete as jest.Mock).mockResolvedValue({});

      await service.deletePackage('pkg_123', 'tenant_123');

      expect(mockPrisma.packagePurchase.count).toHaveBeenCalledWith({
        where: {
          packageId: 'pkg_123',
          status: { in: [PurchaseStatus.ACTIVE, PurchaseStatus.TRIALING] },
        },
      });

      expect(mockPrisma.package.delete).toHaveBeenCalledWith({
        where: { id: 'pkg_123', creatorId: 'tenant_123' },
      });
    });

    it('should throw error when package has active purchases', async () => {
      (mockPrisma.packagePurchase.count as jest.Mock).mockResolvedValue(2);

      await expect(
        service.deletePackage('pkg_123', 'tenant_123')
      ).rejects.toThrow('Cannot delete package with active purchases');
    });
  });

  describe('purchasePackage', () => {
    it('should create purchase and sale records', async () => {
      const packageData = {
        id: 'pkg_123',
        name: 'Test Package',
        price: 99.99,
        currency: 'USD',
        billingCycle: PackageBillingCycle.MONTHLY,
        status: PackageStatus.PUBLISHED,
        creatorId: 'creator_123',
        quotas: { emailsPerMonth: 10000 },
        platformCommission: 10.0,
        creatorRevenue: 90.0,
      };

      const purchaseData = {
        packageId: 'pkg_123',
        customerId: 'customer_123',
      };

      const createdPurchase = {
        id: 'purchase_123',
        ...purchaseData,
        purchasePrice: 99.99,
        status: PurchaseStatus.ACTIVE,
      };

      (mockPrisma.package.findUnique as jest.Mock).mockResolvedValue(packageData);
      (mockPrisma.packagePurchase.create as jest.Mock).mockResolvedValue(createdPurchase);
      (mockPrisma.packageSale.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.package.update as jest.Mock).mockResolvedValue({});

      const result = await service.purchasePackage(purchaseData);

      expect(mockPrisma.packagePurchase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          packageId: 'pkg_123',
          customerId: 'customer_123',
          purchasePrice: 99.99,
          currency: 'USD',
          billingCycle: PackageBillingCycle.MONTHLY,
          status: PurchaseStatus.ACTIVE,
          quotas: { emailsPerMonth: 10000 },
          usage: {},
        }),
      });

      expect(mockPrisma.packageSale.create).toHaveBeenCalledWith({
        data: {
          packageId: 'pkg_123',
          sellerId: 'creator_123',
          purchaseId: 'purchase_123',
          totalAmount: 99.99,
          platformCommission: 9.999,
          sellerRevenue: 89.991,
          currency: 'USD',
          paymentProvider: undefined,
        },
      });

      expect(result).toEqual(createdPurchase);
    });

    it('should throw error for non-published package', async () => {
      const packageData = {
        id: 'pkg_123',
        status: PackageStatus.DRAFT,
      };

      (mockPrisma.package.findUnique as jest.Mock).mockResolvedValue(packageData);

      await expect(
        service.purchasePackage({ packageId: 'pkg_123', customerId: 'customer_123' })
      ).rejects.toThrow('Package is not available for purchase');
    });

    it('should throw error for non-existent package', async () => {
      (mockPrisma.package.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.purchasePackage({ packageId: 'pkg_123', customerId: 'customer_123' })
      ).rejects.toThrow('Package not found');
    });
  });

  describe('trackPackageView', () => {
    it('should upsert analytics record and update package views', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      (mockPrisma.packageAnalytics.upsert as jest.Mock).mockResolvedValue({});
      (mockPrisma.package.update as jest.Mock).mockResolvedValue({});

      await service.trackPackageView('pkg_123');

      expect(mockPrisma.packageAnalytics.upsert).toHaveBeenCalledWith({
        where: {
          packageId_date: {
            packageId: 'pkg_123',
            date: today,
          },
        },
        update: {
          views: { increment: 1 },
        },
        create: {
          packageId: 'pkg_123',
          date: today,
          views: 1,
          uniqueViews: 1,
        },
      });

      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: 'pkg_123' },
        data: { totalViews: { increment: 1 } },
      });
    });
  });

  describe('createReview', () => {
    it('should create review and update package rating', async () => {
      const purchase = {
        id: 'purchase_123',
        packageId: 'pkg_123',
        customerId: 'customer_123',
      };

      const createdReview = {
        id: 'review_123',
        packageId: 'pkg_123',
        reviewerId: 'customer_123',
        rating: 5,
        isVerifiedPurchase: true,
      };

      const existingReviews = [
        { rating: 4 },
        { rating: 5 },
        { rating: 5 },
      ];

      (mockPrisma.packagePurchase.findFirst as jest.Mock).mockResolvedValue(purchase);
      (mockPrisma.packageReview.create as jest.Mock).mockResolvedValue(createdReview);
      (mockPrisma.packageReview.findMany as jest.Mock).mockResolvedValue(existingReviews);
      (mockPrisma.package.update as jest.Mock).mockResolvedValue({});

      const result = await service.createReview('pkg_123', 'customer_123', 5, 'Great!', 'Excellent package');

      expect(mockPrisma.packageReview.create).toHaveBeenCalledWith({
        data: {
          packageId: 'pkg_123',
          reviewerId: 'customer_123',
          rating: 5,
          title: 'Great!',
          content: 'Excellent package',
          isVerifiedPurchase: true,
        },
      });

      // Should update average rating
      expect(mockPrisma.package.update).toHaveBeenCalledWith({
        where: { id: 'pkg_123' },
        data: {
          averageRating: 4.666666666666667, // (4+5+5)/3
          totalReviews: 3,
        },
      });

      expect(result).toEqual(createdReview);
    });
  });
});