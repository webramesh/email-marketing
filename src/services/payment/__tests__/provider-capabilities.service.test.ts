import { ProviderCapabilitiesService } from '../provider-capabilities.service';
import { PaymentProviderType } from '@/types/payment';

describe('ProviderCapabilitiesService', () => {
  describe('getCapabilities', () => {
    it('should return capabilities for Stripe', () => {
      const capabilities = ProviderCapabilitiesService.getCapabilities(PaymentProviderType.STRIPE);
      
      expect(capabilities.supportsSubscriptions).toBe(true);
      expect(capabilities.supportsRefunds).toBe(true);
      expect(capabilities.supportsMultiCurrency).toBe(true);
      expect(capabilities.supportedCurrencies).toContain('USD');
      expect(capabilities.supportedCurrencies).toContain('EUR');
      expect(capabilities.minimumAmount).toBe(0.50);
      expect(capabilities.processingFees.percentage).toBe(2.9);
    });

    it('should return capabilities for PayPal', () => {
      const capabilities = ProviderCapabilitiesService.getCapabilities(PaymentProviderType.PAYPAL);
      
      expect(capabilities.supportsSubscriptions).toBe(true);
      expect(capabilities.supportsInstallments).toBe(false);
      expect(capabilities.minimumAmount).toBe(1.00);
      expect(capabilities.maximumAmount).toBe(10000.00);
      expect(capabilities.processingFees.percentage).toBe(3.49);
    });

    it('should return capabilities for PayUMoney', () => {
      const capabilities = ProviderCapabilitiesService.getCapabilities(PaymentProviderType.PAYUMONEY);
      
      expect(capabilities.supportsSubscriptions).toBe(false);
      expect(capabilities.supportsMultiCurrency).toBe(false);
      expect(capabilities.supportedCurrencies).toEqual(['INR']);
      expect(capabilities.minimumAmount).toBe(10.00);
      expect(capabilities.processingFees.currency).toBe('INR');
    });
  });

  describe('validatePaymentAmount', () => {
    it('should validate amount within limits for Stripe', () => {
      const result = ProviderCapabilitiesService.validatePaymentAmount(
        100, 
        'USD', 
        PaymentProviderType.STRIPE
      );
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject amount below minimum for Stripe', () => {
      const result = ProviderCapabilitiesService.validatePaymentAmount(
        0.25, 
        'USD', 
        PaymentProviderType.STRIPE
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('below minimum');
    });

    it('should reject amount above maximum for PayPal', () => {
      const result = ProviderCapabilitiesService.validatePaymentAmount(
        15000, 
        'USD', 
        PaymentProviderType.PAYPAL
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject unsupported currency', () => {
      const result = ProviderCapabilitiesService.validatePaymentAmount(
        100, 
        'XYZ', 
        PaymentProviderType.STRIPE
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not supported');
    });
  });

  describe('calculateProcessingFees', () => {
    it('should calculate fees correctly for Stripe', () => {
      const fees = ProviderCapabilitiesService.calculateProcessingFees(
        100, 
        PaymentProviderType.STRIPE
      );
      
      expect(fees.percentage).toBeCloseTo(2.9);
      expect(fees.fixed).toBe(0.30);
      expect(fees.total).toBeCloseTo(3.20); // (100 * 0.029) + 0.30
      expect(fees.currency).toBe('USD');
    });

    it('should calculate fees correctly for PayPal', () => {
      const fees = ProviderCapabilitiesService.calculateProcessingFees(
        50, 
        PaymentProviderType.PAYPAL
      );
      
      expect(fees.percentage).toBeCloseTo(1.745); // 50 * 0.0349
      expect(fees.fixed).toBe(0.49);
      expect(fees.total).toBeCloseTo(2.235); // 1.745 + 0.49
    });
  });

  describe('getBestProviderForTransaction', () => {
    const availableProviders = [
      PaymentProviderType.STRIPE,
      PaymentProviderType.PAYPAL,
      PaymentProviderType.SQUARE
    ];

    it('should return best provider for USD transaction', () => {
      const result = ProviderCapabilitiesService.getBestProviderForTransaction(
        100,
        'USD',
        false,
        availableProviders
      );
      
      expect(result).not.toBeNull();
      expect(result?.provider).toBeDefined();
      expect(result?.reason).toContain('Lowest processing fees');
    });

    it('should return null for unsupported currency', () => {
      const result = ProviderCapabilitiesService.getBestProviderForTransaction(
        100,
        'XYZ',
        false,
        availableProviders
      );
      
      expect(result).toBeNull();
    });

    it('should filter providers that support subscriptions', () => {
      const result = ProviderCapabilitiesService.getBestProviderForTransaction(
        100,
        'USD',
        true, // requires subscription
        availableProviders
      );
      
      expect(result).not.toBeNull();
      
      // Verify the selected provider supports subscriptions
      const capabilities = ProviderCapabilitiesService.getCapabilities(result!.provider);
      expect(capabilities.supportsSubscriptions).toBe(true);
    });

    it('should return null for amount outside all provider limits', () => {
      const result = ProviderCapabilitiesService.getBestProviderForTransaction(
        0.1, // Below minimum for all providers
        'USD',
        false,
        availableProviders
      );
      
      expect(result).toBeNull();
    });
  });

  describe('getProviderRecommendations', () => {
    const transactionProfile = {
      averageAmount: 100,
      currency: 'USD',
      volume: 1000,
      requiresSubscriptions: true,
      requiresDisputes: true,
      internationalCustomers: true
    };

    it('should return recommendations sorted by score', () => {
      const recommendations = ProviderCapabilitiesService.getProviderRecommendations(transactionProfile);
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Check that recommendations are sorted by score (descending)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
      }
      
      // Check that each recommendation has reasons
      recommendations.forEach(rec => {
        expect(rec.reasons.length).toBeGreaterThan(0);
        expect(rec.score).toBeGreaterThan(0);
      });
    });

    it('should prioritize providers with subscription support', () => {
      const recommendations = ProviderCapabilitiesService.getProviderRecommendations(transactionProfile);
      
      const topRecommendation = recommendations[0];
      const capabilities = ProviderCapabilitiesService.getCapabilities(topRecommendation.provider);
      
      expect(capabilities.supportsSubscriptions).toBe(true);
      expect(topRecommendation.reasons).toContain('Supports recurring subscriptions');
    });

    it('should consider multi-currency support for international customers', () => {
      const recommendations = ProviderCapabilitiesService.getProviderRecommendations(transactionProfile);
      
      const multiCurrencyRecs = recommendations.filter(rec => 
        rec.reasons.includes('Multi-currency support for international customers')
      );
      
      expect(multiCurrencyRecs.length).toBeGreaterThan(0);
    });
  });

  describe('validateProviderConfiguration', () => {
    it('should validate Stripe configuration', () => {
      const validConfig = { secretKey: 'sk_test_123' };
      const result = ProviderCapabilitiesService.validateProviderConfiguration(
        PaymentProviderType.STRIPE,
        validConfig
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields for Stripe', () => {
      const invalidConfig = {};
      const result = ProviderCapabilitiesService.validateProviderConfiguration(
        PaymentProviderType.STRIPE,
        invalidConfig
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required fields: secretKey');
    });

    it('should validate PayPal configuration', () => {
      const validConfig = { 
        clientId: 'paypal_client_123', 
        clientSecret: 'paypal_secret_123' 
      };
      const result = ProviderCapabilitiesService.validateProviderConfiguration(
        PaymentProviderType.PAYPAL,
        validConfig
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about missing webhook secret', () => {
      const configWithoutWebhook = { secretKey: 'sk_test_123' };
      const result = ProviderCapabilitiesService.validateProviderConfiguration(
        PaymentProviderType.STRIPE,
        configWithoutWebhook
      );
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Webhook secret not configured - webhook validation will be limited');
    });

    it('should warn about undefined sandbox mode', () => {
      const configWithoutSandbox = { secretKey: 'sk_test_123' };
      const result = ProviderCapabilitiesService.validateProviderConfiguration(
        PaymentProviderType.STRIPE,
        configWithoutSandbox
      );
      
      expect(result.warnings).toContain('Sandbox mode not explicitly set - defaulting to production');
    });
  });

  describe('getSecurityConfig', () => {
    it('should return default security configuration', () => {
      const config = ProviderCapabilitiesService.getSecurityConfig();
      
      expect(config.enableFraudDetection).toBe(true);
      expect(config.fraudThresholds.lowRisk).toBe(15);
      expect(config.fraudThresholds.mediumRisk).toBe(40);
      expect(config.fraudThresholds.highRisk).toBe(70);
      expect(config.requireCvvCheck).toBe(true);
      expect(config.blockedCountries).toContain('AF');
      expect(config.allowedCurrencies).toContain('USD');
    });
  });
});