export interface PaymentProvider {
  name: string;
  type: PaymentProviderType;
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  createCustomer(customer: CustomerData): Promise<CustomerResult>;
  createSubscription(subscription: SubscriptionRequest): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  validateWebhook(payload: any, signature: string): boolean;
}

export enum PaymentProviderType {
  DODO = 'dodo',
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  BRAINTREE = 'braintree',
  SQUARE = 'square',
  PADDLE = 'paddle',
  PAYUMONEY = 'payumoney'
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  fees?: number;
  providerResponse?: any;
  error?: string;
}

export interface CustomerData {
  email: string;
  name?: string;
  phone?: string;
  address?: Address;
  metadata?: Record<string, any>;
}

export interface CustomerResult {
  success: boolean;
  customerId: string;
  providerResponse?: any;
  error?: string;
}

export interface SubscriptionRequest {
  customerId: string;
  planId: string;
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  providerResponse?: any;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: RefundStatus;
  providerResponse?: any;
  error?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  UNPAID = 'unpaid',
  TRIALING = 'trialing'
}

export enum RefundStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface PaymentProviderConfig {
  type: PaymentProviderType;
  name: string;
  isActive: boolean;
  config: Record<string, any>;
  webhookSecret?: string;
  priority: number;
}

export interface PaymentMethodData {
  id: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface BillingProfile {
  customerId: string;
  email: string;
  name?: string;
  address?: Address;
  paymentMethods: PaymentMethodData[];
  defaultPaymentMethodId?: string;
}

export interface FraudCheckResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  checks: {
    cvv: boolean;
    address: boolean;
    postalCode: boolean;
    deviceFingerprint?: boolean;
    ipReputation?: boolean;
    behaviorAnalysis?: boolean;
  };
  recommendation: 'approve' | 'review' | 'decline';
  reasons?: string[];
  timestamp: Date;
}

export interface PaymentAuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  type: PaymentAuditType;
  provider: PaymentProviderType;
  paymentId?: string;
  customerId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status: string;
  fraudScore?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  immutableHash: string;
}

export enum PaymentAuditType {
  PAYMENT_CREATED = 'payment_created',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  CUSTOMER_CREATED = 'customer_created',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PAYMENT_METHOD_ADDED = 'payment_method_added',
  PAYMENT_METHOD_REMOVED = 'payment_method_removed',
  PAYMENT_METHOD_UPDATED = 'payment_method_updated',
  FRAUD_DETECTED = 'fraud_detected',
  WEBHOOK_RECEIVED = 'webhook_received',
  SECURITY_EVENT = 'security_event'
}

export interface PaymentSecurityConfig {
  enableFraudDetection: boolean;
  fraudThresholds: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
  };
  enableDeviceFingerprinting: boolean;
  enableIpGeolocation: boolean;
  enableBehaviorAnalysis: boolean;
  requireCvvCheck: boolean;
  requireAddressVerification: boolean;
  maxDailyTransactions: number;
  maxDailyVolume: number;
  blockedCountries: string[];
  allowedCurrencies: string[];
}

export interface BillingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface EnhancedBillingProfile extends BillingProfile {
  billingAddress?: BillingAddress;
  taxId?: string;
  vatNumber?: string;
  businessType?: 'individual' | 'business' | 'non_profit';
  paymentHistory: PaymentHistoryItem[];
  subscriptions: SubscriptionSummary[];
  totalSpent: number;
  averageTransactionAmount: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastPaymentDate?: Date;
  preferredCurrency: string;
  autoPayEnabled: boolean;
}

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  date: Date;
  provider: PaymentProviderType;
  refunded?: boolean;
  refundAmount?: number;
}

export interface SubscriptionSummary {
  id: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'weekly' | 'daily';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

export interface PaymentMethodValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityChecks: {
    cvvValid: boolean;
    expiryValid: boolean;
    luhnValid: boolean;
    binValid: boolean;
  };
}

export interface PaymentProviderCapabilities {
  supportsSubscriptions: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsWebhooks: boolean;
  supportsMultiCurrency: boolean;
  supportedCurrencies: string[];
  supportsRecurringPayments: boolean;
  supportsInstallments: boolean;
  supportsDisputes: boolean;
  minimumAmount: number;
  maximumAmount: number;
  processingFees: {
    percentage: number;
    fixed: number;
    currency: string;
  };
}