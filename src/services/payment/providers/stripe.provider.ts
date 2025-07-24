import Stripe from 'stripe';
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

export class StripeProvider extends BasePaymentProvider {
  name = 'Stripe';
  type = PaymentProviderType.STRIPE;
  private stripe: Stripe;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['secretKey']);
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2025-06-30.basil'
    });
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: request.currency.toLowerCase(),
        customer: request.customerId,
        payment_method: request.paymentMethodId,
        description: request.description,
        metadata: request.metadata || {},
        confirm: true,
        return_url: this.config.returnUrl || 'https://example.com/return'
      });

      return {
        success: paymentIntent.status === 'succeeded',
        paymentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        fees: undefined, // Fee information would need to be retrieved separately
        providerResponse: paymentIntent
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
      const stripeCustomer = await this.stripe.customers.create({
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address ? {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postal_code: customer.address.postalCode,
          country: customer.address.country
        } : undefined,
        metadata: customer.metadata || {}
      });

      return {
        success: true,
        customerId: stripeCustomer.id,
        providerResponse: stripeCustomer
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
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: subscription.customerId,
        items: [{ price: subscription.planId }],
        trial_period_days: subscription.trialDays,
        metadata: subscription.metadata || {}
      });

      return {
        success: true,
        subscriptionId: stripeSubscription.id,
        status: this.mapStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        providerResponse: stripeSubscription
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
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined
      });

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: this.mapStripeRefundStatus(refund.status || 'failed'),
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
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      return this.mapStripeStatus(paymentIntent.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      const webhookSecret = this.config.webhookSecret;
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      console.error('Stripe webhook validation failed:', error);
      return false;
    }
  }

  private mapStripeStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.PENDING;
      case 'canceled':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapStripeRefundStatus(status: string): RefundStatus {
    switch (status) {
      case 'succeeded':
        return RefundStatus.SUCCEEDED;
      case 'pending':
        return RefundStatus.PENDING;
      case 'failed':
        return RefundStatus.FAILED;
      case 'canceled':
        return RefundStatus.CANCELLED;
      default:
        return RefundStatus.FAILED;
    }
  }
}