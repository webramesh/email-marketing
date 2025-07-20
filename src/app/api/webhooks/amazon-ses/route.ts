import { NextRequest, NextResponse } from 'next/server';
import { BounceComplaintService } from '@/services/bounce-complaint.service';
import crypto from 'crypto';

const bounceComplaintService = new BounceComplaintService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = request.headers;

    // Verify SNS signature (in production, you should verify the signature)
    // const signature = headers.get('x-amz-sns-signature');
    // const signingCertUrl = headers.get('x-amz-sns-signing-cert-url');
    
    const data = JSON.parse(body);
    
    // Handle SNS subscription confirmation
    if (data.Type === 'SubscriptionConfirmation') {
      // In production, you would confirm the subscription
      console.log('SNS Subscription confirmation:', data.SubscribeURL);
      return NextResponse.json({ message: 'Subscription confirmed' });
    }

    // Handle SNS notifications
    if (data.Type === 'Notification') {
      // Extract tenant ID from the topic ARN or message attributes
      // This is a simplified example - in production, you'd have a more robust way to identify the tenant
      const tenantId = extractTenantIdFromSNS(data);
      
      if (tenantId) {
        await bounceComplaintService.processAmazonSESWebhook(tenantId, data);
      }
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Amazon SES webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

function extractTenantIdFromSNS(data: any): string | null {
  try {
    const message = JSON.parse(data.Message);
    // You could extract tenant ID from custom headers or message attributes
    // This is a simplified example
    return message.mail?.commonHeaders?.['X-Tenant-ID'] || null;
  } catch (error) {
    console.error('Error extracting tenant ID from SNS:', error);
    return null;
  }
}