import { NextRequest, NextResponse } from 'next/server';
import { BounceComplaintService } from '@/services/bounce-complaint.service';
import crypto from 'crypto';

const bounceComplaintService = new BounceComplaintService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const events = JSON.parse(body);

    // Verify SendGrid signature (optional but recommended)
    const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature');
    const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp');
    
    if (signature && timestamp) {
      const isValid = verifySendGridSignature(body, signature, timestamp);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Process each event
    for (const event of events) {
      // Extract tenant ID from custom args or unique args
      const tenantId = event.tenant_id || event.unique_args?.tenant_id;
      
      if (tenantId) {
        await bounceComplaintService.processSendGridWebhook(tenantId, [event]);
      }
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

function verifySendGridSignature(body: string, signature: string, timestamp: string): boolean {
  try {
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('SendGrid webhook secret not configured');
      return true; // Skip verification if secret not configured
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestamp + body)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch (error) {
    console.error('Error verifying SendGrid signature:', error);
    return false;
  }
}