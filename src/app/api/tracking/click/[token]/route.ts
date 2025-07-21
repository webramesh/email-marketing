import { NextRequest, NextResponse } from 'next/server';
import { EmailTrackingService } from '@/lib/tracking';
import { EmailEventType } from '@/generated/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const trackingData = EmailTrackingService.decryptTrackingData(token);

    if (!trackingData) {
      return NextResponse.redirect('https://example.com', 302);
    }

    const { campaignId, subscriberId, tenantId, originalUrl, linkId } = trackingData;

    // Get client information
    const ipAddress = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 
      request.headers.get('cf-connecting-ip') ||
      'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Record the click event
    await EmailTrackingService.recordEmailEvent(EmailEventType.CLICKED, {
      campaignId,
      subscriberId,
      email: '', // Will be fetched automatically by the service
      tenantId,
      ipAddress,
      userAgent,
      metadata: {
        originalUrl,
        linkId,
        referer: request.headers.get('referer'),
        acceptLanguage: request.headers.get('accept-language'),
        trackingType: 'click',
      },
    });

    // Redirect to the original URL
    return NextResponse.redirect(originalUrl, 302);
  } catch (error) {
    console.error('Click tracking error:', error);
    
    // Redirect to a default URL on error
    return NextResponse.redirect('https://example.com', 302);
  }
}