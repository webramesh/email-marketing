import { NextRequest, NextResponse } from 'next/server';
import { GdprComplianceService, ConsentType, DataProcessingPurpose } from '@/services/gdpr-compliance.service';
import { AuditMiddleware } from '@/lib/audit-middleware';

const gdprService = GdprComplianceService.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      email,
      consentType,
      purpose,
      legalBasis,
      consentMethod,
      consentText,
      version,
      expiryDate,
      metadata,
    } = body;

    // Validate required fields
    if (!email || !consentType || !purpose || !legalBasis || !consentText || !version) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Record consent
    const consentRecord = await gdprService.recordConsent({
      tenantId: context.tenantId,
      email,
      consentType: consentType as ConsentType,
      purpose: purpose as DataProcessingPurpose[],
      legalBasis,
      consentMethod: consentMethod || 'api',
      consentText,
      version,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: consentRecord,
    });
  } catch (error) {
    console.error('Failed to record consent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const consentType = searchParams.get('consentType');
    const withdrawalMethod = searchParams.get('withdrawalMethod') || 'api';

    if (!email || !consentType) {
      return NextResponse.json(
        { error: 'Email and consent type are required' },
        { status: 400 }
      );
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Withdraw consent
    await gdprService.withdrawConsent({
      tenantId: context.tenantId,
      email,
      consentType: consentType as ConsentType,
      withdrawalMethod,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Consent withdrawn successfully',
    });
  } catch (error) {
    console.error('Failed to withdraw consent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Extract audit context
    const context = await AuditMiddleware.extractAuditContext(request);

    // Get consent status
    const consentRecords = await gdprService.getConsentStatus(context.tenantId, email);

    return NextResponse.json({
      success: true,
      data: consentRecords,
    });
  } catch (error) {
    console.error('Failed to get consent status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}