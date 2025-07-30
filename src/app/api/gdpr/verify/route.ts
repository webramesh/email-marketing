import { NextRequest, NextResponse } from 'next/server';
import { GdprComplianceService } from '@/services/gdpr-compliance.service';
import { AuditMiddleware } from '@/lib/audit-middleware';

const gdprService = GdprComplianceService.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, verificationToken } = body;

    if (!requestId || !verificationToken) {
      return NextResponse.json(
        { error: 'Request ID and verification token are required' },
        { status: 400 }
      );
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Verify GDPR request
    const isVerified = await gdprService.verifyGdprRequest(
      context.tenantId,
      requestId,
      verificationToken
    );

    if (!isVerified) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'GDPR request verified and processing has begun',
    });
  } catch (error) {
    console.error('Failed to verify GDPR request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const requestId = searchParams.get('requestId');

    if (!token || !requestId) {
      return NextResponse.json(
        { error: 'Token and request ID are required' },
        { status: 400 }
      );
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // This would typically render a verification page
    // For API purposes, we'll just verify the token validity
    const isValid = await gdprService.verifyGdprRequest(
      context.tenantId,
      requestId,
      token
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'GDPR request verified successfully',
    });
  } catch (error) {
    console.error('Failed to verify GDPR request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}