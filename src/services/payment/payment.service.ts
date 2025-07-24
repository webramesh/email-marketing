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
  PaymentAuditType
} from '@/types/payment';

import { DodoProvider } from './providers/dodo.provider';
import { StripeProvider } from './providers/stripe.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { BraintreeProvider } from './providers/braintree.provider';
import { SquareProvider } from './providers/square.provider';
import { PaddleProvider } from './providers/paddle.provider';
import { PayUMoneyProvider } from './providers/payumoney.provider';
import { ProviderCapabilitiesService } from './provider-capabilities.service';

export class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();
  private activeProviders: PaymentProviderConfig[] = [];
  private defaultProvider?: PaymentProviderType;

  constructor(configs: PaymentProviderConfig[]) {
    this.initializeProviders(configs);
  }

  private initializeProviders(configs: PaymentProviderConfig[]): void {
    this.activeProviders = configs.filter(config => config.isActive)
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
    providerType?: PaymentProviderType
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerType);
    
    try {
      // Perform fraud check before processing
      const fraudCheck = await this.performFraudCheck(request);
      if (fraudCheck.recommendation === 'decline') {
        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.FAILED,
          amount: request.amount,
          currency: request.currency,
          error: 'Payment declined due to fraud detection'
        };
      }

      const result = await provider.processPayment(request);
      
      // Log the transaction
      await this.logTransaction({
        type: 'payment',
        provider: provider.type,
        request,
        result,
        fraudCheck
      });

      return result;
    } catch (error: any) {
      console.error(`Payment processing failed with ${provider.name}:`, error);
      
      // Try fallback provider if available
      const fallbackProvider = this.getFallbackProvider(provider.type);
      if (fallbackProvider) {
        console.log(`Attempting fallback to ${fallbackProvider.name}`);
        return await fallbackProvider.processPayment(request);
      }

      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: request.amount,
        currency: request.currency,
        error: error.message
      };
    }
  }

  async createCustomer(
    customer: CustomerData, 
    providerType?: PaymentProviderType
  ): Promise<CustomerResult> {
    const provider = this.getProvider(providerType);
    
    try {
      const result = await provider.createCustomer(customer);
      
      await this.logTransaction({
        type: 'customer_creation',
        provider: provider.type,
        request: customer,
        result
      });

      return result;
    } catch (error: any) {
      console.error(`Customer creation failed with ${provider.name}:`, error);
      return {
        success: false,
        customerId: '',
        error: error.message
      };
    }
  }

  async createSubscription(
    subscription: SubscriptionRequest, 
    providerType?: PaymentProviderType
  ): Promise<SubscriptionResult> {
    const provider = this.getProvider(providerType);
    
    try {
      const result = await provider.createSubscription(subscription);
      
      await this.logTransaction({
        type: 'subscription_creation',
        provider: provider.type,
        request: subscription,
        result
      });

      return result;
    } catch (error: any) {
      console.error(`Subscription creation failed with ${provider.name}:`, error);
      return {
        success: false,
        subscriptionId: '',
        status: subscription.metadata?.defaultStatus || 'cancelled' as any,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        error: error.message
      };
    }
  }

  async cancelSubscription(
    subscriptionId: string, 
    providerType?: PaymentProviderType
  ): Promise<void> {
    const provider = this.getProvider(providerType);
    
    try {
      await provider.cancelSubscription(subscriptionId);
      
      await this.logTransaction({
        type: 'subscription_cancellation',
        provider: provider.type,
        request: { subscriptionId },
        result: { success: true }
      });
    } catch (error: any) {
      console.error(`Subscription cancellation failed with ${provider.name}:`, error);
      throw error;
    }
  }

  async refundPayment(
    paymentId: string, 
    amount?: number, 
    providerType?: PaymentProviderType
  ): Promise<RefundResult> {
    const provider = this.getProvider(providerType);
    
    try {
      const result = await provider.refundPayment(paymentId, amount);
      
      await this.logTransaction({
        type: 'refund',
        provider: provider.type,
        request: { paymentId, amount },
        result
      });

      return result;
    } catch (error: any) {
      console.error(`Refund failed with ${provider.name}:`, error);
      return {
        success: false,
        refundId: '',
        amount: amount || 0,
        status: 'failed' as any,
        error: error.message
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

  validateWebhook(
    payload: any, 
    signature: string, 
    providerType: PaymentProviderType
  ): boolean {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }
    return provider.validateWebhook(payload, signature);
  }

  async getBillingProfile(customerId: string, providerType?: PaymentProviderType): Promise<BillingProfile | null> {
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
        ...paymentMethodData
      };

      // Log the addition for audit purposes
      await this.logTransaction({
        type: 'payment_method_addition',
        provider: provider.type,
        request: { customerId, paymentMethodData },
        result: { success: true, paymentMethodId: paymentMethod.id }
      });

      return paymentMethod;
    } catch (error: any) {
      console.error(`Add payment method failed with ${provider.name}:`, error);
      throw error;
    }
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
        result: { success: true }
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
        result: { success: true }
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

  private async performFraudCheck(request: PaymentRequest): Promise<FraudCheckResult> {
    let riskScore = 0;
    const reasons: string[] = [];
    
    // Amount-based risk assessment with enhanced thresholds
    if (request.amount > 50000) {
      riskScore += 50;
      reasons.push('Very high transaction amount');
    } else if (request.amount > 25000) {
      riskScore += 40;
      reasons.push('High transaction amount');
    } else if (request.amount > 10000) {
      riskScore += 30;
      reasons.push('Large transaction amount');
    } else if (request.amount > 5000) {
      riskScore += 20;
      reasons.push('Above average transaction amount');
    } else if (request.amount > 1000) {
      riskScore += 10;
      reasons.push('Moderate transaction amount');
    }
    
    // Currency risk assessment
    const highRiskCurrencies = ['BTC', 'ETH', 'USDT', 'XRP', 'LTC'];
    const mediumRiskCurrencies = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
    
    if (highRiskCurrencies.includes(request.currency.toUpperCase())) {
      riskScore += 25;
      reasons.push('High-risk cryptocurrency');
    } else if (!mediumRiskCurrencies.includes(request.currency.toUpperCase()) && request.currency.toUpperCase() !== 'USD') {
      riskScore += 15;
      reasons.push('Uncommon currency');
    }
    
    // Enhanced metadata-based security checks
    if (request.metadata?.isHighRisk) riskScore += 50;
    if (request.metadata?.vpnDetected) riskScore += 15;
    if (request.metadata?.proxyDetected) riskScore += 20;
    if (request.metadata?.torDetected) riskScore += 35;
    if (request.metadata?.suspiciousEmail) riskScore += 15;
    if (request.metadata?.disposableEmail) riskScore += 20;
    if (request.metadata?.newAccount && request.amount > 1000) riskScore += 25;
    
    // Device and browser fingerprinting
    if (request.metadata?.deviceFingerprint) {
      if (request.metadata.suspiciousDevice) riskScore += 20;
      if (request.metadata.multipleAccounts) riskScore += 15;
    }
    
    // Time-based risk assessment
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Unusual hours (late night/early morning)
    if (hour < 6 || hour > 22) riskScore += 5;
    
    // Weekend transactions for business accounts
    if ((day === 0 || day === 6) && request.metadata?.accountType === 'business') {
      riskScore += 10;
    }
    
    // Enhanced frequency and velocity checks
    if (request.metadata?.recentFailedAttempts) {
      if (request.metadata.recentFailedAttempts > 5) riskScore += 40;
      else if (request.metadata.recentFailedAttempts > 3) riskScore += 25;
      else if (request.metadata.recentFailedAttempts > 1) riskScore += 10;
    }
    
    if (request.metadata?.dailyTransactionCount) {
      if (request.metadata.dailyTransactionCount > 20) riskScore += 25;
      else if (request.metadata.dailyTransactionCount > 10) riskScore += 15;
      else if (request.metadata.dailyTransactionCount > 5) riskScore += 5;
    }
    
    if (request.metadata?.dailyTransactionVolume && request.metadata.dailyTransactionVolume > 100000) {
      riskScore += 30;
    }
    
    // Geographic and IP-based risk assessment
    const highRiskCountries = ['AF', 'IQ', 'LY', 'SO', 'SY', 'YE']; // High-risk country codes
    const mediumRiskCountries = ['CN', 'RU', 'IR', 'KP', 'MM']; // Medium-risk country codes
    
    if (request.metadata?.country) {
      if (highRiskCountries.includes(request.metadata.country)) {
        riskScore += 30;
      } else if (mediumRiskCountries.includes(request.metadata.country)) {
        riskScore += 15;
      }
    }
    
    // IP reputation checks
    if (request.metadata?.ipReputation) {
      if (request.metadata.ipReputation === 'malicious') riskScore += 40;
      else if (request.metadata.ipReputation === 'suspicious') riskScore += 20;
      else if (request.metadata.ipReputation === 'unknown') riskScore += 10;
    }
    
    // Behavioral analysis
    if (request.metadata?.behaviorScore && request.metadata.behaviorScore < 30) {
      riskScore += 25;
    }
    
    // Payment method risk assessment
    if (request.metadata?.paymentMethodRisk) {
      if (request.metadata.paymentMethodRisk === 'high') riskScore += 20;
      else if (request.metadata.paymentMethodRisk === 'medium') riskScore += 10;
    }
    
    // Machine learning risk score (if available)
    if (request.metadata?.mlRiskScore) {
      riskScore += Math.round(request.metadata.mlRiskScore * 0.3);
    }
    
    // Determine risk level and recommendation with enhanced thresholds
    let riskLevel: 'low' | 'medium' | 'high';
    let recommendation: 'approve' | 'review' | 'decline';
    
    if (riskScore < 15) {
      riskLevel = 'low';
      recommendation = 'approve';
    } else if (riskScore < 40) {
      riskLevel = 'medium';
      recommendation = 'review';
    } else if (riskScore < 70) {
      riskLevel = 'high';
      recommendation = 'review';
    } else {
      riskLevel = 'high';
      recommendation = 'decline';
    }

    // Enhanced verification checks
    const checks = {
      cvv: request.metadata?.cvvCheck !== false,
      address: request.metadata?.addressCheck !== false,
      postalCode: request.metadata?.postalCodeCheck !== false
    };

    // Override recommendation based on critical security flags
    if (request.metadata?.knownFraudster || request.metadata?.blacklisted) {
      recommendation = 'decline';
      riskLevel = 'high';
      riskScore = Math.max(riskScore, 100);
    }

    return {
      riskScore,
      riskLevel,
      checks,
      recommendation,
      reasons,
      timestamp: new Date()
    };
  }

  private async logTransaction(data: {
    type: string;
    provider: PaymentProviderType;
    request: any;
    result: any;
    fraudCheck?: FraudCheckResult;
    tenantId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const auditLog: Omit<PaymentAuditLog, 'id'> = {
        tenantId: data.tenantId || 'unknown',
        userId: data.userId,
        type: this.mapToAuditType(data.type),
        provider: data.provider,
        paymentId: data.result.paymentId || data.result.subscriptionId || data.result.customerId,
        customerId: data.request.customerId,
        subscriptionId: data.result.subscriptionId,
        amount: data.request.amount || data.result.amount,
        currency: data.request.currency || data.result.currency,
        status: data.result.success ? 'success' : 'failed',
        fraudScore: data.fraudCheck?.riskScore,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {
          requestId: data.request.idempotencyKey,
          fraudLevel: data.fraudCheck?.riskLevel,
          fraudRecommendation: data.fraudCheck?.recommendation,
          providerResponse: data.result.providerResponse ? 'included' : 'none',
          errorMessage: data.result.error
        },
        createdAt: new Date(),
        immutableHash: this.generateAuditHash({
          type: data.type,
          provider: data.provider,
          amount: data.request.amount,
          timestamp: new Date().toISOString(),
          tenantId: data.tenantId
        })
      };

      // In production, this would be stored in a secure, immutable audit log database
      // For now, we'll use structured logging
      console.log('PAYMENT_AUDIT_LOG:', JSON.stringify(auditLog, null, 2));

      // Store in database (would be implemented with actual database)
      // await this.auditLogRepository.create(auditLog);

      // For high-risk transactions, also log to security monitoring
      if (data.fraudCheck?.riskLevel === 'high') {
        console.warn('HIGH_RISK_PAYMENT_DETECTED:', {
          tenantId: data.tenantId,
          userId: data.userId,
          amount: data.request.amount,
          riskScore: data.fraudCheck.riskScore,
          recommendation: data.fraudCheck.recommendation,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to log payment transaction:', error);
      // Audit logging failures should not break the payment flow
      // but should be monitored and alerted
    }
  }

  private mapToAuditType(type: string): PaymentAuditType {
    switch (type) {
      case 'payment':
        return PaymentAuditType.PAYMENT_CREATED;
      case 'customer_creation':
        return PaymentAuditType.CUSTOMER_CREATED;
      case 'subscription_creation':
        return PaymentAuditType.SUBSCRIPTION_CREATED;
      case 'subscription_cancellation':
        return PaymentAuditType.SUBSCRIPTION_CANCELLED;
      case 'refund':
        return PaymentAuditType.PAYMENT_REFUNDED;
      case 'payment_method_addition':
        return PaymentAuditType.PAYMENT_METHOD_ADDED;
      case 'payment_method_removal':
        return PaymentAuditType.PAYMENT_METHOD_REMOVED;
      case 'fraud_detection':
        return PaymentAuditType.FRAUD_DETECTED;
      case 'webhook':
        return PaymentAuditType.WEBHOOK_RECEIVED;
      default:
        return PaymentAuditType.PAYMENT_CREATED;
    }
  }

  private generateAuditHash(data: any): string {
    const crypto = require('crypto');
    const hashData = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(hashData).digest('hex');
  }
}