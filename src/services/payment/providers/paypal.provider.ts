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

// Note: Using basic HTTP client for PayPal API calls since the SDK is deprecated
export class PayPalProvider extends BasePaymentProvider {
  name = 'PayPal';
  type = PaymentProviderType.PAYPAL;
  private baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['clientId', 'clientSecret']);
    this.baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      await this.ensureAccessToken();

      const orderResponse = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'PayPal-Request-Id': request.idempotencyKey || this.generateIdempotencyKey()
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: request.currency.toUpperCase(),
              value: request.amount.toFixed(2)
            },
            description: request.description
          }]
        })
      });

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.message || 'PayPal order creation failed');
      }

      // For immediate capture (simplified flow)
      const captureResponse = await fetch(`${this.baseUrl}/v2/checkout/orders/${order.id}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const captureResult = await captureResponse.json();

      if (!captureResponse.ok) {
        throw new Error(captureResult.message || 'PayPal capture failed');
      }

      const capture = captureResult.purchase_units[0].payments.captures[0];

      return {
        success: capture.status === 'COMPLETED',
        paymentId: capture.id,
        status: this.mapPayPalStatus(capture.status),
        amount: parseFloat(capture.amount.value),
        currency: capture.amount.currency_code,
        providerResponse: captureResult
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
    // PayPal doesn't have a direct customer creation API like Stripe
    // We'll store customer data locally and use it for future transactions
    return {
      success: true,
      customerId: `paypal_${customer.email}_${Date.now()}`,
      providerResponse: { email: customer.email, name: customer.name }
    };
  }

  async createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult> {
    try {
      await this.ensureAccessToken();

      const subscriptionResponse = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          plan_id: subscription.planId,
          subscriber: {
            email_address: subscription.customerId // Assuming customerId is email for PayPal
          }
        })
      });

      const subscriptionResult = await subscriptionResponse.json();

      if (!subscriptionResponse.ok) {
        throw new Error(subscriptionResult.message || 'PayPal subscription creation failed');
      }

      return {
        success: true,
        subscriptionId: subscriptionResult.id,
        status: this.mapPayPalSubscriptionStatus(subscriptionResult.status),
        currentPeriodStart: new Date(subscriptionResult.start_time),
        currentPeriodEnd: new Date(), // PayPal doesn't provide this directly
        providerResponse: subscriptionResult
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
      await this.ensureAccessToken();

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          reason: 'User requested cancellation'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PayPal subscription cancellation failed');
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      await this.ensureAccessToken();

      const refundData: any = {};
      if (amount) {
        refundData.amount = {
          value: amount.toFixed(2),
          currency_code: 'USD' // Default currency, should be passed as parameter
        };
      }

      const response = await fetch(`${this.baseUrl}/v2/payments/captures/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(refundData)
      });

      const refund = await response.json();

      if (!response.ok) {
        throw new Error(refund.message || 'PayPal refund failed');
      }

      return {
        success: true,
        refundId: refund.id,
        amount: parseFloat(refund.amount.value),
        status: this.mapPayPalRefundStatus(refund.status),
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
      await this.ensureAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/payments/captures/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const payment = await response.json();

      if (!response.ok) {
        throw new Error(payment.message || 'PayPal payment status check failed');
      }

      return this.mapPayPalStatus(payment.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    // PayPal webhook validation would require additional setup
    // For now, return true (should implement proper validation in production)
    console.warn('PayPal webhook validation not fully implemented');
    return true;
  }

  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await response.json();

    if (!response.ok) {
      throw new Error(tokenData.error_description || 'PayPal authentication failed');
    }

    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
  }

  private mapPayPalStatus(status: string): PaymentStatus {
    switch (status.toLowerCase()) {
      case 'completed':
        return PaymentStatus.SUCCEEDED;
      case 'pending':
        return PaymentStatus.PENDING;
      case 'declined':
      case 'failed':
        return PaymentStatus.FAILED;
      case 'cancelled':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapPayPalSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'cancelled':
        return SubscriptionStatus.CANCELLED;
      case 'suspended':
        return SubscriptionStatus.PAST_DUE;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapPayPalRefundStatus(status: string): RefundStatus {
    switch (status.toLowerCase()) {
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