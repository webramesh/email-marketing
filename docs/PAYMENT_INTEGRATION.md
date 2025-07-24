# Multi-Provider Payment Integration

This document describes the comprehensive multi-provider payment integration system implemented for the email marketing platform.

## Overview

The payment system supports 7 major payment providers with unified interfaces, advanced fraud detection, comprehensive audit logging, and enterprise-grade security measures.

## Supported Payment Providers

### 1. Stripe
- **Capabilities**: Full-featured with subscriptions, refunds, multi-currency
- **Currencies**: USD, EUR, GBP, CAD, AUD, JPY, CHF, SEK, NOK, DKK
- **Fees**: 2.9% + $0.30 USD
- **Limits**: $0.50 - $999,999.99
- **Features**: Subscriptions, partial refunds, disputes, installments

### 2. PayPal
- **Capabilities**: Subscriptions, refunds, multi-currency
- **Currencies**: USD, EUR, GBP, CAD, AUD, JPY
- **Fees**: 3.49% + $0.49 USD
- **Limits**: $1.00 - $10,000.00
- **Features**: Subscriptions, refunds, disputes

### 3. Square
- **Capabilities**: Subscriptions, refunds, US-focused
- **Currencies**: USD only
- **Fees**: 2.6% + $0.10 USD
- **Limits**: $1.00 - $50,000.00
- **Features**: Subscriptions, refunds, disputes

### 4. Braintree (PayPal)
- **Capabilities**: Full-featured payment processing
- **Currencies**: USD, EUR, GBP, AUD, CAD
- **Fees**: 2.9% + $0.30 USD
- **Limits**: $1.00 - $100,000.00
- **Features**: Subscriptions, refunds, disputes

### 5. Paddle
- **Capabilities**: SaaS-focused payment processing
- **Currencies**: USD, EUR, GBP
- **Fees**: 5.0% + $0.50 USD
- **Limits**: $1.00 - $999,999.99
- **Features**: Subscriptions, refunds (full only)

### 6. Dodo Payments
- **Capabilities**: Modern payment processing with competitive rates
- **Currencies**: USD, EUR, GBP, INR, AUD
- **Fees**: 2.5% + $0.25 USD
- **Limits**: $0.50 - $500,000.00
- **Features**: Subscriptions, partial refunds, disputes, installments

### 7. PayUMoney
- **Capabilities**: India-focused payment processing
- **Currencies**: INR only
- **Fees**: 2.0% (no fixed fee)
- **Limits**: ₹10.00 - ₹200,000.00
- **Features**: Refunds, installments (no subscriptions)

## Architecture

### Core Components

1. **PaymentService**: Main orchestrator for all payment operations
2. **BasePaymentProvider**: Abstract base class for all providers
3. **Provider Implementations**: Specific implementations for each provider
4. **ProviderCapabilitiesService**: Manages provider capabilities and recommendations
5. **PaymentMethodService**: Handles payment method validation and management

### Key Features

#### Unified Interface
All providers implement the same interface:
```typescript
interface PaymentProvider {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  createCustomer(customer: CustomerData): Promise<CustomerResult>;
  createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  validateWebhook(payload: any, signature: string): boolean;
}
```

#### Provider Abstraction
The system automatically:
- Routes payments to the best provider based on amount, currency, and requirements
- Handles provider failover for high availability
- Manages provider-specific configurations and capabilities

#### Advanced Fraud Detection
The fraud detection system analyzes:
- Transaction amounts and patterns
- Currency risk assessment
- Geographic and IP-based risk factors
- Device fingerprinting and behavior analysis
- Payment method risk assessment
- Machine learning risk scores

Risk levels are categorized as:
- **Low Risk** (< 15 points): Auto-approve
- **Medium Risk** (15-40 points): Manual review
- **High Risk** (40-70 points): Manual review required
- **Very High Risk** (> 70 points): Auto-decline

#### Comprehensive Audit Logging
All payment operations are logged with:
- Immutable audit trails with cryptographic hashing
- Tenant isolation for multi-tenant security
- Fraud detection results and risk scores
- Complete request/response metadata
- IP addresses and user agent tracking
- Compliance with PCI DSS requirements

## API Usage

### Processing Payments

```typescript
// Basic payment processing
const result = await paymentService.processPayment({
  amount: 99.99,
  currency: 'USD',
  customerId: 'cus_123',
  paymentMethodId: 'pm_456',
  description: 'Monthly subscription'
});

// With specific provider
const result = await paymentService.processPayment(
  paymentRequest,
  PaymentProviderType.STRIPE
);
```

### Customer Management

```typescript
// Create customer
const customer = await paymentService.createCustomer({
  email: 'customer@example.com',
  name: 'John Doe',
  address: {
    line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'US'
  }
});
```

### Subscription Management

