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

export class PaddleProvider extends BasePaymentProvider {
  name = 'Paddle';
  type = PaymentProviderType.PADDLE;
  private baseUrl: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['apiKey', 'vendorId']);
    this.baseUrl = config.sandbox 
      ? 'https://sandbox-api.paddle.com' 
      : 'https://api.paddle.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Paddle uses a different flow - typically checkout sessions
      const response = await fetch(`${this.baseUrl}/2.0/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          items: [{
            price: {
              product_id: request.metadata?.productId,
              unit_price: {
                amount: Math.round(request.amount * 100).toString(),
                currency_code: request.currency.toUpperCase()
              }
            },
            quantity: 1
          }],
          customer_id: request.customerId,
          custom_data: request.metadata || {}
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle payment failed';
        throw new Error(errorMessage);
      }

      // Note: Paddle checkout sessions need to be completed by the user
      // This is a simplified implementation
      return {
        success: true,
        paymentId: result.data.id,
        status: PaymentStatus.PENDING, // Paddle payments start as pending
        amount: request.amount,
        currency: request.currency,
        providerResponse: result.data
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
      const response = await fetch(`${this.baseUrl}/2.0/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          email: customer.email,
          name: customer.name,
          custom_data: customer.metadata || {}
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle customer creation failed';
        throw new Error(errorMessage);
      }

      return {
        success: true,
        customerId: result.data.id,
        providerResponse: result.data
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
      const response = await fetch(`${this.baseUrl}/2.0/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          customer_id: subscription.customerId,
          items: [{
            price_id: subscription.planId,
            quantity: 1
          }],
          trial_period: subscription.trialDays ? {
            frequency: {
              interval: 'day',
              count: subscription.trialDays
            }
          } : undefined,
          custom_data: subscription.metadata || {}
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle subscription creation failed';
        throw new Error(errorMessage);
      }

      const paddleSubscription = result.data;

      return {
        success: true,
        subscriptionId: paddleSubscription.id,
        status: this.mapPaddleSubscriptionStatus(paddleSubscription.status),
        currentPeriodStart: new Date(paddleSubscription.current_billing_period?.starts_at),
        currentPeriodEnd: new Date(paddleSubscription.current_billing_period?.ends_at),
        providerResponse: paddleSubscription
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
      const response = await fetch(`${this.baseUrl}/2.0/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          effective_from: 'next_billing_period'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle subscription cancellation failed';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch(`${this.baseUrl}/2.0/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          action: 'refund',
          transaction_id: paymentId,
          items: amount ? [{
            type: 'partial',
            amount: Math.round(amount * 100).toString()
          }] : [{
            type: 'full'
          }]
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle refund failed';
        throw new Error(errorMessage);
      }

      const adjustment = result.data;

      return {
        success: true,
        refundId: adjustment.id,
        amount: amount || 0, // Paddle doesn't return refund amount directly
        status: this.mapPaddleAdjustmentStatus(adjustment.status),
        providerResponse: adjustment
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
      const response = await fetch(`${this.baseUrl}/2.0/transactions/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.detail || 'Paddle payment status check failed';
        throw new Error(errorMessage);
      }

      return this.mapPaddleTransactionStatus(result.data.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const webhookSecret = this.config.webhookSecret;
      
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      // Paddle uses HMAC SHA256 for webhook verification
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Paddle webhook validation failed:', error);
      return false;
    }
  }

  private mapPaddleTransactionStatus(status: string): PaymentStatus {
    switch (status?.toLowerCase()) {
      case 'completed':
        return PaymentStatus.SUCCEEDED;
      case 'pending':
        return PaymentStatus.PENDING;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'canceled':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapPaddleSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status?.toLowerCase()) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'paused':
        return SubscriptionStatus.PAST_DUE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapPaddleAdjustmentStatus(status: string): RefundStatus {
    switch (status?.toLowerCase()) {
      case 'approved':
        return RefundStatus.SUCCEEDED;
      case 'pending_approval':
        return RefundStatus.PENDING;
      case 'rejected':
        return RefundStatus.FAILED;
      default:
        return RefundStatus.PENDING;
    }
  }
}