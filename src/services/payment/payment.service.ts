import {
  PaymentProvider,
  PaymentProviderType,
  PaymentProviderConfig,
  PaymentRequest,
  PaymentResult,
  CustomerData,
  CustomerResult,
  SubscriptionRequest,
  SubscriptionResult,
  RefundResult,
  PaymentStatus,
  BillingProfile,
  PaymentMethodData,
  FraudCheckResult,
  PaymentAuditLog,
  PaymentAuditType,
} from '@/types/payment';

import { DodoProvider } from './providers/dodo.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { BraintreeProvider } from './providers/braintree.provider';
import { SquareProvider } from './providers/square.provider';
import { PaddleProvider } from './providers/paddle.provider';
import { PayUMoneyProvider } from './providers/payumoney.provider';
import { ProviderCapabilitiesService } from './provider-capabilities.service';
import { PaymentAuditLogger } from './audit-logger.service';
import { FraudDetectionService } from './fraud-detection.service';
import { PaymentSecurityService } from './payment-security.service';

export class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();
  private activeProviders: PaymentProviderConfig[] = [];
  private defaultProvider?: PaymentProviderType;
  private auditLogger: PaymentAuditLogger;
  private fraudDetection: FraudDetectionService;
  private securityService: PaymentSecurityService;

  constructor(configs: PaymentProviderConfig[]) {
    this.auditLogger = PaymentAuditLogger.getInstance();
    this.fraudDetection = FraudDetectionService.getInstance();
    this.securityService = PaymentSecurityService.getInstance();
    this.initializeProviders(configs);
  }

  private initializeProviders(configs: PaymentProviderConfig[]): void {
    this.activeProviders = configs
      .filter(config => config.isActive)
      .sort((a, b) => a.priority - b.priority);

    for (const config of this.activeProviders) {
      try {
        const provider = this.createProvider(config);
        this.providers.set(config.type, provider);

        // Set the first active provider as default
        if (!this.defaultProvider) {
          this.defaultProvider = config.type;
        }
      } catch (error) {
        console.error(`Failed to initialize ${config.type} provider:`, error);
      }
    }
  }

  private createProvider(config: PaymentProviderConfig): PaymentProvider {
    switch (config.type) {
      case PaymentProviderType.DODO:
        return new DodoProvider(config.config);
      case PaymentProviderType.STRIPE:
        return new StripeProvider(config.config);
      case PaymentProviderType.PAYPAL:
        return new PayPalProvider(config.config);
      case PaymentProviderType.BRAINTREE:
        return new BraintreeProvider(config.config);
      case PaymentProviderType.SQUARE:
        return new SquareProvider(config.config);
      case PaymentProviderType.PADDLE:
        return new PaddleProvider(config.config);
      case PaymentProviderType.PAYUMONEY:
        return new PayUMoneyProvider(config.config);
      default:
        throw new Error(`Unsupported payment provider: ${config.type}`);
    }
  }

  async processPayment(
    request: PaymentRequest,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: any;
      behaviorAnalysis?: any;
      geoLocation?: any;
    },
    providerType?: PaymentProviderType
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerType);

    try {
      // Perform comprehensive fraud check before processing
      const fraudCheck = await this.fraudDetection.performFraudCheck(request, context);

      if (fraudCheck.recommendation === 'decline') {
        // Log declined transaction
        await this.auditLogger.logPaymentEvent({
          tenantId: context.tenantId,
          userId: context.userId,
          type: PaymentAuditType.FRAUD_DETECTED,
          provider: provider.type,
          amount: request.amount,
          currency: request.currency,
          status: 'declined',
          fraudScore: fraudCheck.riskScore,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            fraudLevel: fraudCheck.riskLevel,
            reasons: fraudCheck.reasons,
            recommendation: fraudCheck.recommendation,
          },
        });

        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.FAILED,
          amount: request.amount,
          currency: request.currency,
          error: 'Payment declined due to fraud detection',
        };
      }

      // Process payment with provider
      const result = await provider.processPayment(request);

      // Log successful/failed transaction with comprehensive audit
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_CREATED,
        provider: provider.type,
        paymentId: result.paymentId,
        customerId: request.customerId,
        amount: request.amount,
        currency: request.currency,
        status: result.success ? 'success' : 'failed',
        fraudScore: fraudCheck.riskScore,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          fraudLevel: fraudCheck.riskLevel,
          fraudRecommendation: fraudCheck.recommendation,
          providerResponse: result.providerResponse ? 'included' : 'none',
          errorMessage: result.error,
        },
        sensitiveData: {
          paymentMethodId: request.paymentMethodId,
          description: request.description,
          idempotencyKey: request.idempotencyKey,
        },
      });

      return result;
    } catch (error: any) {
      console.error(`Payment processing failed with ${provider.name}:`, error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_FAILED,
        provider: provider.type,
        amount: request.amount,
        currency: request.currency,
        status: 'error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });

      // Try fallback provider if available
      const fallbackProvider = this.getFallbackProvider(provider.type);
      if (fallbackProvider) {
        console.log(`Attempting fallback to ${fallbackProvider.name}`);
        return await this.processPayment(request, context, fallbackProvider.type);
      }

      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: request.amount,
        currency: request.currency,
        error: error.message,
      };
    }
  }

  async createCustomer(
    customer: CustomerData,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    providerType?: PaymentProviderType
  ): Promise<CustomerResult> {
    const provider = this.getProvider(providerType);

    try {
      // Validate and sanitize customer data
      const validatedCustomer = await this.validateCustomerData(customer);

      const result = await provider.createCustomer(validatedCustomer);

      // Log customer creation with audit trail
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.CUSTOMER_CREATED,
        provider: provider.type,
        customerId: result.customerId,
        status: result.success ? 'success' : 'failed',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          customerEmail: customer.email,
          errorMessage: result.error,
        },
        sensitiveData: {
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
        },
      });

      return result;
    } catch (error: any) {
      console.error(`Customer creation failed with ${provider.name}:`, error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.CUSTOMER_CREATED,
        provider: provider.type,
        status: 'error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
          customerEmail: customer.email,
        },
      });

      return {
        success: false,
        customerId: '',
        error: error.message,
      };
    }
  }

  async createSubscription(
    subscription: SubscriptionRequest,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    providerType?: PaymentProviderType
  ): Promise<SubscriptionResult> {
    const provider = this.getProvider(providerType);

    try {
      const result = await provider.createSubscription(subscription);

      // Log subscription creation with audit trail
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.SUBSCRIPTION_CREATED,
        provider: provider.type,
        subscriptionId: result.subscriptionId,
        customerId: subscription.customerId,
        status: result.success ? 'success' : 'failed',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          planId: subscription.planId,
          trialDays: subscription.trialDays,
          errorMessage: result.error,
        },
        sensitiveData: {
          subscriptionMetadata: subscription.metadata,
        },
      });

      return result;
    } catch (error: any) {
      console.error(`Subscription creation failed with ${provider.name}:`, error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.SUBSCRIPTION_CREATED,
        provider: provider.type,
        customerId: subscription.customerId,
        status: 'error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
          planId: subscription.planId,
        },
      });

      return {
        success: false,
        subscriptionId: '',
        status: subscription.metadata?.defaultStatus || ('cancelled' as any),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        error: error.message,
      };
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    providerType?: PaymentProviderType
  ): Promise<void> {
    const provider = this.getProvider(providerType);

    try {
      await provider.cancelSubscription(subscriptionId);

      // Log subscription cancellation with audit trail
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.SUBSCRIPTION_CANCELLED,
        provider: provider.type,
        subscriptionId,
        status: 'success',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          action: 'subscription_cancelled',
        },
      });
    } catch (error: any) {
      console.error(`Subscription cancellation failed with ${provider.name}:`, error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.SUBSCRIPTION_CANCELLED,
        provider: provider.type,
        subscriptionId,
        status: 'error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  async refundPayment(
    paymentId: string,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    amount?: number,
    providerType?: PaymentProviderType
  ): Promise<RefundResult> {
    const provider = this.getProvider(providerType);

    try {
      const result = await provider.refundPayment(paymentId, amount);

      // Log refund with audit trail
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_REFUNDED,
        provider: provider.type,
        paymentId,
        amount: result.amount,
        currency: 'USD', // Would be retrieved from original payment
        status: result.success ? 'success' : 'failed',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          refundId: result.refundId,
          refundAmount: result.amount,
          errorMessage: result.error,
        },
      });

      return result;
    } catch (error: any) {
      console.error(`Refund failed with ${provider.name}:`, error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_REFUNDED,
        provider: provider.type,
        paymentId,
        amount: amount || 0,
        status: 'error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        refundId: '',
        amount: amount || 0,
        status: 'failed' as any,
        error: error.message,
      };
    }
  }

  async getPaymentStatus(
    paymentId: string,
    providerType?: PaymentProviderType
  ): Promise<PaymentStatus> {
    const provider = this.getProvider(providerType);
    return await provider.getPaymentStatus(paymentId);
  }

  validateWebhook(payload: any, signature: string, providerType: PaymentProviderType): boolean {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }
    return provider.validateWebhook(payload, signature);
  }

  async getBillingProfile(
    customerId: string,
    providerType?: PaymentProviderType
  ): Promise<BillingProfile | null> {
    // This would typically fetch from database
    // Simplified implementation for now
    return null;
  }

  async addPaymentMethod(
    customerId: string,
    paymentMethodData: Omit<PaymentMethodData, 'id'>,
    providerType?: PaymentProviderType
  ): Promise<PaymentMethodData> {
    const provider = this.getProvider(providerType);

    try {
      // Validate payment method data
      if (!paymentMethodData.type || !paymentMethodData.last4) {
        throw new Error('Invalid payment method data');
      }

      // Check if customer exists
      const customerExists = await this.verifyCustomerExists(customerId);
      if (!customerExists) {
        throw new Error('Customer not found');
      }

      // Create payment method with provider
      const paymentMethod: PaymentMethodData = {
        id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        ...paymentMethodData,
      };

      // Log the addition for audit purposes
      await this.logTransaction({
        type: 'payment_method_addition',
        provider: provider.type,
        request: { customerId, paymentMethodData },
        result: { success: true, paymentMethodId: paymentMethod.id },
      });

      return paymentMethod;
    } catch (error: any) {
      console.error(`Add payment method failed with ${provider.name}:`, error);
      throw error;
    }
  }

  private async validateCustomerData(customer: CustomerData): Promise<CustomerData> {
    // Sanitize email first, then validate
    const trimmedEmail = customer.email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    // Sanitize and validate other fields
    const validatedCustomer: CustomerData = {
      email: trimmedEmail,
      name: customer.name?.trim(),
      phone: customer.phone?.replace(/[^\d+\-\s()]/g, ''),
      address: customer.address
        ? {
            line1: customer.address.line1.trim(),
            line2: customer.address.line2?.trim(),
            city: customer.address.city.trim(),
            state: customer.address.state?.trim(),
            postalCode: customer.address.postalCode.trim(),
            country: customer.address.country.toUpperCase().trim(),
          }
        : undefined,
      metadata: customer.metadata,
    };

    return validatedCustomer;
  }

  private async verifyCustomerExists(customerId: string): Promise<boolean> {
    // In production, this would verify the customer exists with the provider
    // For now, return true for non-empty customer IDs
    return Boolean(customerId && customerId.length > 0);
  }

  async removePaymentMethod(
    paymentMethodId: string,
    providerType?: PaymentProviderType
  ): Promise<void> {
    const provider = this.getProvider(providerType);

    try {
      // Implementation would depend on the specific provider
      // For now, this is a simplified implementation
      await this.logTransaction({
        type: 'payment_method_removal',
        provider: provider.type,
        request: { paymentMethodId },
        result: { success: true },
      });
    } catch (error: any) {
      console.error(`Payment method removal failed with ${provider.name}:`, error);
      throw error;
    }
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    providerType?: PaymentProviderType
  ): Promise<void> {
    const provider = this.getProvider(providerType);

    try {
      // Implementation would depend on the specific provider
      // For now, this is a simplified implementation
      await this.logTransaction({
        type: 'default_payment_method_update',
        provider: provider.type,
        request: { customerId, paymentMethodId },
        result: { success: true },
      });
    } catch (error: any) {
      console.error(`Set default payment method failed with ${provider.name}:`, error);
      throw error;
    }
  }

  getAvailableProviders(): PaymentProviderConfig[] {
    return this.activeProviders;
  }

  getProviderCapabilities(providerType: PaymentProviderType) {
    return ProviderCapabilitiesService.getCapabilities(providerType);
  }

  getAllProviderCapabilities() {
    return ProviderCapabilitiesService.getAllCapabilities();
  }

  validatePaymentAmount(amount: number, currency: string, providerType?: PaymentProviderType) {
    const provider = providerType || this.defaultProvider;
    if (!provider) {
      throw new Error('No payment provider specified');
    }
    return ProviderCapabilitiesService.validatePaymentAmount(amount, currency, provider);
  }

  calculateProcessingFees(amount: number, providerType?: PaymentProviderType) {
    const provider = providerType || this.defaultProvider;
    if (!provider) {
      throw new Error('No payment provider specified');
    }
    return ProviderCapabilitiesService.calculateProcessingFees(amount, provider);
  }

  getBestProviderForTransaction(
    amount: number,
    currency: string,
    requiresSubscription: boolean = false
  ) {
    const availableProviderTypes = this.activeProviders.map(p => p.type);
    return ProviderCapabilitiesService.getBestProviderForTransaction(
      amount,
      currency,
      requiresSubscription,
      availableProviderTypes
    );
  }

  getProviderRecommendations(transactionProfile: {
    averageAmount: number;
    currency: string;
    volume: number;
    requiresSubscriptions: boolean;
    requiresDisputes: boolean;
    internationalCustomers: boolean;
  }) {
    return ProviderCapabilitiesService.getProviderRecommendations(transactionProfile);
  }

  getProvider(providerType?: PaymentProviderType): PaymentProvider {
    const type = providerType || this.defaultProvider;
    if (!type) {
      throw new Error('No payment provider configured');
    }

    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider ${type} not found or not active`);
    }

    return provider;
  }

  private getFallbackProvider(currentProviderType: PaymentProviderType): PaymentProvider | null {
    const currentIndex = this.activeProviders.findIndex(p => p.type === currentProviderType);
    if (currentIndex === -1 || currentIndex === this.activeProviders.length - 1) {
      return null;
    }

    const fallbackConfig = this.activeProviders[currentIndex + 1];
    return this.providers.get(fallbackConfig.type) || null;
  }

  /**
   * Tokenize payment method for secure storage
   */
  async tokenizePaymentMethod(
    cardData: {
      number: string;
      expiryMonth: number;
      expiryYear: number;
      cvv: string;
      holderName: string;
    },
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<any> {
    try {
      const tokenizedCard = await this.securityService.tokenizeCard(cardData);

      // Log tokenization event
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_METHOD_ADDED,
        provider: this.defaultProvider || PaymentProviderType.STRIPE,
        status: 'success',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          tokenId: tokenizedCard.token,
          cardBrand: tokenizedCard.brand,
          last4: tokenizedCard.last4,
        },
      });

      return tokenizedCard;
    } catch (error: any) {
      console.error('Payment method tokenization failed:', error);

      // Log error
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: PaymentAuditType.PAYMENT_METHOD_ADDED,
        provider: this.defaultProvider || PaymentProviderType.STRIPE,
        status: 'failed',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Perform PCI DSS compliance check
   */
  async performComplianceCheck(tenantId: string): Promise<any> {
    return await this.securityService.performPCIComplianceCheck();
  }

  /**
   * Perform comprehensive security audit
   */
  async performSecurityAudit(tenantId: string): Promise<any> {
    return await this.securityService.performSecurityAudit(tenantId);
  }

  /**
   * Get fraud statistics for monitoring
   */
  async getFraudStatistics(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    return await this.fraudDetection.getFraudStatistics(tenantId, startDate, endDate);
  }

  /**
   * Verify audit record integrity
   */
  async verifyAuditRecord(recordId: string): Promise<any> {
    return await this.auditLogger.verifyAuditRecord(recordId);
  }

  /**
   * Get audit trail for compliance reporting
   */
  async getAuditTrail(filters: {
    tenantId: string;
    paymentId?: string;
    customerId?: string;
    subscriptionId?: string;
    userId?: string;
    type?: PaymentAuditType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any> {
    return await this.auditLogger.getAuditTrail(filters);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    return await this.auditLogger.generateComplianceReport(tenantId, startDate, endDate);
  }

  private async logTransaction(data: {
    type: string;
    provider: PaymentProviderType;
    request?: any;
    result?: any;
    error?: any;
    tenantId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditLogger.logTransaction(data);
    } catch (error) {
      console.error('Failed to log transaction:', error);
    }
  }
}
