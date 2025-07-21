import { NextRequest, NextResponse } from 'next/server';
import { EmailTrackingService } from '@/lib/tracking';
import { EmailEventType } from '@/generated/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await params;
    const token = rawToken.replace('.png', ''); // Remove .png extension
    const trackingData = EmailTrackingService.decryptTrackingData(token);

    if (!trackingData) {
      return new NextResponse('Invalid tracking token', { status: 400 });
    }

    const { campaignId, subscriberId, tenantId } = trackingData;

    // Get client information
    const ipAddress = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 
      request.headers.get('cf-connecting-ip') ||
      'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Record the open event
    await EmailTrackingService.recordEmailEvent(EmailEventType.OPENED, {
      campaignId,
      subscriberId,
      email: '', // Will be fetched automatically by the service
      tenantId,
      ipAddress,
      userAgent,
      metadata: {
        referer: request.headers.get('referer'),
        acceptLanguage: request.headers.get('accept-language'),
        trackingType: 'pixel',
      },
    });

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Tracking pixel error:', error);
    
    // Still return a pixel even on error to avoid broken images
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}