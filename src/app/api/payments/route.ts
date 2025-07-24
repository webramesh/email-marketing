import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';
import { auth } from '@/lib/auth';

// This would typically come from environment variables or database
const PAYMENT_CONFIGS = [
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    priority: 1,
    config: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      returnUrl: process.env.STRIPE_RETURN_URL,
    },
  },
  {
    type: PaymentProviderType.PAYPAL,
    name: 'PayPal',
    isActive: true,
    priority: 2,
    config: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      sandbox: process.env.NODE_ENV !== 'production',
    },
  },
  {
    type: PaymentProviderType.DODO,
    name: 'Dodo Payments',
    isActive: true,
    priority: 3,
    config: {
      apiKey: process.env.DODO_API_KEY,
      secretKey: process.env.DODO_SECRET_KEY,
      sandbox: process.env.NODE_ENV !== 'production',
    },
  },
];

const paymentService = new PaymentService(PAYMENT_CONFIGS);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    // Extract request metadata for security and audit logging
    const requestMetadata = {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      ...data.metadata,
    };

    // Input validation and sanitization
    const validateAmount = (amount: number) => {
      if (typeof amount !== 'number' || amount <= 0 || amount > 1000000) {
        throw new Error('Invalid amount');
      }
    };

    const validateCurrency = (currency: string) => {
      const allowedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
      if (!allowedCurrencies.includes(currency?.toUpperCase())) {
        throw new Error('Unsupported currency');
      }
    };

    switch (action) {
      case 'process_payment':
        validateAmount(data.amount);
        validateCurrency(data.currency || 'USD');

        if (!data.customerId || !data.paymentMethodId) {
          return NextResponse.json(
            { error: 'Customer ID and payment method ID are required' },
            { status: 400 }
          );
        }

        const paymentResult = await paymentService.processPayment(
          {
            amount: data.amount,
            currency: (data.currency || 'USD').toUpperCase(),
            customerId: data.customerId,
            paymentMethodId: data.paymentMethodId,
            description: data.description || 'Payment',
            idempotencyKey: data.idempotencyKey,
            metadata: requestMetadata,
          },
          data.provider
        );

        return NextResponse.json(paymentResult);

      case 'create_customer':
        if (!data.email || !data.email.includes('@')) {
          return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
        }

        const customerResult = await paymentService.createCustomer(
          {
            email: data.email.toLowerCase().trim(),
            name: data.name?.trim(),
            phone: data.phone?.trim(),
            address: data.address,
            metadata: requestMetadata,
          },
          data.provider
        );

        return NextResponse.json(customerResult);

      case 'create_subscription':
        if (!data.customerId || !data.planId) {
          return NextResponse.json(
            { error: 'Customer ID and plan ID are required' },
            { status: 400 }
          );
        }

        const subscriptionResult = await paymentService.createSubscription(
          {
            customerId: data.customerId,
            planId: data.planId,
            trialDays: data.trialDays,
            metadata: requestMetadata,
          },
          data.provider
        );

        return NextResponse.json(subscriptionResult);

      case 'refund_payment':
        if (!data.paymentId) {
          return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
        }

        if (data.amount) {
          validateAmount(data.amount);
        }

        const refundResult = await paymentService.refundPayment(
          data.paymentId,
          data.amount,
          data.provider
        );

        return NextResponse.json(refundResult);

      case 'get_payment_status':
        if (!data.paymentId) {
          return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
        }

        const status = await paymentService.getPaymentStatus(data.paymentId, data.provider);

        return NextResponse.json({ status });

      case 'get_providers':
        const providers = paymentService.getAvailableProviders();
        return NextResponse.json({ providers });

      case 'get_provider_capabilities':
        if (!data.provider) {
          return NextResponse.json({ error: 'Provider type is required' }, { status: 400 });
        }
        const capabilities = paymentService.getProviderCapabilities(data.provider);
        return NextResponse.json({ capabilities });

      case 'get_all_capabilities':
        const allCapabilities = paymentService.getAllProviderCapabilities();
        return NextResponse.json({ capabilities: allCapabilities });

      case 'validate_payment_amount':
        validateAmount(data.amount);
        validateCurrency(data.currency || 'USD');

        const validation = paymentService.validatePaymentAmount(
          data.amount,
          data.currency || 'USD',
          data.provider
        );
        return NextResponse.json({ validation });

      case 'calculate_fees':
        validateAmount(data.amount);

        const fees = paymentService.calculateProcessingFees(data.amount, data.provider);
        return NextResponse.json({ fees });

      case 'get_best_provider':
        validateAmount(data.amount);
        validateCurrency(data.currency || 'USD');

        const bestProvider = paymentService.getBestProviderForTransaction(
          data.amount,
          data.currency || 'USD',
          data.requiresSubscription || false
        );
        return NextResponse.json({ bestProvider });

      case 'get_provider_recommendations':
        if (!data.transactionProfile) {
          return NextResponse.json({ error: 'Transaction profile is required' }, { status: 400 });
        }

        const recommendations = paymentService.getProviderRecommendations(data.transactionProfile);
        return NextResponse.json({ recommendations });

      case 'add_payment_method':
        if (!data.customerId || !data.paymentMethod) {
          return NextResponse.json(
            { error: 'Customer ID and payment method data are required' },
            { status: 400 }
          );
        }

        // Validate payment method data
        const paymentMethod = data.paymentMethod;
        if (!paymentMethod.type || !paymentMethod.last4) {
          return NextResponse.json({ error: 'Invalid payment method data' }, { status: 400 });
        }

        const addResult = await paymentService.addPaymentMethod(
          data.customerId,
          {
            ...paymentMethod,
            metadata: requestMetadata,
          },
          data.provider
        );
        return NextResponse.json({ paymentMethod: addResult });

      case 'remove_payment_method':
        if (!data.paymentMethodId) {
          return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
        }

        await paymentService.removePaymentMethod(data.paymentMethodId, data.provider);
        return NextResponse.json({ success: true });

      case 'set_default_payment_method':
        if (!data.customerId || !data.paymentMethodId) {
          return NextResponse.json(
            { error: 'Customer ID and payment method ID are required' },
            { status: 400 }
          );
        }

        await paymentService.setDefaultPaymentMethod(
          data.customerId,
          data.paymentMethodId,
          data.provider
        );
        return NextResponse.json({ success: true });

      case 'cancel_subscription':
        if (!data.subscriptionId) {
          return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
        }

        await paymentService.cancelSubscription(data.subscriptionId, data.provider);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Payment API error:', error);

    // Log security-related errors
    if (error.message?.includes('fraud') || error.message?.includes('security')) {
      console.warn('PAYMENT_SECURITY_ERROR:', {
        error: error.message,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
    }

    // Return appropriate error response
    const statusCode =
      error.message?.includes('Invalid') || error.message?.includes('required') ? 400 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'providers':
        const providers = paymentService.getAvailableProviders();
        return NextResponse.json({ providers });

      case 'billing_profile':
        const customerId = searchParams.get('customerId');
        const provider = searchParams.get('provider') as PaymentProviderType;

        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }

        const billingProfile = await paymentService.getBillingProfile(customerId, provider);
        return NextResponse.json({ billingProfile });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