```typescript
// Create subscription
const subscription = await paymentService.createSubscription({
  customerId: 'cus_123',
  planId: 'plan_monthly',
  trialDays: 14
});

// Cancel subscription
await paymentService.cancelSubscription('sub_123');
```

### Provider Capabilities

```typescript
// Get provider capabilities
const capabilities = paymentService.getProviderCapabilities(PaymentProviderType.STRIPE);

// Get best provider for transaction
const bestProvider = paymentService.getBestProviderForTransaction(
  100,
  'USD',
  true // requires subscriptions
);

// Get provider recommendations
const recommendations = paymentService.getProviderRecommendations({
  averageAmount: 100,
  currency: 'USD',
  volume: 1000,
  requiresSubscriptions: true,
  requiresDisputes: true,
  internationalCustomers: true
});
```

## Security Features

### Payment Method Validation
- Luhn algorithm validation for card numbers
- CVV validation (3-4 digits based on card type)
- Expiry date validation
- Card brand detection (Visa, Mastercard, Amex, etc.)
- Address verification support

### Fraud Prevention
- Real-time risk scoring
- Device fingerprinting
- IP geolocation and reputation checking
- Behavioral analysis
- Velocity checking (transaction frequency/volume)
- Blocked country lists
- Currency risk assessment

### Data Security
- PCI DSS Level 1 compliance
- Encryption at rest and in transit
- Secure tokenization of payment methods
- Audit logging with immutable records
- Tenant isolation for multi-tenant security

## Configuration

### Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_SECRET=...

# Square
SQUARE_ACCESS_TOKEN=...
SQUARE_APPLICATION_ID=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...

# Braintree
BRAINTREE_MERCHANT_ID=...
BRAINTREE_PUBLIC_KEY=...
BRAINTREE_PRIVATE_KEY=...

# Paddle
PADDLE_API_KEY=...
PADDLE_VENDOR_ID=...
PADDLE_WEBHOOK_SECRET=...

# Dodo Payments
DODO_API_KEY=...
DODO_SECRET_KEY=...
DODO_WEBHOOK_SECRET=...

# PayUMoney
PAYUMONEY_MERCHANT_KEY=...
PAYUMONEY_MERCHANT_SALT=...
```

### Provider Configuration

```typescript
const paymentConfigs: PaymentProviderConfig[] = [
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    priority: 1,
    config: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    }
  },
  // ... other providers
];
```

## Webhook Handling

### Stripe Webhooks
Supported events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### PayPal Webhooks
Supported events:
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

## Testing

### Unit Tests
- Provider-specific functionality testing
- Fraud detection algorithm testing
- Payment method validation testing
- Capabilities service testing

### Integration Tests
- End-to-end payment flows
- Webhook processing
- Provider failover scenarios
- Multi-tenant isolation

### Security Tests
- Fraud detection accuracy
- Audit logging integrity
- Data encryption validation
- Access control verification

## Monitoring and Alerts

### Key Metrics
- Payment success rates by provider
- Average processing times
- Fraud detection accuracy
- Provider availability
- Transaction volumes and values

### Alerts
- High fraud risk transactions
- Provider failures or downtime
- Unusual transaction patterns
- Security incidents
- Compliance violations

## Compliance

### PCI DSS
- Level 1 compliance maintained
- Regular security assessments
- Secure coding practices
- Network security controls

### Data Privacy
- GDPR compliance for EU customers
- Data retention policies
- Right to deletion support
- Privacy by design principles

## Best Practices

### Provider Selection
1. Consider transaction volume and average amounts
2. Evaluate currency requirements
3. Assess feature needs (subscriptions, disputes)
4. Compare processing fees
5. Consider geographic coverage

### Security
1. Enable all fraud detection features
2. Regularly review risk thresholds
3. Monitor audit logs for anomalies
4. Keep provider credentials secure
5. Implement proper access controls

### Performance
1. Use provider failover for high availability
2. Monitor response times and success rates
3. Implement proper caching strategies
4. Optimize database queries
5. Use connection pooling

## Troubleshooting

### Common Issues
1. **Provider Authentication Failures**: Check API keys and secrets
2. **Webhook Validation Errors**: Verify webhook secrets and signatures
3. **Currency Not Supported**: Check provider capabilities
4. **Amount Limits Exceeded**: Validate against provider limits
5. **Fraud Detection False Positives**: Adjust risk thresholds

### Debug Tools
- Comprehensive logging with structured data
- Provider-specific error codes and messages
- Transaction tracing and correlation IDs
- Real-time monitoring dashboards
- Audit trail analysis tools

## Future Enhancements

### Planned Features
1. Additional payment providers (Apple Pay, Google Pay)
2. Cryptocurrency payment support
3. Advanced machine learning fraud detection
4. Real-time analytics dashboard
5. Automated provider optimization

### Scalability Improvements
1. Horizontal scaling with load balancing
2. Database sharding for high volume
3. Caching layer optimization
4. Async processing for webhooks
5. Multi-region deployment support