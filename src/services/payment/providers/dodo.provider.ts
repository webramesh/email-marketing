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

export class DodoProvider extends BasePaymentProvider {
  name = 'Dodo Payments';
  type = PaymentProviderType.DODO;
  private baseUrl: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['apiKey', 'secretKey']);
    this.baseUrl = config.sandbox ? 'https://api-sandbox.dodopayments.com' : 'https://api.dodopayments.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Dodo-Signature': this.generateSignature(request),
          'Idempotency-Key': request.idempotencyKey || this.generateIdempotencyKey()
        },
        body: JSON.stringify({
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency.toUpperCase(),
          customer_id: request.customerId,
          payment_method_id: request.paymentMethodId,
          description: request.description,
          metadata: request.metadata || {}
        })
      });

      const payment = await response.json();

      if (!response.ok) {
        throw new Error(payment.message || 'Dodo payment failed');
      }

      return {
        success: payment.status === 'succeeded',
        paymentId: payment.id,
        status: this.mapDodoStatus(payment.status),
        amount: payment.amount / 100,
        currency: payment.currency.toUpperCase(),
        fees: payment.fees ? payment.fees / 100 : undefined,
        providerResponse: payment
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
    try {
      const response = await fetch(`${this.baseUrl}/v1/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          metadata: customer.metadata || {}
        })
      });

      const dodoCustomer = await response.json();

      if (!response.ok) {
        throw new Error(dodoCustomer.message || 'Dodo customer creation failed');
      }

      return {
        success: true,
        customerId: dodoCustomer.id,
        providerResponse: dodoCustomer
      };
    } catch (error: any) {
      return {
        success: false,
        customerId: '',
        error: error.message
      };
    }
  }

  async createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          customer_id: subscription.customerId,
          plan_id: subscription.planId,
          trial_days: subscription.trialDays,
          metadata: subscription.metadata || {}
        })
      });

      const dodoSubscription = await response.json();

      if (!response.ok) {
        throw new Error(dodoSubscription.message || 'Dodo subscription creation failed');
      }

      return {
        success: true,
        subscriptionId: dodoSubscription.id,
        status: this.mapDodoSubscriptionStatus(dodoSubscription.status),
        currentPeriodStart: new Date(dodoSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(dodoSubscription.current_period_end * 1000),
        providerResponse: dodoSubscription
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
      const response = await fetch(`${this.baseUrl}/v1/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Dodo subscription cancellation failed');
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          amount: amount ? Math.round(amount * 100) : undefined
        })
      });

      const refund = await response.json();

      if (!response.ok) {
        throw new Error(refund.message || 'Dodo refund failed');
      }

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: this.mapDodoRefundStatus(refund.status),
        providerResponse: refund
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
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      const payment = await response.json();

      if (!response.ok) {
        throw new Error(payment.message || 'Dodo payment status check failed');
      }

      return this.mapDodoStatus(payment.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload);
      return signature === expectedSignature;
    } catch (error) {
      console.error('Dodo webhook validation failed:', error);
      return false;
    }
  }

  private generateSignature(data: any): string {
    const crypto = require('crypto');
    const payload = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(payload)
      .digest('hex');
  }

  private generateWebhookSignature(payload: any): string {
    const crypto = require('crypto');
    const webhookSecret = this.config.webhookSecret || this.config.secretKey;
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private mapDodoStatus(status: string): PaymentStatus {
    switch (status.toLowerCase()) {
      case 'succeeded':
      case 'completed':
        return PaymentStatus.SUCCEEDED;
      case 'processing':
        return PaymentStatus.PROCESSING;
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

  private mapDodoSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'cancelled':
        return SubscriptionStatus.CANCELLED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapDodoRefundStatus(status: string): RefundStatus {
    switch (status.toLowerCase()) {
      case 'succeeded':
      case 'completed':
        return RefundStatus.SUCCEEDED;
      case 'pending':
        return RefundStatus.PENDING;
      case 'failed':
        return RefundStatus.FAILED;
      case 'cancelled':
        return RefundStatus.CANCELLED;
      default:
        return RefundStatus.FAILED;
    }
  }
}