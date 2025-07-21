import { NextRequest, NextResponse } from 'next/server';
import { EmailTrackingService } from '@/lib/tracking';
import { EmailEventType, SubscriberStatus } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const trackingData = EmailTrackingService.decryptTrackingData(token);

    if (!trackingData || trackingData.action !== 'unsubscribe') {
      return new NextResponse('Invalid unsubscribe token', { status: 400 });
    }

    const { subscriberId, tenantId } = trackingData;

    // Get subscriber information
    const subscriber = await prisma.subscriber.findFirst({
      where: { id: subscriberId, tenantId },
    });

    if (!subscriber) {
      return new NextResponse('Subscriber not found', { status: 404 });
    }

    // Update subscriber status to unsubscribed
    await prisma.subscriber.update({
      where: { id: subscriberId },
      data: { status: SubscriberStatus.UNSUBSCRIBED },
    });

    // Get client information
    const ipAddress = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 
      request.headers.get('cf-connecting-ip') ||
      'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Record the unsubscribe event
    await EmailTrackingService.recordEmailEvent(EmailEventType.UNSUBSCRIBED, {
      subscriberId,
      email: subscriber.email,
      tenantId,
      ipAddress,
      userAgent,
      metadata: {
        referer: request.headers.get('referer'),
        acceptLanguage: request.headers.get('accept-language'),
        trackingType: 'unsubscribe',
        unsubscribeMethod: 'link',
      },
    });

    // Return a simple unsubscribe confirmation page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .success-icon {
              font-size: 48px;
              color: #10b981;
              margin-bottom: 20px;
            }
            h1 {
              color: #1f2937;
              margin-bottom: 16px;
            }
            p {
              color: #6b7280;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Successfully Unsubscribed</h1>
            <p>You have been successfully unsubscribed from our mailing list.</p>
            <p>Email: ${subscriber.email}</p>
            <p>We're sorry to see you go. If you change your mind, you can always subscribe again.</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Unsubscribe tracking error:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .error-icon {
              font-size: 48px;
              color: #ef4444;
              margin-bottom: 20px;
            }
            h1 {
              color: #1f2937;
              margin-bottom: 16px;
            }
            p {
              color: #6b7280;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Unsubscribe Error</h1>
            <p>We encountered an error while processing your unsubscribe request.</p>
            <p>Please try again later or contact support if the problem persists.</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}