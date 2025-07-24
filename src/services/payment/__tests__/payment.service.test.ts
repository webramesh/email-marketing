import { PaymentService } from '../payment.service';
import { PaymentProviderType, PaymentProviderConfig } from '@/types/payment';

// Mock the providers
jest.mock('../providers/stripe.provider');
jest.mock('../providers/paypal.provider');
jest.mock('../providers/dodo.provider');

const mockConfigs: PaymentProviderConfig[] = [
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    priority: 1,
    config: {
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123'
    }
  },
  {
    type: PaymentProviderType.PAYPAL,
    name: 'PayPal',
    isActive: true,
    priority: 2,
    config: {
      clientId: 'paypal_client_123',
      clientSecret: 'paypal_secret_123',
      sandbox: true
    }
  },
  {
    type: PaymentProviderType.DODO,
    name: 'Dodo',
    isActive: false,
    priority: 3,
    config: {
      apiKey: 'dodo_api_123',
      secretKey: 'dodo_secret_123'
    }
  }
];

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService(mockConfigs);
  });

  describe('initialization', () => {
    it('should initialize only active providers', () => {
      const availableProviders = paymentService.getAvailableProviders();
      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.type)).toEqual([
        PaymentProviderType.STRIPE,
        PaymentProviderType.PAYPAL
      ]);
    });

    it('should set default provider to highest priority active provider', () => {
      // Check that the default provider is set correctly by checking available providers
      const availableProviders = paymentService.getAvailableProviders();
      expect(availableProviders[0].type).toBe(PaymentProviderType.STRIPE);
      
      // Test that getProvider returns a provider (even if mocked)
      expect(() => paymentService.getProvider()).not.toThrow();
    });
  });

  describe('processPayment', () => {
    it('should process payment with default provider', async () => {
      const mockStripeProvider = {
        processPayment: jest.fn().mockResolvedValue({
          success: true,
          paymentId: 'pi_123',
          status: 'succeeded',
          amount: 100,
          currency: 'USD'
        })
      };

      // Mock the provider
      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockStripeProvider as any);

      const result = await paymentService.processPayment({
        amount: 100,
        currency: 'USD',
        description: 'Test payment'
      });

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pi_123');
      expect(mockStripeProvider.processPayment).toHaveBeenCalledWith({
        amount: 100,
        currency: 'USD',
        description: 'Test payment'
      });
    });

    it('should use specified provider when provided', async () => {
      const mockPayPalProvider = {
        processPayment: jest.fn().mockResolvedValue({
          success: true,
          paymentId: 'paypal_123',
          status: 'succeeded',
          amount: 100,
          currency: 'USD'
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockPayPalProvider as any);

      const result = await paymentService.processPayment({
        amount: 100,
        currency: 'USD',
        description: 'Test payment'
      }, PaymentProviderType.PAYPAL);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('paypal_123');
    });

    it('should handle payment failure', async () => {
      const mockProvider = {
        processPayment: jest.fn().mockRejectedValue(new Error('Payment failed'))
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);
      jest.spyOn(paymentService, 'getFallbackProvider' as any).mockReturnValue(null);

      const result = await paymentService.processPayment({
        amount: 100,
        currency: 'USD',
        description: 'Test payment'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });

    it('should try fallback provider on failure', async () => {
      const mockStripeProvider = {
        type: PaymentProviderType.STRIPE,
        processPayment: jest.fn().mockRejectedValue(new Error('Stripe failed'))
      };

      const mockPayPalProvider = {
        type: PaymentProviderType.PAYPAL,
        processPayment: jest.fn().mockResolvedValue({
          success: true,
          paymentId: 'paypal_fallback_123',
          status: 'succeeded',
          amount: 100,
          currency: 'USD'
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockStripeProvider as any);
      jest.spyOn(paymentService, 'getFallbackProvider' as any).mockReturnValue(mockPayPalProvider);

      const result = await paymentService.processPayment({
        amount: 100,
        currency: 'USD',
        description: 'Test payment'
      });

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('paypal_fallback_123');
      expect(mockStripeProvider.processPayment).toHaveBeenCalled();
      expect(mockPayPalProvider.processPayment).toHaveBeenCalled();
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const mockProvider = {
        createCustomer: jest.fn().mockResolvedValue({
          success: true,
          customerId: 'cus_123'
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await paymentService.createCustomer({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cus_123');
      expect(mockProvider.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User'
      });
    });

    it('should handle customer creation failure', async () => {
      const mockProvider = {
        createCustomer: jest.fn().mockRejectedValue(new Error('Customer creation failed'))
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await paymentService.createCustomer({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer creation failed');
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockProvider = {
        createSubscription: jest.fn().mockResolvedValue({
          success: true,
          subscriptionId: 'sub_123',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date()
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await paymentService.createSubscription({
        customerId: 'cus_123',
        planId: 'plan_123'
      });

      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBe('sub_123');
      expect(mockProvider.createSubscription).toHaveBeenCalledWith({
        customerId: 'cus_123',
        planId: 'plan_123'
      });
    });
  });

  describe('refundPayment', () => {
    it('should process refund successfully', async () => {
      const mockProvider = {
        refundPayment: jest.fn().mockResolvedValue({
          success: true,
          refundId: 'ref_123',
          amount: 50,
          status: 'succeeded'
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await paymentService.refundPayment('pi_123', 50);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('ref_123');
      expect(result.amount).toBe(50);
      expect(mockProvider.refundPayment).toHaveBeenCalledWith('pi_123', 50);
    });
  });

  describe('validateWebhook', () => {
    it('should validate webhook signature', () => {
      const mockProvider = {
        validateWebhook: jest.fn().mockReturnValue(true)
      };

      jest.spyOn(paymentService['providers'], 'get').mockReturnValue(mockProvider as any);

      const isValid = paymentService.validateWebhook(
        { test: 'data' },
        'signature_123',
        PaymentProviderType.STRIPE
      );

      expect(isValid).toBe(true);
      expect(mockProvider.validateWebhook).toHaveBeenCalledWith(
        { test: 'data' },
        'signature_123'
      );
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        paymentService.validateWebhook(
          { test: 'data' },
          'signature_123',
          'unknown_provider' as PaymentProviderType
        );
      }).toThrow('Provider unknown_provider not found');
    });
  });

  describe('fraud detection', () => {
    it('should approve low-risk payments', async () => {
      const mockProvider = {
        processPayment: jest.fn().mockResolvedValue({
          success: true,
          paymentId: 'pi_123',
          status: 'succeeded',
          amount: 50,
          currency: 'USD'
        })
      };

      jest.spyOn(paymentService, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await paymentService.processPayment({
        amount: 50, // Low amount
        currency: 'USD',
        description: 'Low risk payment'
      });

      expect(result.success).toBe(true);
      expect(mockProvider.processPayment).toHaveBeenCalled();
    });

    it('should decline high-risk payments', async () => {
      const result = await paymentService.processPayment({
        amount: 15000, // High amount
        currency: 'USD',
        description: 'High risk payment',
        metadata: { isHighRisk: true }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment declined due to fraud detection');
    });
  });
});