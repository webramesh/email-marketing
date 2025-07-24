import {
  PaymentMethodData,
  PaymentMethodValidation,
  EnhancedBillingProfile,
  PaymentProviderType,
  PaymentHistoryItem,
  SubscriptionSummary,
  BillingAddress,
} from '@/types/payment';

export class PaymentMethodService {
  private luhnCheck(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private getCardBrand(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');

    // Visa
    if (digits.match(/^4/)) return 'visa';

    // Mastercard
    if (digits.match(/^5[1-5]/) || digits.match(/^2[2-7]/)) return 'mastercard';

    // American Express
    if (digits.match(/^3[47]/)) return 'amex';

    // Discover
    if (digits.match(/^6(?:011|5)/)) return 'discover';

    // Diners Club
    if (digits.match(/^3[0689]/)) return 'diners';

    // JCB
    if (digits.match(/^35/)) return 'jcb';

    return 'unknown';
  }

  private validateExpiryDate(month: number, year: number): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    if (month < 1 || month > 12) return false;
    if (year > currentYear + 20) return false; // Cards typically don't expire more than 20 years out

    return true;
  }

  private validateCvv(cvv: string, cardBrand: string): boolean {
    const cvvDigits = cvv.replace(/\D/g, '');

    // American Express uses 4-digit CVV
    if (cardBrand === 'amex') {
      return cvvDigits.length === 4;
    }

    // Most other cards use 3-digit CVV
    return cvvDigits.length === 3;
  }

  validatePaymentMethod(data: {
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
    cardholderName: string;
  }): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const cardNumber = data.cardNumber.replace(/\D/g, '');
    const cardBrand = this.getCardBrand(cardNumber);

    // Validate card number
    const luhnValid = this.luhnCheck(cardNumber);
    if (!luhnValid) {
      errors.push('Invalid card number');
    }

    if (cardNumber.length < 13 || cardNumber.length > 19) {
      errors.push('Card number must be between 13 and 19 digits');
    }

    // Validate expiry date
    const expiryValid = this.validateExpiryDate(data.expiryMonth, data.expiryYear);
    if (!expiryValid) {
      errors.push('Invalid or expired card');
    }

