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

// Note: This implementation uses Braintree's REST API
export class BraintreeProvider extends BasePaymentProvider {
  name = 'Braintree';
  type = PaymentProviderType.BRAINTREE;
  private baseUrl: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.validateConfig(['merchantId', 'publicKey', 'privateKey']);
    this.baseUrl = config.sandbox 
      ? 'https://api.sandbox.braintreegateway.com' 
      : 'https://api.braintreegateway.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader()
        },
        body: this.buildTransactionXML({
          amount: request.amount.toFixed(2),
          payment_method_nonce: request.paymentMethodId,
          customer_id: request.customerId,
          order_id: request.metadata?.orderId,
          options: {
            submit_for_settlement: true
          }
        })
      });

      const xmlResponse = await response.text();
      const transaction = this.parseTransactionXML(xmlResponse);

      if (!response.ok || !transaction.success) {
        throw new Error(transaction.message || 'Braintree payment failed');
      }

      return {
        success: transaction.success,
        paymentId: transaction.id,
        status: this.mapBraintreeStatus(transaction.status),
        amount: parseFloat(transaction.amount),
        currency: transaction.currency_iso_code || 'USD',
        providerResponse: transaction
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
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader()
        },
        body: this.buildCustomerXML({
          email: customer.email,
          first_name: customer.name?.split(' ')[0],
          last_name: customer.name?.split(' ').slice(1).join(' '),
          phone: customer.phone
        })
      });

      const xmlResponse = await response.text();
      const customerResult = this.parseCustomerXML(xmlResponse);

      if (!response.ok || !customerResult.success) {
        throw new Error(customerResult.message || 'Braintree customer creation failed');
      }

      return {
        success: true,
        customerId: customerResult.id,
        providerResponse: customerResult
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
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader()
        },
        body: this.buildSubscriptionXML({
          payment_method_token: subscription.customerId, // Assuming this is a payment method token
          plan_id: subscription.planId,
          trial_duration: subscription.trialDays,
          trial_duration_unit: 'day'
        })
      });

      const xmlResponse = await response.text();
      const subscriptionResult = this.parseSubscriptionXML(xmlResponse);

      if (!response.ok || !subscriptionResult.success) {
        throw new Error(subscriptionResult.message || 'Braintree subscription creation failed');
      }

      return {
        success: true,
        subscriptionId: subscriptionResult.id,
        status: this.mapBraintreeSubscriptionStatus(subscriptionResult.status),
        currentPeriodStart: new Date(subscriptionResult.billing_period_start_date),
        currentPeriodEnd: new Date(subscriptionResult.billing_period_end_date),
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
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/subscriptions/${subscriptionId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });

      if (!response.ok) {
        const xmlResponse = await response.text();
        const error = this.parseErrorXML(xmlResponse);
        throw new Error(error.message || 'Braintree subscription cancellation failed');
      }
    } catch (error: any) {
      this.handleError(error, 'cancel subscription');
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/transactions/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader()
        },
        body: amount ? this.buildRefundXML({ amount: amount.toFixed(2) }) : '<transaction></transaction>'
      });

      const xmlResponse = await response.text();
      const refund = this.parseTransactionXML(xmlResponse);

      if (!response.ok || !refund.success) {
        throw new Error(refund.message || 'Braintree refund failed');
      }

      return {
        success: true,
        refundId: refund.id,
        amount: parseFloat(refund.amount),
        status: this.mapBraintreeRefundStatus(refund.status),
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
      const response = await fetch(`${this.baseUrl}/merchants/${this.config.merchantId}/transactions/${paymentId}`, {
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });

      const xmlResponse = await response.text();
      const transaction = this.parseTransactionXML(xmlResponse);

      if (!response.ok) {
        throw new Error(transaction.message || 'Braintree payment status check failed');
      }

      return this.mapBraintreeStatus(transaction.status);
    } catch (error: any) {
      this.handleError(error, 'get payment status');
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      // Braintree webhook validation would require their SDK
      // For now, return true (should implement proper validation in production)
      console.warn('Braintree webhook validation not fully implemented');
      return true;
    } catch (error) {
      console.error('Braintree webhook validation failed:', error);
      return false;
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.publicKey}:${this.config.privateKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private buildTransactionXML(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <transaction>
        <amount>${data.amount}</amount>
        <payment-method-nonce>${data.payment_method_nonce}</payment-method-nonce>
        ${data.customer_id ? `<customer-id>${data.customer_id}</customer-id>` : ''}
        ${data.order_id ? `<order-id>${data.order_id}</order-id>` : ''}
        <options>
          <submit-for-settlement>${data.options.submit_for_settlement}</submit-for-settlement>
        </options>
      </transaction>`;
  }

  private buildCustomerXML(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <customer>
        <email>${data.email}</email>
        ${data.first_name ? `<first-name>${data.first_name}</first-name>` : ''}
        ${data.last_name ? `<last-name>${data.last_name}</last-name>` : ''}
        ${data.phone ? `<phone>${data.phone}</phone>` : ''}
      </customer>`;
  }

  private buildSubscriptionXML(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <subscription>
        <payment-method-token>${data.payment_method_token}</payment-method-token>
        <plan-id>${data.plan_id}</plan-id>
        ${data.trial_duration ? `<trial-duration>${data.trial_duration}</trial-duration>` : ''}
        ${data.trial_duration_unit ? `<trial-duration-unit>${data.trial_duration_unit}</trial-duration-unit>` : ''}
      </subscription>`;
  }

  private buildRefundXML(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <transaction>
        <amount>${data.amount}</amount>
      </transaction>`;
  }

  private parseTransactionXML(xml: string): any {
    // Simplified XML parsing - in production, use a proper XML parser
    const success = xml.includes('<success type="boolean">true</success>');
    const id = this.extractXMLValue(xml, 'id');
    const status = this.extractXMLValue(xml, 'status');
    const amount = this.extractXMLValue(xml, 'amount');
    const currency = this.extractXMLValue(xml, 'currency-iso-code');
    const message = this.extractXMLValue(xml, 'message');

    return { success, id, status, amount, currency_iso_code: currency, message };
  }

  private parseCustomerXML(xml: string): any {
    const success = xml.includes('<success type="boolean">true</success>');
    const id = this.extractXMLValue(xml, 'id');
    const message = this.extractXMLValue(xml, 'message');

    return { success, id, message };
  }

  private parseSubscriptionXML(xml: string): any {
    const success = xml.includes('<success type="boolean">true</success>');
    const id = this.extractXMLValue(xml, 'id');
    const status = this.extractXMLValue(xml, 'status');
    const billingPeriodStartDate = this.extractXMLValue(xml, 'billing-period-start-date');
    const billingPeriodEndDate = this.extractXMLValue(xml, 'billing-period-end-date');
    const message = this.extractXMLValue(xml, 'message');

    return { 
      success, 
      id, 
      status, 
      billing_period_start_date: billingPeriodStartDate,
      billing_period_end_date: billingPeriodEndDate,
      message 
    };
  }

  private parseErrorXML(xml: string): any {
    const message = this.extractXMLValue(xml, 'message');
    return { message };
  }

  private extractXMLValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  }

  private mapBraintreeStatus(status: string): PaymentStatus {
    switch (status?.toLowerCase()) {
      case 'settled':
      case 'submitted_for_settlement':
        return PaymentStatus.SUCCEEDED;
      case 'authorized':
        return PaymentStatus.PROCESSING;
      case 'processor_declined':
      case 'gateway_rejected':
      case 'failed':
        return PaymentStatus.FAILED;
      case 'voided':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapBraintreeSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status?.toLowerCase()) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'expired':
        return SubscriptionStatus.CANCELLED;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }

  private mapBraintreeRefundStatus(status: string): RefundStatus {
    switch (status?.toLowerCase()) {
      case 'settled':
        return RefundStatus.SUCCEEDED;
      case 'submitted_for_settlement':
        return RefundStatus.PENDING;
      case 'failed':
        return RefundStatus.FAILED;
      case 'voided':
        return RefundStatus.CANCELLED;
      default:
        return RefundStatus.PENDING;
    }
  }
}