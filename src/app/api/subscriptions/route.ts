import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SubscriptionService } from '@/services/subscription.service';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';

// Initialize services (in production, these would be dependency injected)
const paymentService = new PaymentService([
  {
    type: PaymentProviderType.STRIPE,
    name: 'Stripe',
    isActive: true,
    config: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
    priority: 1,
  },
]);

const subscriptionService = new SubscriptionService(paymentService);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'plans':
        const plans = await subscriptionService.getSubscriptionPlans();
        return NextResponse.json({ plans });

      case 'current':
        const subscription = await subscriptionService.getTenantSubscription(session.user.tenantId);
        return NextResponse.json({ subscription });

      case 'usage':
        const subscription2 = await subscriptionService.getTenantSubscription(
          session.user.tenantId
        );
        if (!subscription2) {
          return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
        }
        return NextResponse.json({
          usage: subscription2.usage,
          quotas: subscription2.quotas,
          limits: subscription2.plan.features,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create':
        const { planId, paymentProvider, billingAddress, trialDays } = data;
        const customerId = `cust_${session.user.tenantId}`;

        const subscription = await subscriptionService.createTenantSubscription(
          session.user.tenantId,
          planId,
          customerId,
          paymentProvider || PaymentProviderType.STRIPE,
          billingAddress,
          trialDays
        );

        return NextResponse.json({ subscription });

      case 'upgrade':
        const { newPlanId, prorationBehavior } = data;
        const upgradeResult = await subscriptionService.upgradeSubscription(
          session.user.tenantId,
          newPlanId,
          prorationBehavior
        );

        return NextResponse.json(upgradeResult);

      case 'downgrade':
        const { newPlanId: downgradePlanId, downgradeAt } = data;
        const downgradeResult = await subscriptionService.downgradeSubscription(
          session.user.tenantId,
          downgradePlanId,
          downgradeAt
        );

        return NextResponse.json(downgradeResult);

      case 'cancel':
        const { cancelAt } = data;
        const cancelledSubscription = await subscriptionService.cancelSubscription(
          session.user.tenantId,
          cancelAt
        );

        return NextResponse.json({ subscription: cancelledSubscription });

      case 'update_usage':
        const { resourceType, increment } = data;
        await subscriptionService.updateUsage(session.user.tenantId, resourceType, increment);

        return NextResponse.json({ success: true });

      case 'check_quota':
        const { resourceType: quotaResource, requestedAmount } = data;
        const quotaCheck = await subscriptionService.checkQuotaLimit(
          session.user.tenantId,
          quotaResource,
          requestedAmount
        );

        return NextResponse.json(quotaCheck);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