    // Check if card expires soon (within 3 months)
    const now = new Date();
    const expiryDate = new Date(data.expiryYear, data.expiryMonth - 1);
    const monthsUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsUntilExpiry < 3 && monthsUntilExpiry > 0) {
      warnings.push('Card expires soon');
    }

    // Validate CVV
    const cvvValid = this.validateCvv(data.cvv, cardBrand);
    if (!cvvValid) {
      errors.push('Invalid CVV');
    }

    // Validate cardholder name
    if (!data.cardholderName || data.cardholderName.trim().length < 2) {
      errors.push('Cardholder name is required');
    }

    // Check for known test card numbers
    const testCardNumbers = [
      '4111111111111111', // Visa test card
      '4000000000000002', // Visa test card (declined)
      '5555555555554444', // Mastercard test card
      '2223003122003222', // Mastercard test card
      '378282246310005', // Amex test card
      '371449635398431', // Amex test card
      '6011111111111117', // Discover test card
      '30569309025904', // Diners test card
    ];

    if (testCardNumbers.includes(cardNumber)) {
      warnings.push('Test card detected');
    }

    // BIN validation (first 6 digits)
    const bin = cardNumber.substring(0, 6);
    const binValid = bin.length === 6 && /^\d{6}$/.test(bin);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityChecks: {
        cvvValid,
        expiryValid,
        luhnValid,
        binValid,
      },
    };
  }

  async createPaymentMethod(data: {
    customerId: string;
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
    cardholderName: string;
    billingAddress?: BillingAddress;
    isDefault?: boolean;
  }): Promise<PaymentMethodData> {
    // Validate the payment method first
    const validation = this.validatePaymentMethod(data);
    if (!validation.isValid) {
      throw new Error(`Invalid payment method: ${validation.errors.join(', ')}`);
    }

    const cardNumber = data.cardNumber.replace(/\D/g, '');
    const brand = this.getCardBrand(cardNumber);
    const last4 = cardNumber.slice(-4);

    // In production, this would integrate with the payment provider
    // to securely tokenize the card and store it
    const paymentMethod: PaymentMethodData = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'card',
      brand,
      last4,
      expiryMonth: data.expiryMonth,
      expiryYear: data.expiryYear,
      isDefault: data.isDefault || false,
    };

    // Log the creation for audit purposes
    console.log('Payment method created:', {
      customerId: data.customerId,
      paymentMethodId: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      timestamp: new Date().toISOString(),
    });

    return paymentMethod;
  }

  async getEnhancedBillingProfile(
    customerId: string,
    providerType?: PaymentProviderType
  ): Promise<EnhancedBillingProfile | null> {
    try {
      // In production, this would fetch from database
      // For now, return a mock profile with enhanced security features
      const riskLevel = await this.calculateRiskLevel(customerId);

      const mockProfile: EnhancedBillingProfile = {
        customerId,
        email: 'customer@example.com',
        name: 'John Doe',
        paymentMethods: [
          {
            id: 'pm_1',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2025,
            isDefault: true,
          },
        ],
        defaultPaymentMethodId: 'pm_1',
        billingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        businessType: 'individual',
        paymentHistory: this.generateMockPaymentHistory(),
        subscriptions: this.generateMockSubscriptions(),
        totalSpent: 2450.75,
        averageTransactionAmount: 122.54,
        riskLevel,
        lastPaymentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        preferredCurrency: 'USD',
        autoPayEnabled: false,
      };

      // Log profile access for audit purposes
      console.log('Billing profile accessed:', {
        customerId,
        providerType,
        riskLevel,
        timestamp: new Date().toISOString(),
      });

      return mockProfile;
    } catch (error) {
      console.error('Failed to get enhanced billing profile:', error);
      return null;
    }
  }

  private generateMockPaymentHistory(): PaymentHistoryItem[] {
    return [
      {
        id: 'pi_1',
        amount: 99.99,
        currency: 'USD',
        status: 'succeeded' as any,
        description: 'Monthly subscription',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        provider: PaymentProviderType.STRIPE,
        refunded: false,
      },
      {
        id: 'pi_2',
        amount: 199.99,
        currency: 'USD',
        status: 'succeeded' as any,
        description: 'Annual upgrade',
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        provider: PaymentProviderType.STRIPE,
        refunded: false,
      },
    ];
  }

  private generateMockSubscriptions(): SubscriptionSummary[] {
    return [
      {
        id: 'sub_1',
        planId: 'plan_monthly',
        planName: 'Pro Monthly',
        status: 'active' as any,
        amount: 99.99,
        currency: 'USD',
        interval: 'monthly',
        currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      },
    ];
  }

  async updateBillingAddress(
    customerId: string,
    address: BillingAddress,
    providerType?: PaymentProviderType
  ): Promise<void> {
    // Validate address
    if (!address.firstName || !address.lastName) {
      throw new Error('First name and last name are required');
    }

    if (!address.line1 || !address.city || !address.postalCode || !address.country) {
      throw new Error('Address line 1, city, postal code, and country are required');
    }

    // In production, this would update the billing address with the payment provider
    console.log('Billing address updated:', {
      customerId,
      address,
      timestamp: new Date().toISOString(),
    });
  }

  async calculateRiskLevel(customerId: string): Promise<'low' | 'medium' | 'high'> {
    // In production, this would analyze payment history, failed attempts, etc.
    // For now, return a simple calculation based on mock data

    let riskScore = 0;

    // Mock payment history analysis
    const mockPaymentHistory = this.generateMockPaymentHistory();
    const failedPayments = mockPaymentHistory.filter(p => p.status === 'failed').length;
    const totalPayments = mockPaymentHistory.length;

    if (totalPayments > 0) {
      const failureRate = failedPayments / totalPayments;
      if (failureRate > 0.3) riskScore += 30;
      else if (failureRate > 0.1) riskScore += 15;
    }

    // Mock average transaction amount check
    const averageAmount = 122.54; // Mock value
    if (averageAmount > 10000) riskScore += 20;
    else if (averageAmount > 5000) riskScore += 10;

    // Check account age (would need actual data)
    // New accounts are higher risk
    riskScore += 10;

    // Mock subscription status check
    const mockSubscriptions = this.generateMockSubscriptions();
    const activeSubscriptions = mockSubscriptions.filter(s => s.status === 'active').length;
    const totalSpent = 2450.75; // Mock value

    if (activeSubscriptions === 0 && totalSpent < 100) {
      riskScore += 15;
    }

    if (riskScore < 20) return 'low';
    if (riskScore < 50) return 'medium';
    return 'high';
  }

  async getPaymentMethodCapabilities(providerType: PaymentProviderType) {
    // Return capabilities based on provider
    const capabilities: Record<PaymentProviderType, any> = {
      [PaymentProviderType.STRIPE]: {
        supportsSubscriptions: true,
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsWebhooks: true,
        supportsMultiCurrency: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        supportsRecurringPayments: true,
        supportsInstallments: true,
        supportsDisputes: true,
        minimumAmount: 0.5,
        maximumAmount: 999999.99,
        processingFees: {
          percentage: 2.9,
          fixed: 0.3,
          currency: 'USD',
        },
      },
      [PaymentProviderType.PAYPAL]: {
        supportsSubscriptions: true,
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsWebhooks: true,
        supportsMultiCurrency: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        supportsRecurringPayments: true,
        supportsInstallments: false,
        supportsDisputes: true,
        minimumAmount: 1.0,
        maximumAmount: 10000.0,
        processingFees: {
          percentage: 3.49,
          fixed: 0.49,
          currency: 'USD',
        },
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
        minimumAmount: 1.0,
        maximumAmount: 50000.0,
        processingFees: {
          percentage: 2.6,
          fixed: 0.1,
          currency: 'USD',
        },
      },
      [PaymentProviderType.DODO]: {
        supportsSubscriptions: false,
        supportsRefunds: true,
        supportsPartialRefunds: false,
        supportsWebhooks: false,
        supportsMultiCurrency: false,
        supportedCurrencies: ['USD'],
        supportsRecurringPayments: false,
        supportsInstallments: false,
        supportsDisputes: false,
        minimumAmount: 1.0,
        maximumAmount: 5000.0,
        processingFees: {
          percentage: 2.5,
          fixed: 0.25,
          currency: 'USD',
        },
      },
      [PaymentProviderType.BRAINTREE]: {
        supportsSubscriptions: true,
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsWebhooks: true,
        supportsMultiCurrency: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportsRecurringPayments: true,
        supportsInstallments: false,
        supportsDisputes: true,
        minimumAmount: 1.0,
        maximumAmount: 25000.0,
        processingFees: {
          percentage: 2.9,
          fixed: 0.3,
          currency: 'USD',
        },
      },
      [PaymentProviderType.PADDLE]: {
        supportsSubscriptions: true,
        supportsRefunds: true,
        supportsPartialRefunds: true,
        supportsWebhooks: true,
        supportsMultiCurrency: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportsRecurringPayments: true,
        supportsInstallments: false,
        supportsDisputes: true,
        minimumAmount: 1.0,
        maximumAmount: 50000.0,
        processingFees: {
          percentage: 5.0,
          fixed: 0.5,
          currency: 'USD',
        },
      },
      [PaymentProviderType.PAYUMONEY]: {
        supportsSubscriptions: false,
        supportsRefunds: true,
        supportsPartialRefunds: false,
        supportsWebhooks: true,
        supportsMultiCurrency: false,
        supportedCurrencies: ['INR'],
        supportsRecurringPayments: false,
        supportsInstallments: false,
        supportsDisputes: false,
        minimumAmount: 10.0,
        maximumAmount: 100000.0,
        processingFees: {
          percentage: 2.0,
          fixed: 0.0,
          currency: 'INR',
        },
      },
    };

    return capabilities[providerType] || null;
  }

  maskCardNumber(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4) return cardNumber;

    const last4 = digits.slice(-4);
    const masked = '•'.repeat(digits.length - 4);

    return `${masked}${last4}`;
  }

  formatCardNumber(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');
    const brand = this.getCardBrand(digits);

    // Format based on card brand
    switch (brand) {
      case 'amex':
        return digits.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
      case 'diners':
        return digits.replace(/(\d{4})(\d{6})(\d{4})/, '$1 $2 $3');
      default:
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
  }
}
