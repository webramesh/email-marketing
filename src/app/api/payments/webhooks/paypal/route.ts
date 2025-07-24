import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';

const PAYMENT_CONFIGS = [
  {
    type: PaymentProviderType.PAYPAL,
    name: 'PayPal',
    isActive: true,
    priority: 1,
    config: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      webhookSecret: process.env.PAYPAL_WEBHOOK_SECRET,
      sandbox: process.env.NODE_ENV !== 'production'
    }
  }
];

const paymentService = new PaymentService(PAYMENT_CONFIGS);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('paypal-transmission-sig');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Validate webhook signature
    const isValid = paymentService.validateWebhook(
      body,
      signature,
      PaymentProviderType.PAYPAL
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    // Handle different PayPal events
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCompleted(event.resource);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentDenied(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.CREATED':
        await handleSubscriptionCreated(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await handleSubscriptionPaymentFailed(event.resource);
        break;

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentCompleted(payment: any) {
  console.log('PayPal payment completed:', payment.id);
  // Update payment status in database
  // Send confirmation email
  // Update user subscription status if applicable
}

async function handlePaymentDenied(payment: any) {
  console.log('PayPal payment denied:', payment.id);
  // Update payment status in database
  // Send failure notification
  // Handle retry logic if applicable
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('PayPal subscription created:', subscription.id);
  // Update user subscription in database
  // Send welcome email
  // Activate user features
}

async function handleSubscriptionCancelled(subscription: any) {
  console.log('PayPal subscription cancelled:', subscription.id);
  // Update subscription status in database
  // Schedule account deactivation
  // Send cancellation confirmation
}

async function handleSubscriptionSuspended(subscription: any) {
  console.log('PayPal subscription suspended:', subscription.id);
  // Update subscription status in database
  // Send suspension notification
  // Restrict user access
}

async function handleSubscriptionPaymentFailed(subscription: any) {
  console.log('PayPal subscription payment failed:', subscription.id);
  // Update subscription status
  // Send payment failure notification
  // Handle dunning management
}