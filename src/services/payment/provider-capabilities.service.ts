import { 
  PaymentProviderType, 
  PaymentProviderCapabilities,
  PaymentSecurityConfig 
} from '@/types/payment';

export class ProviderCapabilitiesService {
  private static readonly PROVIDER_CAPABILITIES: Record<PaymentProviderType, PaymentProviderCapabilities> = {
    [PaymentProviderType.STRIPE]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsWebhooks: true,
      supportsMultiCurrency: true,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK'],
      supportsRecurringPayments: true,
      supportsInstallments: true,
      supportsDisputes: true,
      minimumAmount: 0.50,
      maximumAmount: 999999.99,
      processingFees: {
        percentage: 2.9,
        fixed: 0.30,
        currency: 'USD'
      }
    },
    [PaymentProviderType.PAYPAL]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsWebhooks: true,
      supportsMultiCurrency: true,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
      supportsRecurringPayments: true,
      supportsInstallments: false,
      supportsDisputes: true,
      minimumAmount: 1.00,
      maximumAmount: 10000.00,
      processingFees: {
        percentage: 3.49,
        fixed: 0.49,
        currency: 'USD'
      }
    },
    [PaymentProviderType.SQUARE]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsWebhooks: true,
      supportsMultiCurrency: false,
      supportedCurrencies: ['USD'],
      supportsRecurringPayments: true,
      supportsInstallments: false,
      supportsDisputes: true,
      minimumAmount: 1.00,
      maximumAmount: 50000.00,
      processingFees: {
        percentage: 2.6,
        fixed: 0.10,
        currency: 'USD'
      }
    },
    [PaymentProviderType.BRAINTREE]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsWebhooks: true,
      supportsMultiCurrency: true,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
      supportsRecurringPayments: true,
      supportsInstallments: false,
      supportsDisputes: true,
      minimumAmount: 1.00,
      maximumAmount: 100000.00,
      processingFees: {
        percentage: 2.9,
        fixed: 0.30,
        currency: 'USD'
      }
    },
    [PaymentProviderType.PADDLE]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: false,
      supportsWebhooks: true,
      supportsMultiCurrency: true,
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      supportsRecurringPayments: true,
      supportsInstallments: false,
      supportsDisputes: false,
      minimumAmount: 1.00,
      maximumAmount: 999999.99,
      processingFees: {
        percentage: 5.0,
        fixed: 0.50,
        currency: 'USD'
      }
    },
    [PaymentProviderType.DODO]: {
      supportsSubscriptions: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsWebhooks: true,
      supportsMultiCurrency: true,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR', 'AUD'],
      supportsRecurringPayments: true,
      supportsInstallments: true,
      supportsDisputes: true,
      minimumAmount: 0.50,
      maximumAmount: 500000.00,
      processingFees: {
        percentage: 2.5,
        fixed: 0.25,
        currency: 'USD'
      }
    },
    [PaymentProviderType.PAYUMONEY]: {
      supportsSubscriptions: false,
      supportsRefunds: true,
      supportsPartialRefunds: false,
      supportsWebhooks: true,
      supportsMultiCurrency: false,
      supportedCurrencies: ['INR'],
      supportsRecurringPayments: false,
      supportsInstallments: true,
      supportsDisputes: false,
      minimumAmount: 10.00,
      maximumAmount: 200000.00,
      processingFees: {
        percentage: 2.0,
        fixed: 0.00,
        currency: 'INR'
      }
    }
  };

  private static readonly DEFAULT_SECURITY_CONFIG: PaymentSecurityConfig = {
    enableFraudDetection: true,
    fraudThresholds: {
      lowRisk: 15,
      mediumRisk: 40,
      highRisk: 70
    },
    enableDeviceFingerprinting: true,
    enableIpGeolocation: true,
    enableBehaviorAnalysis: true,
    requireCvvCheck: true,
    requireAddressVerification: false,
    maxDailyTransactions: 100,
    maxDailyVolume: 50000,
    blockedCountries: ['AF', 'IQ', 'LY', 'SO', 'SY', 'YE'],
    allowedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR']
  };

  static getCapabilities(providerType: PaymentProviderType): PaymentProviderCapabilities {
    return this.PROVIDER_CAPABILITIES[providerType];
  }

  static getAllCapabilities(): Record<PaymentProviderType, PaymentProviderCapabilities> {
    return this.PROVIDER_CAPABILITIES;
  }

  static getSecurityConfig(): PaymentSecurityConfig {
    return this.DEFAULT_SECURITY_CONFIG;
  }

  static validatePaymentAmount(
    amount: number, 
    currency: string, 
    providerType: PaymentProviderType
  ): { isValid: boolean; error?: string } {
    const capabilities = this.getCapabilities(providerType);
    
    if (!capabilities.supportedCurrencies.includes(currency.toUpperCase())) {
      return {
        isValid: false,
        error: `Currency ${currency} is not supported by ${providerType}`
      };
    }

    if (amount < capabilities.minimumAmount) {
      return {
        isValid: false,
        error: `Amount ${amount} is below minimum of ${capabilities.minimumAmount} for ${providerType}`
      };
    }

    if (amount > capabilities.maximumAmount) {
      return {
        isValid: false,
        error: `Amount ${amount} exceeds maximum of ${capabilities.maximumAmount} for ${providerType}`
      };
    }

    return { isValid: true };
  }

  static calculateProcessingFees(
    amount: number, 
    providerType: PaymentProviderType
  ): { percentage: number; fixed: number; total: number; currency: string } {
    const capabilities = this.getCapabilities(providerType);
    const fees = capabilities.processingFees;
    
    const percentageFee = (amount * fees.percentage) / 100;
    const total = percentageFee + fees.fixed;

    return {
      percentage: percentageFee,
      fixed: fees.fixed,
      total,
      currency: fees.currency
    };
  }

  static getBestProviderForTransaction(
    amount: number,
    currency: string,
    requiresSubscription: boolean = false,
    availableProviders: PaymentProviderType[]
  ): { provider: PaymentProviderType; reason: string } | null {
    const validProviders = availableProviders.filter(provider => {
      const capabilities = this.getCapabilities(provider);
      
      // Check currency support
      if (!capabilities.supportedCurrencies.includes(currency.toUpperCase())) {
        return false;
      }

      // Check amount limits
      if (amount < capabilities.minimumAmount || amount > capabilities.maximumAmount) {
        return false;
      }

      // Check subscription support if required
      if (requiresSubscription && !capabilities.supportsSubscriptions) {
        return false;
      }

      return true;
    });

    if (validProviders.length === 0) {
      return null;
    }

    // Sort by lowest processing fees
    const providerWithFees = validProviders.map(provider => {
      const fees = this.calculateProcessingFees(amount, provider);
      return { provider, totalFees: fees.total };
    });

    providerWithFees.sort((a, b) => a.totalFees - b.totalFees);

    return {
      provider: providerWithFees[0].provider,
      reason: `Lowest processing fees (${providerWithFees[0].totalFees.toFixed(2)})`
    };
  }

  static getProviderRecommendations(
    transactionProfile: {
      averageAmount: number;
      currency: string;
      volume: number;
      requiresSubscriptions: boolean;
      requiresDisputes: boolean;
      internationalCustomers: boolean;
    }
  ): Array<{ provider: PaymentProviderType; score: number; reasons: string[] }> {
    const recommendations = Object.values(PaymentProviderType).map(provider => {
      const capabilities = this.getCapabilities(provider);
      let score = 0;
      const reasons: string[] = [];

      // Currency support
      if (capabilities.supportedCurrencies.includes(transactionProfile.currency.toUpperCase())) {
        score += 20;
        reasons.push('Supports required currency');
      }

      // Multi-currency for international customers
      if (transactionProfile.internationalCustomers && capabilities.supportsMultiCurrency) {
        score += 15;
        reasons.push('Multi-currency support for international customers');
      }

      // Subscription support
      if (transactionProfile.requiresSubscriptions && capabilities.supportsSubscriptions) {
        score += 25;
        reasons.push('Supports recurring subscriptions');
      }

      // Dispute handling
      if (transactionProfile.requiresDisputes && capabilities.supportsDisputes) {
        score += 10;
        reasons.push('Provides dispute management');
      }

      // Fee optimization based on volume
      const fees = this.calculateProcessingFees(transactionProfile.averageAmount, provider);
      if (fees.total < 3.0) {
        score += 15;
        reasons.push('Competitive processing fees');
      } else if (fees.total < 5.0) {
        score += 10;
        reasons.push('Reasonable processing fees');
      }

      // Amount limits
      if (transactionProfile.averageAmount >= capabilities.minimumAmount && 
          transactionProfile.averageAmount <= capabilities.maximumAmount) {
        score += 10;
        reasons.push('Supports transaction amounts');
      }

      return { provider, score, reasons };
    });

    return recommendations
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  static validateProviderConfiguration(
    providerType: PaymentProviderType,
    config: Record<string, any>
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const requiredFields: Record<PaymentProviderType, string[]> = {
      [PaymentProviderType.STRIPE]: ['secretKey'],
      [PaymentProviderType.PAYPAL]: ['clientId', 'clientSecret'],
      [PaymentProviderType.SQUARE]: ['accessToken', 'applicationId'],
      [PaymentProviderType.BRAINTREE]: ['merchantId', 'publicKey', 'privateKey'],
      [PaymentProviderType.PADDLE]: ['apiKey', 'vendorId'],
      [PaymentProviderType.DODO]: ['apiKey', 'secretKey'],
      [PaymentProviderType.PAYUMONEY]: ['merchantKey', 'merchantSalt']
    };

    const required = requiredFields[providerType] || [];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      errors.push(`Missing required fields: ${missing.join(', ')}`);
    }

    // Check for webhook configuration
    if (!config.webhookSecret && providerType !== PaymentProviderType.PAYUMONEY) {
      warnings.push('Webhook secret not configured - webhook validation will be limited');
    }

    // Check for sandbox/production mode
    if (config.sandbox === undefined) {
      warnings.push('Sandbox mode not explicitly set - defaulting to production');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}