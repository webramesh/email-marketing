import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';

const PAYMENT_CONFIGS = [
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    priority: 1,
    config: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      returnUrl: process.env.STRIPE_RETURN_URL
    }
  }
];

const paymentService = new PaymentService(PAYMENT_CONFIGS);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Validate webhook signature
    const isValid = paymentService.validateWebhook(
      body,
      signature,
      PaymentProviderType.STRIPE
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    // Handle different Stripe events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSucceeded(paymentIntent: any) {
  console.log('Payment succeeded:', paymentIntent.id);
  
  // Update payment status in database
  // Send confirmation email
  // Update user subscription status if applicable
  
  // This would typically update your database
  // await updatePaymentStatus(paymentIntent.id, 'succeeded');
}

async function handlePaymentFailed(paymentIntent: any) {
  console.log('Payment failed:', paymentIntent.id);
  
  // Update payment status in database
  // Send failure notification
  // Handle retry logic if applicable
  
  // This would typically update your database
  // await updatePaymentStatus(paymentIntent.id, 'failed');
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('Subscription created:', subscription.id);
  
  // Update user subscription in database
  // Send welcome email
  // Activate user features
  
  // This would typically update your database
  // await createSubscription(subscription);
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('Subscription updated:', subscription.id);
  
  // Update subscription details in database
  // Handle plan changes
  // Update user permissions
  
  // This would typically update your database
  // await updateSubscription(subscription);
}

async function handleSubscriptionCancelled(subscription: any) {
  console.log('Subscription cancelled:', subscription.id);
  
  // Update subscription status in database
  // Schedule account deactivation
  // Send cancellation confirmation
  
  // This would typically update your database
  // await cancelSubscription(subscription.id);
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('Invoice payment succeeded:', invoice.id);
  
  // Update invoice status
  // Send receipt
  // Extend subscription period
  
  // This would typically update your database
  // await updateInvoiceStatus(invoice.id, 'paid');
}

async function handleInvoicePaymentFailed(invoice: any) {
  console.log('Invoice payment failed:', invoice.id);
  
  // Update invoice status
  // Send payment failure notification
  // Handle dunning management
  
  // This would typically update your database
  // await updateInvoiceStatus(invoice.id, 'payment_failed');
}