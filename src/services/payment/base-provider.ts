import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  CustomerData,
  CustomerResult,
  SubscriptionRequest,
  SubscriptionResult,
  RefundResult,
  PaymentStatus,
  PaymentProviderType
} from '@/types/payment';

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract name: string;
  abstract type: PaymentProviderType;
  protected config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  abstract processPayment(request: PaymentRequest): Promise<PaymentResult>;
  abstract createCustomer(customer: CustomerData): Promise<CustomerResult>;
  abstract createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult>;
  abstract cancelSubscription(subscriptionId: string): Promise<void>;
  abstract refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  abstract getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  abstract validateWebhook(payload: any, signature: string): boolean;

  protected validateConfig(requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => !this.config[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
  }

  protected handleError(error: any, operation: string): never {
    console.error(`${this.name} ${operation} error:`, error);
    throw new Error(`${this.name} ${operation} failed: ${error.message || 'Unknown error'}`);
  }

  protected generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}