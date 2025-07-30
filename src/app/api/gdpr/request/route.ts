import { NextRequest, NextResponse } from 'next/server';
import { GdprComplianceService, GdprRequestType } from '@/services/gdpr-compliance.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { prisma } from '@/lib/prisma';

const gdprService = GdprComplianceService.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { requestType, email, firstName, lastName, requestDetails, metadata } = body;

    // Validate required fields
    if (!requestType || !email) {
      return NextResponse.json({ error: 'Request type and email are required' }, { status: 400 });
    }

    // Validate request type
    if (!Object.values(GdprRequestType).includes(requestType)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Create GDPR request
    const gdprRequest = await gdprService.createGdprRequest({
      tenantId: context.tenantId,
      requestType: requestType as GdprRequestType,
      email,
      firstName,
      lastName,
      requestDetails,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: {
        requestId: gdprRequest.id,
        status: gdprRequest.status,
        message: 'GDPR request created. Please check your email for verification instructions.',
      },
    });
  } catch (error) {
    console.error('Failed to create GDPR request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const email = searchParams.get('email');

    if (!requestId && !email) {
      return NextResponse.json({ error: 'Request ID or email is required' }, { status: 400 });
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Get GDPR requests
    const whereClause: any = { tenantId: context.tenantId };

    if (requestId) {
      whereClause.id = requestId;
    }

    if (email) {
      whereClause.email = email;
    }

    const requests = await prisma.gdprRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        requestType: true,
        status: true,
        email: true,
        requestDate: true,
        completionDate: true,
        isVerified: true,
        rejectionReason: true,
      },
      orderBy: { requestDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Failed to get GDPR requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
