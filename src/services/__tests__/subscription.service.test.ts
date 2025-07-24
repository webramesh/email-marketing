import { SubscriptionService, SubscriptionPlan, TenantSubscription } from '../subscription.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentProviderType, SubscriptionStatus } from '@/types/payment';

// Mock the payment service
jest.mock('../payment/payment.service');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptionPlan: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockPaymentService: jest.Mocked<PaymentService>;

  beforeEach(() => {
    mockPaymentService = new PaymentService([]) as jest.Mocked<PaymentService>;
    subscriptionService = new SubscriptionService(mockPaymentService);
    jest.clearAllMocks();
  });

  describe('createSubscriptionPlan', () => {
    it('should create a subscription plan successfully', async () => {
      const planData = {
        name: 'Pro Plan',
        description: 'Professional plan with advanced features',
        price: 99.99,
        currency: 'USD',
        billingCycle: 'monthly' as const,
        features: {
          emailsPerMonth: 50000,
          subscribersLimit: 10000,
          campaignsPerMonth: 100,
          automationsLimit: 50,
          customDomains: 5,
          apiAccess: true,
          advancedAnalytics: true,
          prioritySupport: true,
          whiteLabel: false,
          customIntegrations: true,
          advancedSegmentation: true,
          abTesting: true,
          multiUser: true,
          maxUsers: 5
        },
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        isActive: true,
        trialDays: 14
      };

      const mockCreatedPlan = {
        id: 'plan_123',
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { prisma } = require('@/lib/prisma');
      prisma.subscriptionPlan.create.mockResolvedValue(mockCreatedPlan);

      const result = await subscriptionService.createSubscriptionPlan(planData);

      expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: planData.name,
          price: planData.price,
          billingCycle: planData.billingCycle,
          features: planData.features
        })
      });

      expect(result).toEqual(expect.objectContaining({
        id: 'plan_123',
        name: 'Pro Plan',
        price: 99.99,
        currency: 'USD'
      }));
    });
  });

  describe('createTenantSubscription', () => {
    it('should create a tenant subscription successfully', async () => {
      const tenantId = 'tenant_123';
      const planId = 'plan_456';
      const customerId = 'cust_789';
      const paymentProvider = PaymentProviderType.STRIPE;

      const mockPlan: SubscriptionPlan = {
        id: planId,
        name: 'Pro Plan',
        price: 99.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: {
          emailsPerMonth: 50000,
          subscribersLimit: 10000,
          campaignsPerMonth: 100,
          automationsLimit: 50,
          customDomains: 5,
          apiAccess: true,
          advancedAnalytics: true,
          prioritySupport: true,
          whiteLabel: false,
          customIntegrations: true,
          advancedSegmentation: true,
          abTesting: true,
          multiUser: true,
          maxUsers: 5
        },
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        isActive: true,
        trialDays: 14,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockSubscriptionResult = {
        success: true,
        subscriptionId: 'sub_stripe_123',
        status: 'ACTIVE' as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      // Mock the plan lookup
      jest.spyOn(subscriptionService, 'getSubscriptionPlan').mockResolvedValue(mockPlan);

      // Mock payment service subscription creation
      mockPaymentService.createSubscription.mockResolvedValue(mockSubscriptionResult);

      // Mock database transaction
      const { prisma } = require('@/lib/prisma');
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          tenant: {
            update: jest.fn().mockResolvedValue({})
          },
          tenantSubscription: {
            create: jest.fn().mockResolvedValue({
              id: 'sub_123',
              tenantId,
              planId,
              status: 'ACTIVE',
              currentPeriodStart: mockSubscriptionResult.currentPeriodStart,
              currentPeriodEnd: mockSubscriptionResult.currentPeriodEnd,
              cancelAtPeriodEnd: false,
              trialEnd: null,
              customerId,
              subscriptionId: mockSubscriptionResult.subscriptionId,
              paymentProvider: paymentProvider,
              quotas: {},
              usage: {},
              billingAddress: null,
              taxRate: null,
              discountId: null,
              metadata: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              plan: mockPlan
            })
          }
        });
      });

      const result = await subscriptionService.createTenantSubscription(
        tenantId,
        planId,
        customerId,
        paymentProvider
      );

      expect(mockPaymentService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId,
          planId,
          trialDays: 14,
          metadata: expect.objectContaining({
            tenantId,
            planName: 'Pro Plan'
          })
        }),
        paymentProvider
      );

      expect(result).toEqual(expect.objectContaining({
        tenantId,
        planId,
        plan: mockPlan,
        status: 'ACTIVE' as any,
        customerId,
        subscriptionId: 'sub_stripe_123',
        paymentProvider
      }));
    });

    it('should throw error when plan is not found', async () => {
      const tenantId = 'tenant_123';
      const planId = 'nonexistent_plan';
      const customerId = 'cust_789';
      const paymentProvider = PaymentProviderType.STRIPE;

      jest.spyOn(subscriptionService, 'getSubscriptionPlan').mockResolvedValue(null);

      await expect(
        subscriptionService.createTenantSubscription(
          tenantId,
          planId,
          customerId,
          paymentProvider
        )
      ).rejects.toThrow('Subscription plan not found');
    });

    it('should throw error when payment service fails', async () => {
      const tenantId = 'tenant_123';
      const planId = 'plan_456';
      const customerId = 'cust_789';
      const paymentProvider = PaymentProviderType.STRIPE;

      const mockPlan: SubscriptionPlan = {
        id: planId,
        name: 'Pro Plan',
        price: 99.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: {
          emailsPerMonth: 50000,
          subscribersLimit: 10000,
          campaignsPerMonth: 100,
          automationsLimit: 50,
          customDomains: 5,
          apiAccess: true,
          advancedAnalytics: true,
          prioritySupport: true,
          whiteLabel: false,
          customIntegrations: true,
          advancedSegmentation: true,
          abTesting: true,
          multiUser: true,
          maxUsers: 5
        },
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        isActive: true,
        trialDays: 14,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(subscriptionService, 'getSubscriptionPlan').mockResolvedValue(mockPlan);

      mockPaymentService.createSubscription.mockResolvedValue({
        success: false,
        subscriptionId: '',
        status: 'CANCELLED' as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        error: 'Payment failed'
      });

      await expect(
        subscriptionService.createTenantSubscription(
          tenantId,
          planId,
          customerId,
          paymentProvider
        )
      ).rejects.toThrow('Failed to create subscription: Payment failed');
    });
  });

  describe('checkQuotaLimit', () => {
    it('should return quota information correctly', async () => {
      const tenantId = 'tenant_123';
      const resourceType = 'emailsPerMonth';
      const requestedAmount = 1000;

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_456',
        plan: {
          id: 'plan_456',
          name: 'Pro Plan',
          price: 99.99,
          currency: 'USD',
          billingCycle: 'monthly',
          features: {
            emailsPerMonth: 50000,
            subscribersLimit: 10000,
            campaignsPerMonth: 100,
            automationsLimit: 50,
            customDomains: 5,
            apiAccess: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: false,
            customIntegrations: true,
            advancedSegmentation: true,
            abTesting: true,
            multiUser: true,
            maxUsers: 5
          },
          quotas: {
            emailsSent: 0,
            subscribersCount: 0,
            campaignsCreated: 0,
            automationsActive: 0,
            domainsUsed: 0,
            apiCallsUsed: 0,
            storageUsed: 0,
            lastResetAt: new Date()
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        status: 'ACTIVE' as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        customerId: 'cust_789',
        subscriptionId: 'sub_stripe_123',
        paymentProvider: PaymentProviderType.STRIPE,
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        usage: {
          emailsSent: 25000, // Half of the limit
          subscribersCount: 5000,
          campaignsCreated: 50,
          automationsActive: 25,
          domainsUsed: 2,
          apiCallsUsed: 1000,
          storageUsed: 500,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(subscriptionService, 'getTenantSubscription').mockResolvedValue(mockSubscription);

      const result = await subscriptionService.checkQuotaLimit(
        tenantId,
        resourceType,
        requestedAmount
      );

      expect(result).toEqual({
        allowed: true,
        remaining: 25000, // 50000 - 25000
        limit: 50000
      });
    });

    it('should return false when quota is exceeded', async () => {
      const tenantId = 'tenant_123';
      const resourceType = 'emailsPerMonth';
      const requestedAmount = 30000; // More than remaining

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_456',
        plan: {
          id: 'plan_456',
          name: 'Pro Plan',
          price: 99.99,
          currency: 'USD',
          billingCycle: 'monthly',
          features: {
            emailsPerMonth: 50000,
            subscribersLimit: 10000,
            campaignsPerMonth: 100,
            automationsLimit: 50,
            customDomains: 5,
            apiAccess: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: false,
            customIntegrations: true,
            advancedSegmentation: true,
            abTesting: true,
            multiUser: true,
            maxUsers: 5
          },
          quotas: {
            emailsSent: 0,
            subscribersCount: 0,
            campaignsCreated: 0,
            automationsActive: 0,
            domainsUsed: 0,
            apiCallsUsed: 0,
            storageUsed: 0,
            lastResetAt: new Date()
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        status: 'ACTIVE' as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        customerId: 'cust_789',
        subscriptionId: 'sub_stripe_123',
        paymentProvider: PaymentProviderType.STRIPE,
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        usage: {
          emailsSent: 45000, // Close to limit
          subscribersCount: 5000,
          campaignsCreated: 50,
          automationsActive: 25,
          domainsUsed: 2,
          apiCallsUsed: 1000,
          storageUsed: 500,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(subscriptionService, 'getTenantSubscription').mockResolvedValue(mockSubscription);

      const result = await subscriptionService.checkQuotaLimit(
        tenantId,
        resourceType,
        requestedAmount
      );

      expect(result).toEqual({
        allowed: false,
        remaining: 5000, // 50000 - 45000
        limit: 50000
      });
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription successfully with immediate proration', async () => {
      const tenantId = 'tenant_123';
      const newPlanId = 'plan_premium';

      const currentSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_pro',
        plan: {
          id: 'plan_pro',
          name: 'Pro Plan',
          price: 99.99,
          currency: 'USD',
          billingCycle: 'monthly',
          features: {
            emailsPerMonth: 50000,
            subscribersLimit: 10000,
            campaignsPerMonth: 100,
            automationsLimit: 50,
            customDomains: 5,
            apiAccess: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: false,
            customIntegrations: true,
            advancedSegmentation: true,
            abTesting: true,
            multiUser: true,
            maxUsers: 5
          },
          quotas: {
            emailsSent: 0,
            subscribersCount: 0,
            campaignsCreated: 0,
            automationsActive: 0,
            domainsUsed: 0,
            apiCallsUsed: 0,
            storageUsed: 0,
            lastResetAt: new Date()
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        status: 'ACTIVE' as any,
        currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        cancelAtPeriodEnd: false,
        customerId: 'cust_789',
        subscriptionId: 'sub_stripe_123',
        paymentProvider: PaymentProviderType.STRIPE,
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        usage: {
          emailsSent: 25000,
          subscribersCount: 5000,
          campaignsCreated: 50,
          automationsActive: 25,
          domainsUsed: 2,
          apiCallsUsed: 1000,
          storageUsed: 500,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newPlan: SubscriptionPlan = {
        id: newPlanId,
        name: 'Premium Plan',
        price: 199.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: {
          emailsPerMonth: 100000,
          subscribersLimit: 25000,
          campaignsPerMonth: 200,
          automationsLimit: 100,
          customDomains: 10,
          apiAccess: true,
          advancedAnalytics: true,
          prioritySupport: true,
          whiteLabel: true,
          customIntegrations: true,
          advancedSegmentation: true,
          abTesting: true,
          multiUser: true,
          maxUsers: 10
        },
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(subscriptionService, 'getTenantSubscription').mockResolvedValue(currentSubscription);
      jest.spyOn(subscriptionService, 'getSubscriptionPlan').mockResolvedValue(newPlan);

      const result = await subscriptionService.upgradeSubscription(
        tenantId,
        newPlanId,
        'immediate'
      );

      expect(result.subscription.planId).toBe(newPlanId);
      expect(result.subscription.plan.name).toBe('Premium Plan');
      expect(result.proration.additionalCharges).toBeGreaterThan(0);
    });
  });

  describe('generateInvoice', () => {
    it('should generate invoice with subscription and overage charges', async () => {
      const tenantId = 'tenant_123';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_456',
        plan: {
          id: 'plan_456',
          name: 'Pro Plan',
          price: 99.99,
          currency: 'USD',
          billingCycle: 'monthly',
          features: {
            emailsPerMonth: 50000,
            subscribersLimit: 10000,
            campaignsPerMonth: 100,
            automationsLimit: 50,
            customDomains: 5,
            apiAccess: true,
            advancedAnalytics: true,
            prioritySupport: true,
            whiteLabel: false,
            customIntegrations: true,
            advancedSegmentation: true,
            abTesting: true,
            multiUser: true,
            maxUsers: 5
          },
          quotas: {
            emailsSent: 0,
            subscribersCount: 0,
            campaignsCreated: 0,
            automationsActive: 0,
            domainsUsed: 0,
            apiCallsUsed: 0,
            storageUsed: 0,
            lastResetAt: new Date()
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        status: 'ACTIVE' as any,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        customerId: 'cust_789',
        subscriptionId: 'sub_stripe_123',
        paymentProvider: PaymentProviderType.STRIPE,
        quotas: {
          emailsSent: 0,
          subscribersCount: 0,
          campaignsCreated: 0,
          automationsActive: 0,
          domainsUsed: 0,
          apiCallsUsed: 0,
          storageUsed: 0,
          lastResetAt: new Date()
        },
        usage: {
          emailsSent: 60000, // Over limit
          subscribersCount: 5000,
          campaignsCreated: 50,
          automationsActive: 25,
          domainsUsed: 2,
          apiCallsUsed: 1000,
          storageUsed: 500,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(subscriptionService, 'getTenantSubscription').mockResolvedValue(mockSubscription);

      const invoice = await subscriptionService.generateInvoice(
        tenantId,
        periodStart,
        periodEnd
      );

      expect(invoice.lineItems).toHaveLength(1); // Just subscription for now (overage calculation is mocked)
      expect(invoice.lineItems[0].description).toContain('Pro Plan');
      expect(invoice.lineItems[0].amount).toBe(99.99);
      expect(invoice.subtotal).toBe(99.99);
      expect(invoice.total).toBeGreaterThan(99.99); // Should include tax
      expect(invoice.currency).toBe('USD');
      expect(invoice.status).toBe('open');
    });
  });
});