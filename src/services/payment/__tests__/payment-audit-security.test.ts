import { PaymentService } from '../payment.service';
import { PaymentAuditLogger } from '../audit-logger.service';
import { FraudDetectionService } from '../fraud-detection.service';
import { PaymentSecurityService } from '../payment-security.service';
import { 
  PaymentProviderType, 
  PaymentAuditType, 
  PaymentStatus,
  PaymentRequest 
} from '@/types/payment';

// Mock the services
jest.mock('../audit-logger.service');
jest.mock('../fraud-detection.service');
jest.mock('../payment-security.service');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn()
    }
  }
}));

describe('Payment Audit and Security', () => {
  let paymentService: PaymentService;
  let mockAuditLogger: jest.Mocked<PaymentAuditLogger>;
  let mockFraudDetection: jest.Mocked<FraudDetectionService>;
  let mockSecurityService: jest.Mocked<PaymentSecurityService>;

  const mockConfigs = [
    {
      type: PaymentProviderType.STRIPE,
      name: 'Stripe',
      isActive: true,
      config: { apiKey: 'test_key' },
      priority: 1
    }
  ];

  const mockContext = {
    tenantId: 'tenant_123',
    userId: 'user_456',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    deviceFingerprint: {
      deviceId: 'device_789',
      browserFingerprint: 'browser_abc'
    },
    geoLocation: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
      timezone: 'America/Los_Angeles',
      isp: 'Test ISP',
      organization: 'Test Org',
      asn: 'AS12345',
      isVpn: false,
      isProxy: false,
      isTor: false,
      threatLevel: 'low' as const
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockAuditLogger = {
      logPaymentEvent: jest.fn(),
      verifyAuditRecord: jest.fn(),
      getAuditTrail: jest.fn(),
      generateComplianceReport: jest.fn()
    } as any;

    mockFraudDetection = {
      performFraudCheck: jest.fn(),
      getFraudStatistics: jest.fn(),
      updateFraudRules: jest.fn()
    } as any;

    mockSecurityService = {
      tokenizeCard: jest.fn(),
      performPCIComplianceCheck: jest.fn(),
      performSecurityAudit: jest.fn(),
      validatePaymentMethod: jest.fn(),
      encryptPaymentData: jest.fn(),
      decryptPaymentData: jest.fn()
    } as any;

    // Mock static getInstance methods
    (PaymentAuditLogger.getInstance as jest.Mock).mockReturnValue(mockAuditLogger);
    (FraudDetectionService.getInstance as jest.Mock).mockReturnValue(mockFraudDetection);
    (PaymentSecurityService.getInstance as jest.Mock).mockReturnValue(mockSecurityService);

    paymentService = new PaymentService(mockConfigs);
    
    // Mock the provider classes after initialization
    const mockStripeProvider = {
      name: 'Stripe',
      type: PaymentProviderType.STRIPE,
      processPayment: jest.fn(),
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      refundPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      validateWebhook: jest.fn()
    };

    // Override the providers map to include our mock
    (paymentService as any).providers.set(PaymentProviderType.STRIPE, mockStripeProvider);
    (paymentService as any).defaultProvider = PaymentProviderType.STRIPE;
  });

  describe('Payment Processing with Audit and Security', () => {
    it('should perform fraud check and log payment event', async () => {
      const paymentRequest: PaymentRequest = {
        amount: 1000,
        currency: 'USD',
        customerId: 'cust_123',
        paymentMethodId: 'pm_456',
        description: 'Test payment'
      };

      const mockFraudResult = {
        riskScore: 25,
        riskLevel: 'low' as const,
        checks: {
          cvv: true,
          address: true,
          postalCode: true
        },
        recommendation: 'approve' as const,
        reasons: ['Low risk transaction'],
        timestamp: new Date()
      };

      const mockPaymentResult = {
        success: true,
        paymentId: 'pay_789',
        status: PaymentStatus.SUCCEEDED,
        amount: 1000,
        currency: 'USD'
      };

      mockFraudDetection.performFraudCheck.mockResolvedValue(mockFraudResult);

      // Mock the provider's processPayment method
      const mockProvider = {
        processPayment: jest.fn().mockResolvedValue(mockPaymentResult),
        type: PaymentProviderType.STRIPE,
        name: 'Stripe'
      };

      // Override getProvider to return our mock
      jest.spyOn(paymentService as any, 'getProvider').mockReturnValue(mockProvider);

      const result = await paymentService.processPayment(paymentRequest, mockContext);

      // Verify fraud check was performed
      expect(mockFraudDetection.performFraudCheck).toHaveBeenCalledWith(
        paymentRequest,
        mockContext
      );

      // Verify payment was processed
      expect(mockProvider.processPayment).toHaveBeenCalledWith(paymentRequest);

      // Verify audit log was created
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.PAYMENT_CREATED,
        provider: PaymentProviderType.STRIPE,
        paymentId: 'pay_789',
        customerId: 'cust_123',
        amount: 1000,
        currency: 'USD',
        status: 'success',
        fraudScore: 25,
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          fraudLevel: 'low',
          fraudRecommendation: 'approve',
          providerResponse: 'none',
          errorMessage: undefined
        },
        sensitiveData: {
          paymentMethodId: 'pm_456',
          description: 'Test payment',
          idempotencyKey: undefined
        }
      });

      expect(result).toEqual(mockPaymentResult);
    });

    it('should decline payment and log fraud detection when high risk', async () => {
      const paymentRequest: PaymentRequest = {
        amount: 50000,
        currency: 'USD',
        customerId: 'cust_123'
      };

      const mockFraudResult = {
        riskScore: 85,
        riskLevel: 'high' as const,
        checks: {
          cvv: true,
          address: true,
          postalCode: true
        },
        recommendation: 'decline' as const,
        reasons: ['Very high transaction amount', 'Suspicious IP'],
        timestamp: new Date()
      };

      mockFraudDetection.performFraudCheck.mockResolvedValue(mockFraudResult);

      const result = await paymentService.processPayment(paymentRequest, mockContext);

      // Verify fraud detection was logged
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.FRAUD_DETECTED,
        provider: PaymentProviderType.STRIPE,
        amount: 50000,
        currency: 'USD',
        status: 'declined',
        fraudScore: 85,
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          fraudLevel: 'high',
          reasons: ['Very high transaction amount', 'Suspicious IP'],
          recommendation: 'decline'
        }
      });

      // Verify payment was declined
      expect(result).toEqual({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: 50000,
        currency: 'USD',
        error: 'Payment declined due to fraud detection'
      });
    });

    it('should handle payment processing errors and log them', async () => {
      const paymentRequest: PaymentRequest = {
        amount: 1000,
        currency: 'USD'
      };

      const mockFraudResult = {
        riskScore: 15,
        riskLevel: 'low' as const,
        checks: { cvv: true, address: true, postalCode: true },
        recommendation: 'approve' as const,
        reasons: [],
        timestamp: new Date()
      };

      mockFraudDetection.performFraudCheck.mockResolvedValue(mockFraudResult);

      const mockError = new Error('Payment processing failed');
      const mockProvider = {
        processPayment: jest.fn().mockRejectedValue(mockError),
        type: PaymentProviderType.STRIPE,
        name: 'Stripe'
      };

      jest.spyOn(paymentService as any, 'getProvider').mockReturnValue(mockProvider);
      jest.spyOn(paymentService as any, 'getFallbackProvider').mockReturnValue(null);

      const result = await paymentService.processPayment(paymentRequest, mockContext);

      // Verify error was logged
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.PAYMENT_FAILED,
        provider: PaymentProviderType.STRIPE,
        amount: 1000,
        currency: 'USD',
        status: 'error',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          errorMessage: 'Payment processing failed',
          errorStack: expect.any(String)
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment processing failed');
    });
  });

  describe('Customer Creation with Audit', () => {
    it('should validate customer data and log creation', async () => {
      const customerData = {
        email: '  TEST@EXAMPLE.COM  ',
        name: '  John Doe  ',
        phone: '+1-555-123-4567',
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'us'
        }
      };

      const mockResult = {
        success: true,
        customerId: 'cust_789'
      };

      // Get the mock provider from the service
      const mockProvider = (paymentService as any).providers.get(PaymentProviderType.STRIPE);
      mockProvider.createCustomer.mockResolvedValue(mockResult);

      const result = await paymentService.createCustomer(customerData, mockContext);

      // Verify customer data was validated and sanitized
      expect(mockProvider.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'John Doe',
        phone: '+1-555-123-4567',
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US'
        },
        metadata: undefined
      });

      // Verify audit log was created for successful creation
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.CUSTOMER_CREATED,
        provider: PaymentProviderType.STRIPE,
        customerId: 'cust_789',
        status: 'success',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          customerEmail: '  TEST@EXAMPLE.COM  ',
          errorMessage: undefined
        },
        sensitiveData: {
          customerName: '  John Doe  ',
          customerPhone: '+1-555-123-4567',
          customerAddress: expect.any(Object)
        }
      });

      expect(result).toEqual(mockResult);
    });

    it('should reject invalid email addresses', async () => {
      const customerData = {
        email: 'invalid-email',
        name: 'John Doe'
      };

      const result = await paymentService.createCustomer(customerData, mockContext);

      // Verify the result indicates failure
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');

      // Verify error was logged
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.CUSTOMER_CREATED,
        provider: PaymentProviderType.STRIPE,
        status: 'error',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          errorMessage: 'Invalid email format',
          customerEmail: 'invalid-email'
        }
      });
    });
  });

  describe('Payment Method Tokenization', () => {
    it('should tokenize card data securely', async () => {
      const cardData = {
        number: '4111111111111111',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        holderName: 'John Doe'
      };

      const mockTokenizedCard = {
        token: 'tok_123456789',
        last4: '1111',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        fingerprint: 'fp_abcdef123456',
        isValid: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };

      mockSecurityService.tokenizeCard.mockResolvedValue(mockTokenizedCard);

      const result = await paymentService.tokenizePaymentMethod(cardData, mockContext);

      // Verify tokenization was called
      expect(mockSecurityService.tokenizeCard).toHaveBeenCalledWith(cardData);

      // Verify audit log was created
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.PAYMENT_METHOD_ADDED,
        provider: PaymentProviderType.STRIPE,
        status: 'success',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          tokenId: 'tok_123456789',
          cardBrand: 'visa',
          last4: '1111'
        }
      });

      expect(result).toEqual(mockTokenizedCard);
    });

    it('should handle tokenization errors', async () => {
      const cardData = {
        number: '4111111111111111',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        holderName: 'John Doe'
      };

      const mockError = new Error('Invalid card number');
      mockSecurityService.tokenizeCard.mockRejectedValue(mockError);

      await expect(
        paymentService.tokenizePaymentMethod(cardData, mockContext)
      ).rejects.toThrow('Invalid card number');

      // Verify error was logged
      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.PAYMENT_METHOD_ADDED,
        provider: PaymentProviderType.STRIPE,
        status: 'failed',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          errorMessage: 'Invalid card number'
        }
      });
    });
  });

  describe('Compliance and Security Auditing', () => {
    it('should perform PCI DSS compliance check', async () => {
      const mockComplianceResult = {
        isCompliant: true,
        violations: [],
        recommendations: [],
        lastChecked: new Date(),
        nextCheckDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      };

      mockSecurityService.performPCIComplianceCheck.mockResolvedValue(mockComplianceResult);

      const result = await paymentService.performComplianceCheck('tenant_123');

      expect(mockSecurityService.performPCIComplianceCheck).toHaveBeenCalledWith('tenant_123');
      expect(result).toEqual(mockComplianceResult);
    });

    it('should perform security audit', async () => {
      const mockAuditResult = {
        passed: true,
        score: 95,
        findings: [],
        recommendations: [],
        complianceStatus: 'compliant' as const
      };

      mockSecurityService.performSecurityAudit.mockResolvedValue(mockAuditResult);

      const result = await paymentService.performSecurityAudit('tenant_123');

      expect(mockSecurityService.performSecurityAudit).toHaveBeenCalledWith('tenant_123');
      expect(result).toEqual(mockAuditResult);
    });

    it('should get fraud statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockStats = {
        totalTransactions: 1000,
        fraudDetected: 5,
        falsePositives: 2,
        averageRiskScore: 15,
        topFraudReasons: [
          { reason: 'High amount', count: 3 },
          { reason: 'Suspicious IP', count: 2 }
        ],
        riskDistribution: { low: 950, medium: 45, high: 5 },
        preventedLoss: 25000
      };

      mockFraudDetection.getFraudStatistics.mockResolvedValue(mockStats);

      const result = await paymentService.getFraudStatistics('tenant_123', startDate, endDate);

      expect(mockFraudDetection.getFraudStatistics).toHaveBeenCalledWith(
        'tenant_123',
        startDate,
        endDate
      );
      expect(result).toEqual(mockStats);
    });

    it('should verify audit record integrity', async () => {
      const mockVerificationResult = {
        isValid: true,
        errors: [],
        record: {
          id: 'audit_123',
          tenantId: 'tenant_123',
          userId: undefined,
          type: PaymentAuditType.PAYMENT_CREATED,
          provider: PaymentProviderType.STRIPE,
          paymentId: undefined,
          customerId: undefined,
          subscriptionId: undefined,
          amount: undefined,
          currency: undefined,
          status: 'success',
          fraudScore: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          metadata: undefined,
          encryptedData: undefined,
          immutableHash: 'hash_abc123',
          previousHash: undefined,
          blockNumber: 1,
          createdAt: new Date(),
          signature: 'sig_def456'
        }
      };

      mockAuditLogger.verifyAuditRecord.mockResolvedValue(mockVerificationResult);

      const result = await paymentService.verifyAuditRecord('audit_123');

      expect(mockAuditLogger.verifyAuditRecord).toHaveBeenCalledWith('audit_123');
      expect(result).toEqual(mockVerificationResult);
    });

    it('should get audit trail', async () => {
      const filters = {
        tenantId: 'tenant_123',
        paymentId: 'pay_456',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 100
      };

      const mockAuditTrail = [
        {
          id: 'audit_1',
          tenantId: 'tenant_123',
          userId: undefined,
          type: PaymentAuditType.PAYMENT_CREATED,
          provider: PaymentProviderType.STRIPE,
          paymentId: 'pay_456',
          customerId: undefined,
          subscriptionId: undefined,
          amount: undefined,
          currency: undefined,
          status: 'success',
          fraudScore: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          metadata: undefined,
          encryptedData: undefined,
          immutableHash: 'hash_1',
          previousHash: undefined,
          blockNumber: 1,
          createdAt: new Date(),
          signature: 'sig_1'
        },
        {
          id: 'audit_2',
          tenantId: 'tenant_123',
          userId: undefined,
          type: PaymentAuditType.PAYMENT_SUCCEEDED,
          provider: PaymentProviderType.STRIPE,
          paymentId: 'pay_456',
          customerId: undefined,
          subscriptionId: undefined,
          amount: undefined,
          currency: undefined,
          status: 'success',
          fraudScore: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          metadata: undefined,
          encryptedData: undefined,
          immutableHash: 'hash_2',
          previousHash: 'hash_1',
          blockNumber: 2,
          createdAt: new Date(),
          signature: 'sig_2'
        }
      ];

      mockAuditLogger.getAuditTrail.mockResolvedValue(mockAuditTrail);

      const result = await paymentService.getAuditTrail(filters);

      expect(mockAuditLogger.getAuditTrail).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockAuditTrail);
    });

    it('should generate compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockReport = {
        totalTransactions: 1000,
        fraudDetected: 5,
        failedTransactions: 10,
        complianceViolations: [],
        integrityStatus: 'valid' as const,
        reportHash: 'report_hash_123'
      };

      mockAuditLogger.generateComplianceReport.mockResolvedValue(mockReport);

      const result = await paymentService.generateComplianceReport(
        'tenant_123',
        startDate,
        endDate
      );

      expect(mockAuditLogger.generateComplianceReport).toHaveBeenCalledWith(
        'tenant_123',
        startDate,
        endDate
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe('Subscription Management with Audit', () => {
    it('should log subscription creation', async () => {
      const subscriptionRequest = {
        customerId: 'cust_123',
        planId: 'plan_456',
        trialDays: 14,
        metadata: { source: 'web' }
      };

      const mockResult = {
        success: true,
        subscriptionId: 'sub_789',
        status: 'active' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      const mockProvider = {
        createSubscription: jest.fn().mockResolvedValue(mockResult),
        type: PaymentProviderType.STRIPE,
        name: 'Stripe'
      };

      jest.spyOn(paymentService as any, 'getProvider').mockReturnValue(mockProvider);

      const result = await paymentService.createSubscription(
        subscriptionRequest,
        mockContext
      );

      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.SUBSCRIPTION_CREATED,
        provider: PaymentProviderType.STRIPE,
        subscriptionId: 'sub_789',
        customerId: 'cust_123',
        status: 'success',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          planId: 'plan_456',
          trialDays: 14,
          errorMessage: undefined
        },
        sensitiveData: {
          subscriptionMetadata: { source: 'web' }
        }
      });

      expect(result).toEqual(mockResult);
    });

    it('should log subscription cancellation', async () => {
      const mockProvider = {
        cancelSubscription: jest.fn().mockResolvedValue(undefined),
        type: PaymentProviderType.STRIPE,
        name: 'Stripe'
      };

      jest.spyOn(paymentService as any, 'getProvider').mockReturnValue(mockProvider);

      await paymentService.cancelSubscription('sub_789', mockContext);

      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.SUBSCRIPTION_CANCELLED,
        provider: PaymentProviderType.STRIPE,
        subscriptionId: 'sub_789',
        status: 'success',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          action: 'subscription_cancelled'
        }
      });
    });
  });

  describe('Refund Processing with Audit', () => {
    it('should log refund processing', async () => {
      const mockResult = {
        success: true,
        refundId: 'ref_123',
        amount: 500,
        status: 'succeeded' as const
      };

      const mockProvider = {
        refundPayment: jest.fn().mockResolvedValue(mockResult),
        type: PaymentProviderType.STRIPE,
        name: 'Stripe'
      };

      jest.spyOn(paymentService as any, 'getProvider').mockReturnValue(mockProvider);

      const result = await paymentService.refundPayment(
        'pay_456',
        mockContext,
        500
      );

      expect(mockAuditLogger.logPaymentEvent).toHaveBeenCalledWith({
        tenantId: mockContext.tenantId,
        userId: mockContext.userId,
        type: PaymentAuditType.PAYMENT_REFUNDED,
        provider: PaymentProviderType.STRIPE,
        paymentId: 'pay_456',
        amount: 500,
        currency: 'USD',
        status: 'success',
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        metadata: {
          refundId: 'ref_123',
          refundAmount: 500,
          errorMessage: undefined
        }
      });

      expect(result).toEqual(mockResult);
    });
  });
});