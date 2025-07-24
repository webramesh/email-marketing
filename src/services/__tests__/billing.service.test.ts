import { BillingService } from '../billing.service';
import { SubscriptionService, TenantSubscription, Invoice } from '../subscription.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentProviderType, PaymentStatus } from '@/types/payment';

// Mock the services
jest.mock('../payment/payment.service');
jest.mock('../subscription.service');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    billingCycle: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    overageBilling: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    tenantSubscription: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('BillingService', () => {
  let billingService: BillingService;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockSubscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(() => {
    mockPaymentService = new PaymentService([]) as jest.Mocked<PaymentService>;
    mockSubscriptionService = new SubscriptionService(mockPaymentService) as jest.Mocked<SubscriptionService>;
    billingService = new BillingService(mockPaymentService, mockSubscriptionService);
    jest.clearAllMocks();
  });

  describe('processBillingCycles', () => {
    it('should process due billing cycles successfully', async () => {
      const mockBillingCycle = {
        id: 'cycle_123',
        subscriptionId: 'sub_123',
        cycleStart: new Date('2024-01-01'),
        cycleEnd: new Date('2024-01-31'),
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscription: {
          tenantId: 'tenant_123',
          plan: {
            name: 'Pro Plan',
            price: 99.99,
            currency: 'USD'
          }
        }
      };

      const { prisma } = require('@/lib/prisma');
      prisma.billingCycle.findMany.mockResolvedValue([mockBillingCycle]);

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'plan_123',
        plan: {
          id: 'plan_123',
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
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        cancelAtPeriodEnd: false,
        customerId: 'cust_123',
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

      mockSubscriptionService.getTenantSubscription.mockResolvedValue(mockSubscription);
      mockSubscriptionService.generateInvoice.mockResolvedValue({
        id: 'inv_123',
        tenantId: 'tenant_123',
        subscriptionId: 'sub_123',
        invoiceNumber: 'INV-001',
        status: 'open',
        currency: 'USD',
        subtotal: 99.99,
        taxAmount: 8.00,
        discountAmount: 0,
        total: 107.99,
        amountPaid: 0,
        amountDue: 107.99,
        dueDate: new Date('2024-02-15'),
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        lineItems: [],
        paymentProvider: PaymentProviderType.STRIPE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'pay_123',
        status: PaymentStatus.SUCCEEDED,
        amount: 107.99,
        currency: 'USD'
      });

      await billingService.processBillingCycles();

      expect(prisma.billingCycle.findMany).toHaveBeenCalled();
      expect(mockSubscriptionService.getTenantSubscription).toHaveBeenCalledWith('tenant_123');
      expect(mockSubscriptionService.generateInvoice).toHaveBeenCalled();
      expect(mockPaymentService.processPayment).toHaveBeenCalled();
    });

    it('should handle billing cycle failures gracefully', async () => {
      const mockBillingCycle = {
        id: 'cycle_123',
        subscriptionId: 'sub_123',
        cycleStart: new Date('2024-01-01'),
        cycleEnd: new Date('2024-01-31'),
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscription: {
          tenantId: 'tenant_123',
          plan: {
            name: 'Pro Plan',
            price: 99.99,
            currency: 'USD'
          }
        }
      };

      const { prisma } = require('@/lib/prisma');
      prisma.billingCycle.findMany.mockResolvedValue([mockBillingCycle]);

      // Mock subscription service to throw an error
      mockSubscriptionService.getTenantSubscription.mockRejectedValue(new Error('Subscription not found'));

      await billingService.processBillingCycles();

      expect(prisma.billingCycle.update).toHaveBeenCalledWith({
        where: { id: 'cycle_123' },
        data: {
          status: 'FAILED',
          failureReason: 'Subscription not found',
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('processInvoicePayment', () => {
    it('should process invoice payment successfully', async () => {
      const mockInvoice: Invoice = {
        id: 'inv_123',
        tenantId: 'tenant_123',
        subscriptionId: 'sub_123',
        invoiceNumber: 'INV-001',
        status: 'open',
        currency: 'USD',
        subtotal: 99.99,
        taxAmount: 8.00,
        discountAmount: 0,
        total: 107.99,
        amountPaid: 0,
        amountDue: 107.99,
        dueDate: new Date('2024-02-15'),
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        lineItems: [],
        paymentProvider: PaymentProviderType.STRIPE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'plan_123',
        plan: {
          id: 'plan_123',
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
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        cancelAtPeriodEnd: false,
        customerId: 'cust_123',
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

      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'pay_123',
        status: PaymentStatus.SUCCEEDED,
        amount: 107.99,
        currency: 'USD'
      });

      const result = await billingService.processInvoicePayment(mockInvoice, mockSubscription);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay_123');
      expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 107.99,
          currency: 'USD',
          customerId: 'cust_123',
          description: 'Invoice INV-001'
        }),
        PaymentProviderType.STRIPE
      );
    });

    it('should handle payment failures', async () => {
      const mockInvoice: Invoice = {
        id: 'inv_123',
        tenantId: 'tenant_123',
        subscriptionId: 'sub_123',
        invoiceNumber: 'INV-001',
        status: 'open',
        currency: 'USD',
        subtotal: 99.99,
        taxAmount: 8.00,
        discountAmount: 0,
        total: 107.99,
        amountPaid: 0,
        amountDue: 107.99,
        dueDate: new Date('2024-02-15'),
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        lineItems: [],
        paymentProvider: PaymentProviderType.STRIPE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId: 'tenant_123',
        planId: 'plan_123',
        plan: {
          id: 'plan_123',
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
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        cancelAtPeriodEnd: false,
        customerId: 'cust_123',
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

      mockPaymentService.processPayment.mockResolvedValue({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: 107.99,
        currency: 'USD',
        error: 'Insufficient funds'
      });

      const result = await billingService.processInvoicePayment(mockInvoice, mockSubscription);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });
  });

  describe('generateBillingReport', () => {
    it('should generate comprehensive billing report', async () => {
      const tenantId = 'tenant_123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_123',
        plan: {
          id: 'plan_123',
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
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        cancelAtPeriodEnd: false,
        customerId: 'cust_123',
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

      const mockInvoices = [
        {
          id: 'inv_1',
          status: 'PAID',
          total: 107.99,
          amountPaid: 107.99,
          dueDate: new Date('2024-01-15'),
          paidAt: new Date('2024-01-15'),
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
          payments: []
        },
        {
          id: 'inv_2',
          status: 'OPEN',
          total: 107.99,
          amountPaid: 0,
          dueDate: new Date('2024-01-31'),
          paidAt: null,
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
          payments: []
        }
      ];

      const mockOverages = [
        {
          id: 'overage_1',
          overageAmount: 1000,
          unitPrice: 0.001
        }
      ];

      mockSubscriptionService.getTenantSubscription.mockResolvedValue(mockSubscription);

      const { prisma } = require('@/lib/prisma');
      prisma.invoice.findMany.mockResolvedValue(mockInvoices);
      prisma.overageBilling.findMany.mockResolvedValue(mockOverages);

      const report = await billingService.generateBillingReport(tenantId, startDate, endDate);

      expect(report.totalRevenue).toBe(107.99);
      expect(report.invoicesGenerated).toBe(2);
      expect(report.paymentSuccessRate).toBe(50); // 1 out of 2 paid
      expect(report.overageCharges).toBe(1.0); // 1000 * 0.001
      expect(report.failedPayments).toBe(0);
      expect(report.details).toHaveLength(2);
    });
  });

  describe('processOverageBilling', () => {
    it('should process overage billing for tenant', async () => {
      const tenantId = 'tenant_123';

      const mockSubscription: TenantSubscription = {
        id: 'sub_123',
        tenantId,
        planId: 'plan_123',
        plan: {
          id: 'plan_123',
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
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'),
        cancelAtPeriodEnd: false,
        customerId: 'cust_123',
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

      const mockOverages = [
        {
          id: 'overage_1',
          subscriptionId: 'sub_123',
          resourceType: 'emails',
          quotaLimit: 50000,
          actualUsage: 60000,
          overageAmount: 10000,
          unitPrice: 0.001,
          billingPeriodStart: new Date('2024-01-01'),
          billingPeriodEnd: new Date('2024-01-31'),
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockSubscriptionService.getTenantSubscription.mockResolvedValue(mockSubscription);

      const { prisma } = require('@/lib/prisma');
      prisma.overageBilling.findMany.mockResolvedValue(mockOverages);

      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'pay_overage_123',
        status: PaymentStatus.SUCCEEDED,
        amount: 1.0,
        currency: 'USD'
      });

      await billingService.processOverageBilling(tenantId);

      expect(mockSubscriptionService.getTenantSubscription).toHaveBeenCalledWith(tenantId);
      expect(prisma.overageBilling.findMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: 'sub_123',
          status: 'PENDING'
        }
      });
    });
  });
});