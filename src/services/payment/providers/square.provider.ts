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

export class SquareProvider extends BasePaymentProvider {
  name = 'Square';
  type = PaymentProviderType.SQUARE;
  private baseUrl: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['accessToken', 'applicationId']);
    this.baseUrl = config.sandbox 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify({
          source_id: request.paymentMethodId,
          idempotency_key: request.idempotencyKey || this.generateIdempotencyKey(),
          amount_money: {
            amount: Math.round(request.amount * 100), // Convert to cents
            currency: request.currency.toUpperCase()
          },
          customer_id: request.customerId,
          note: request.description,
          app_fee_money: request.metadata?.appFee ? {
            amount: Math.round(request.metadata.appFee * 100),
            currency: request.currency.toUpperCase()
          } : undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square payment failed';
        throw new Error(errorMessage);
      }

      const payment = result.payment;

      return {
        success: payment.status === 'COMPLETED',
        paymentId: payment.id,
        status: this.mapSquareStatus(payment.status),
        amount: payment.amount_money.amount / 100,
        currency: payment.amount_money.currency,
        fees: payment.processing_fee?.[0]?.amount_money?.amount ? 
          payment.processing_fee[0].amount_money.amount / 100 : undefined,
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
      const response = await fetch(`${this.baseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify({
          given_name: customer.name?.split(' ')[0],
          family_name: customer.name?.split(' ').slice(1).join(' '),
          email_address: customer.email,
          phone_number: customer.phone,
          address: customer.address ? {
            address_line_1: customer.address.line1,
            address_line_2: customer.address.line2,
            locality: customer.address.city,
            administrative_district_level_1: customer.address.state,
            postal_code: customer.address.postalCode,
            country: customer.address.country
          } : undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square customer creation failed';
        throw new Error(errorMessage);
      }

      return {
        success: true,
        customerId: result.customer.id,
        providerResponse: result.customer
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
      const response = await fetch(`${this.baseUrl}/v2/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify({
          idempotency_key: this.generateIdempotencyKey(),
          location_id: this.config.locationId,
          plan_id: subscription.planId,
          customer_id: subscription.customerId,
          start_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          charged_through_date: subscription.trialDays ? 
            new Date(Date.now() + subscription.trialDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
            undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square subscription creation failed';
        throw new Error(errorMessage);
      }

      const squareSubscription = result.subscription;

      return {
        success: true,
        subscriptionId: squareSubscription.id,
        status: this.mapSquareSubscriptionStatus(squareSubscription.status),
        currentPeriodStart: new Date(squareSubscription.start_date),
        currentPeriodEnd: new Date(squareSubscription.charged_through_date || squareSubscription.start_date),
        providerResponse: squareSubscription
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
      const response = await fetch(`${this.baseUrl}/v2/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square subscription cancellation failed';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify({
          idempotency_key: this.generateIdempotencyKey(),
          payment_id: paymentId,
          amount_money: amount ? {
            amount: Math.round(amount * 100),
            currency: 'USD' // Default currency, should be passed as parameter
          } : undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square refund failed';
        throw new Error(errorMessage);
      }

      const refund = result.refund;

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount_money.amount / 100,
        status: this.mapSquareRefundStatus(refund.status),
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
      const response = await fetch(`${this.baseUrl}/v2/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Square-Version': '2024-12-18'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.errors?.[0]?.detail || 'Square payment status check failed';
        throw new Error(errorMessage);
      }

      return this.mapSquareStatus(result.payment.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const webhookSignatureKey = this.config.webhookSignatureKey;
      
      if (!webhookSignatureKey) {
        throw new Error('Webhook signature key not configured');
      }

      const expectedSignature = crypto
        .createHmac('sha1', webhookSignatureKey)
        .update(JSON.stringify(payload))
        .digest('base64');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Square webhook validation failed:', error);
      return false;
    }
  }

  private mapSquareStatus(status: string): PaymentStatus {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return PaymentStatus.SUCCEEDED;
      case 'PENDING':
        return PaymentStatus.PROCESSING;
      case 'APPROVED':
        return PaymentStatus.PENDING;
      case 'FAILED':
        return PaymentStatus.FAILED;
      case 'CANCELED':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapSquareSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return SubscriptionStatus.ACTIVE;
      case 'CANCELED':
        return SubscriptionStatus.CANCELLED;
      case 'DEACTIVATED':
        return SubscriptionStatus.CANCELLED;
      case 'PAUSED':
        return SubscriptionStatus.PAST_DUE;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapSquareRefundStatus(status: string): RefundStatus {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return RefundStatus.SUCCEEDED;
      case 'PENDING':
        return RefundStatus.PENDING;
      case 'FAILED':
        return RefundStatus.FAILED;
      case 'REJECTED':
        return RefundStatus.FAILED;
      default:
        return RefundStatus.PENDING;
    }
  }
}