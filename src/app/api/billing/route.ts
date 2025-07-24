import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BillingService } from '@/services/billing.service';
import { SubscriptionService } from '@/services/subscription.service';
import { PaymentService } from '@/services/payment/payment.service';
import { PaymentProviderType } from '@/types/payment';
import { prisma } from '@/lib/prisma';

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
const billingService = new BillingService(paymentService, subscriptionService);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'invoices':
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const subscription = await subscriptionService.getTenantSubscription(session.user.tenantId);
        if (!subscription) {
          return NextResponse.json({ invoices: [] });
        }

        const invoices = await prisma.invoice.findMany({
          where: {
            subscriptionId: subscription.id,
            ...(startDate &&
              endDate && {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }),
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const formattedInvoices = invoices.map((invoice: any) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status.toLowerCase(),
          currency: invoice.currency,
          total: invoice.total,
          amountPaid: invoice.amountPaid,
          amountDue: invoice.amountDue,
          dueDate: invoice.dueDate.toISOString(),
          paidAt: invoice.paidAt?.toISOString(),
          periodStart: invoice.periodStart.toISOString(),
          periodEnd: invoice.periodEnd.toISOString(),
          lineItems: invoice.lineItems,
        }));

        return NextResponse.json({ invoices: formattedInvoices });

      case 'report':
        const reportStartDate = new Date(
          searchParams.get('startDate') || Date.now() - 30 * 24 * 60 * 60 * 1000
        );
        const reportEndDate = new Date(searchParams.get('endDate') || Date.now());

        const report = await billingService.generateBillingReport(
          session.user.tenantId,
          reportStartDate,
          reportEndDate
        );

        return NextResponse.json({ report });

      case 'upcoming':
        const upcomingSubscription = await subscriptionService.getTenantSubscription(
          session.user.tenantId
        );
        if (!upcomingSubscription) {
          return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
        }

        const upcomingInvoice = await subscriptionService.generateInvoice(
          session.user.tenantId,
          upcomingSubscription.currentPeriodStart,
          upcomingSubscription.currentPeriodEnd
        );

        return NextResponse.json({ invoice: upcomingInvoice });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API error:', error);
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
      case 'process_overage':
        await billingService.processOverageBilling(session.user.tenantId);
        return NextResponse.json({ success: true });

      case 'retry_payment':
        const { invoiceId } = data;

        if (!invoiceId) {
          return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        // Get the invoice
        const invoiceRecord = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        });

        if (!invoiceRecord) {
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        if (invoiceRecord.subscription.tenantId !== session.user.tenantId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (invoiceRecord.status !== 'OPEN' || invoiceRecord.amountDue <= 0) {
          return NextResponse.json({ error: 'Invoice cannot be retried' }, { status: 400 });
        }

        // Convert invoice to the format expected by billing service
        const invoiceForPayment = {
          id: invoiceRecord.id,
          tenantId: invoiceRecord.subscription.tenantId,
          subscriptionId: invoiceRecord.subscriptionId,
          invoiceNumber: invoiceRecord.invoiceNumber,
          status: invoiceRecord.status.toLowerCase() as 'open',
          currency: invoiceRecord.currency,
          subtotal: invoiceRecord.subtotal,
          taxAmount: invoiceRecord.taxAmount,
          discountAmount: invoiceRecord.discountAmount,
          total: invoiceRecord.total,
          amountPaid: invoiceRecord.amountPaid,
          amountDue: invoiceRecord.amountDue,
          dueDate: invoiceRecord.dueDate,
          paidAt: invoiceRecord.paidAt || undefined,
          periodStart: invoiceRecord.periodStart,
          periodEnd: invoiceRecord.periodEnd,
          lineItems: invoiceRecord.lineItems as any,
          billingAddress: invoiceRecord.billingAddress as any,
          paymentProvider: invoiceRecord.paymentProvider as any,
          providerInvoiceId: invoiceRecord.providerInvoiceId || undefined,
          metadata: invoiceRecord.metadata as any,
          createdAt: invoiceRecord.createdAt,
          updatedAt: invoiceRecord.updatedAt,
        };

        const subscription = {
          id: invoiceRecord.subscription.id,
          tenantId: invoiceRecord.subscription.tenantId,
          planId: invoiceRecord.subscription.planId,
          plan: {
            ...invoiceRecord.subscription.plan,
            description: invoiceRecord.subscription.plan.description || undefined,
            trialDays: invoiceRecord.subscription.plan.trialDays || undefined,
            setupFee: invoiceRecord.subscription.plan.setupFee || undefined,
            billingCycle: invoiceRecord.subscription.plan.billingCycle as
              | 'monthly'
              | 'yearly'
              | 'weekly',
            features: invoiceRecord.subscription.plan.features as any,
            quotas: invoiceRecord.subscription.plan.quotas as any,
            metadata:
              invoiceRecord.subscription.plan.metadata &&
              typeof invoiceRecord.subscription.plan.metadata === 'object' &&
              !Array.isArray(invoiceRecord.subscription.plan.metadata)
                ? (invoiceRecord.subscription.plan.metadata as Record<string, any>)
                : undefined,
          },
          status: invoiceRecord.subscription.status as any,
          currentPeriodStart: invoiceRecord.subscription.currentPeriodStart,
          currentPeriodEnd: invoiceRecord.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: invoiceRecord.subscription.cancelAtPeriodEnd,
          trialEnd: invoiceRecord.subscription.trialEnd || undefined,
          customerId: invoiceRecord.subscription.customerId,
          subscriptionId: invoiceRecord.subscription.subscriptionId,
          paymentProvider: invoiceRecord.subscription.paymentProvider as any,
          quotas: invoiceRecord.subscription.quotas as any,
          usage: invoiceRecord.subscription.usage as any,
          billingAddress: invoiceRecord.subscription.billingAddress as any,
          taxRate: invoiceRecord.subscription.taxRate || undefined,
          discountId: invoiceRecord.subscription.discountId || undefined,
          metadata:
            invoiceRecord.subscription.metadata &&
            typeof invoiceRecord.subscription.metadata === 'object' &&
            !Array.isArray(invoiceRecord.subscription.metadata)
              ? (invoiceRecord.subscription.metadata as Record<string, any>)
              : undefined,
          createdAt: invoiceRecord.subscription.createdAt,
          updatedAt: invoiceRecord.subscription.updatedAt,
        };

        // Attempt payment
        const paymentResult = await billingService.processInvoicePayment(
          invoiceForPayment,
          subscription
        );

        if (paymentResult.success) {
          // Update invoice status
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'PAID',
              amountPaid: invoiceRecord.total,
              amountDue: 0,
              paidAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return NextResponse.json({
            success: true,
            message: 'Payment processed successfully',
            paymentId: paymentResult.paymentId,
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              error: paymentResult.error || 'Payment failed',
            },
            { status: 400 }
          );
        }

      case 'generate_invoice':
        const { periodStart, periodEnd } = data;
        const generatedInvoice = await subscriptionService.generateInvoice(
          session.user.tenantId,
          new Date(periodStart),
          new Date(periodEnd)
        );

        return NextResponse.json({ invoice: generatedInvoice });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Billing API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
