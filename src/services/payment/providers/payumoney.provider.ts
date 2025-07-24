import { BasePaymentProvider } from '../base-provider';
import {
  PaymentRequest,
  PaymentResult,
  CustomerData,
  CustomerResult,
  SubscriptionRequest,
  SubscriptionResult,
  RefundResult,
  PaymentStatus,
  PaymentProviderType,
  SubscriptionStatus,
  RefundStatus
} from '@/types/payment';

export class PayUMoneyProvider extends BasePaymentProvider {
  name = 'PayUMoney';
  type = PaymentProviderType.PAYUMONEY;
  private baseUrl: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['merchantKey', 'merchantSalt']);
    this.baseUrl = config.sandbox 
      ? 'https://sandboxsecure.payu.in' 
      : 'https://secure.payu.in';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // PayUMoney requires a hash for security
      const txnid = this.generateTransactionId();
      const hash = this.generatePaymentHash({
        key: this.config.merchantKey,
        txnid,
        amount: request.amount.toFixed(2),
        productinfo: request.description || 'Payment',
        firstname: request.metadata?.customerName || 'Customer',
        email: request.metadata?.customerEmail || 'customer@example.com'
      });

      const formData = new URLSearchParams({
        key: this.config.merchantKey,
        txnid,
        amount: request.amount.toFixed(2),
        productinfo: request.description || 'Payment',
        firstname: request.metadata?.customerName || 'Customer',
        email: request.metadata?.customerEmail || 'customer@example.com',
        phone: request.metadata?.customerPhone || '',
        surl: this.config.successUrl || 'https://example.com/success',
        furl: this.config.failureUrl || 'https://example.com/failure',
        hash,
        service_provider: 'payu_paisa'
      });

      const response = await fetch(`${this.baseUrl}/_payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      // PayUMoney typically redirects to a payment page
      // This is a simplified implementation for API-based flow
      if (!response.ok) {
        throw new Error('PayUMoney payment initiation failed');
      }

      return {
        success: true,
        paymentId: txnid,
        status: PaymentStatus.PENDING, // PayUMoney payments start as pending
        amount: request.amount,
        currency: request.currency,
        providerResponse: { txnid, redirectUrl: response.url }
      };
    } catch (error: any) {
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

  async createCustomer(customer: CustomerData): Promise<CustomerResult> {
    // PayUMoney doesn't have a dedicated customer creation API
    // We'll store customer data locally for future transactions
    return {
      success: true,
      customerId: `payu_${customer.email}_${Date.now()}`,
      providerResponse: { 
        email: customer.email, 
        name: customer.name,
        phone: customer.phone 
      }
    };
  }

  async createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult> {
    try {
      // PayUMoney subscription API (if available)
      const response = await fetch(`${this.baseUrl}/subscription/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: this.config.merchantKey,
          customer_id: subscription.customerId,
          plan_id: subscription.planId,
          trial_days: subscription.trialDays,
          hash: this.generateSubscriptionHash({
            key: this.config.merchantKey,
            customer_id: subscription.customerId,
            plan_id: subscription.planId
          })
        })
      });

      if (!response.ok) {
        throw new Error('PayUMoney subscription creation failed');
      }

      const result = await response.json();

      return {
        success: result.status === 'success',
        subscriptionId: result.subscription_id || `payu_sub_${Date.now()}`,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        providerResponse: result
      };
    } catch (error: any) {
      return {
        success: false,
        subscriptionId: '',
        status: SubscriptionStatus.CANCELLED,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        error: error.message
      };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: this.config.merchantKey,
          subscription_id: subscriptionId,
          hash: this.generateCancelHash({
            key: this.config.merchantKey,
            subscription_id: subscriptionId
          })
        })
      });

      if (!response.ok) {
        throw new Error('PayUMoney subscription cancellation failed');
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refundAmount = amount?.toFixed(2) || '0.00';
      const hash = this.generateRefundHash({
        key: this.config.merchantKey,
        txnid: paymentId,
        amount: refundAmount
      });

      const response = await fetch(`${this.baseUrl}/merchant/postservice?form=2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          key: this.config.merchantKey,
          command: 'cancel_refund_transaction',
          var1: paymentId,
          var2: refundAmount,
          hash
        }).toString()
      });

      const result = await response.json();

      if (!response.ok || result.status !== 1) {
        throw new Error(result.msg || 'PayUMoney refund failed');
      }

      return {
        success: true,
        refundId: result.request_id || `refund_${Date.now()}`,
        amount: parseFloat(refundAmount),
        status: RefundStatus.PENDING,
        providerResponse: result
      };
    } catch (error: any) {
      return {
        success: false,
        refundId: '',
        amount: amount || 0,
        status: RefundStatus.FAILED,
        error: error.message
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const hash = this.generateVerifyHash({
        key: this.config.merchantKey,
        txnid: paymentId
      });

      const response = await fetch(`${this.baseUrl}/merchant/postservice.php?form=2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          key: this.config.merchantKey,
          command: 'verify_payment',
          var1: paymentId,
          hash
        }).toString()
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error('PayUMoney payment status check failed');
      }

      const transaction = result.transaction_details?.[paymentId];
      if (!transaction) {
        return PaymentStatus.FAILED;
      }

      return this.mapPayUStatus(transaction.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      // PayUMoney webhook validation
      const expectedHash = this.generateWebhookHash(payload);
      return signature === expectedHash;
    } catch (error) {
      console.error('PayUMoney webhook validation failed:', error);
      return false;
    }
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generatePaymentHash(data: any): string {
    const crypto = require('crypto');
    const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${this.config.merchantSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private generateSubscriptionHash(data: any): string {
    const crypto = require('crypto');
    const hashString = `${data.key}|${data.customer_id}|${data.plan_id}|${this.config.merchantSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private generateCancelHash(data: any): string {
    const crypto = require('crypto');
    const hashString = `${data.key}|${data.subscription_id}|${this.config.merchantSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private generateRefundHash(data: any): string {
    const crypto = require('crypto');
    const hashString = `${data.key}|${data.txnid}|${data.amount}|${this.config.merchantSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private generateVerifyHash(data: any): string {
    const crypto = require('crypto');
    const hashString = `${data.key}|verify_payment|${data.txnid}|${this.config.merchantSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private generateWebhookHash(payload: any): string {
    const crypto = require('crypto');
    const hashString = `${this.config.merchantSalt}|${payload.status}||||||||||${payload.email}|${payload.firstname}|${payload.productinfo}|${payload.amount}|${payload.txnid}|${this.config.merchantKey}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private mapPayUStatus(status: string): PaymentStatus {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'captured':
        return PaymentStatus.SUCCEEDED;
      case 'pending':
        return PaymentStatus.PENDING;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'cancelled':
        return PaymentStatus.CANCELLED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      default:
        return PaymentStatus.FAILED;
    }
  }
}