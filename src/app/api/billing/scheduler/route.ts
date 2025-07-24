import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BillingSchedulerService } from '@/services/billing-scheduler.service';
import { PaymentService } from '@/services/payment/payment.service';
import { SubscriptionService } from '@/services/subscription.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const paymentService = new PaymentService([]);
    const subscriptionService = new SubscriptionService(paymentService);
    const scheduler = new BillingSchedulerService(paymentService, subscriptionService);

    switch (action) {
      case 'status':
        const status = scheduler.getStatus();
        return NextResponse.json({ status });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing scheduler API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    const paymentService = new PaymentService([]);
    const subscriptionService = new SubscriptionService(paymentService);
    const scheduler = new BillingSchedulerService(paymentService, subscriptionService);

    switch (action) {
      case 'start':
        scheduler.start();
        return NextResponse.json({ success: true, message: 'Billing scheduler started' });

      case 'stop':
        scheduler.stop();
        return NextResponse.json({ success: true, message: 'Billing scheduler stopped' });

      case 'trigger_billing':
        await scheduler.triggerBillingCycles();
        return NextResponse.json({ success: true, message: 'Billing cycles triggered' });

      case 'trigger_overage':
        const { tenantId } = data;
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }
        await scheduler.triggerOverageBilling(tenantId);
        return NextResponse.json({ success: true, message: 'Overage billing triggered' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing scheduler API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}