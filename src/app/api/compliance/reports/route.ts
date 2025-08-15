import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService, ComplianceReportType } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for report generation request
const reportRequestSchema = z.object({
    reportType: z.enum([
        'AUDIT_TRAIL',
        'GDPR_COMPLIANCE',
        'DATA_PROCESSING',
        'CONSENT_MANAGEMENT',
        'SECURITY_EVENTS',
        'USER_ACTIVITY',
        'DATA_RETENTION',
    ]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    format: z.enum(['JSON', 'CSV', 'PDF']).optional().default('JSON'),
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins and superadmins can generate compliance reports
        if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Insufficient permissions' },
                { status: 403 }
            );
        }

        const context = await AuditMiddleware.extractAuditContext(request);
        const body = await request.json();

        // Validate request body
        const validatedData = reportRequestSchema.parse(body);

        // Validate date range
        const startDate = new Date(validatedData.startDate);
        const endDate = new Date(validatedData.endDate);

        if (startDate >= endDate) {
            return NextResponse.json(
                { error: 'Start date must be before end date' },
                { status: 400 }
            );
        }

        // Check if date range is not too large (max 1 year)
        const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
        if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
            return NextResponse.json(
                { error: 'Date range cannot exceed 1 year' },
                { status: 400 }
            );
        }

        // Generate compliance report
        const report = await complianceService.generateComplianceReport(
            context.tenantId,
            validatedData.reportType as ComplianceReportType,
            startDate,
            endDate,
            session.user.id,
            validatedData.format
        );

        return NextResponse.json({
            success: true,
            data: {
                reportId: report.id,
                reportType: report.reportType,
                startDate: report.startDate,
                endDate: report.endDate,
                generatedAt: report.generatedAt,
                format: report.format,
                downloadUrl: report.downloadUrl,
                expiresAt: report.expiresAt,
                summary: report.data.summary,
            },
            message: 'Compliance report generated successfully',
        });
    } catch (error) {
        console.error('Failed to generate compliance report:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins and superadmins can view compliance reports
        if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Insufficient permissions' },
                { status: 403 }
            );
        }

        const context = await AuditMiddleware.extractAuditContext(request);
        const { searchParams } = new URL(request.url);

        const reportId = searchParams.get('reportId');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (reportId) {
            // Get specific report details
            // In production, this would fetch from a reports table
            return NextResponse.json({
                success: true,
                data: {
                    reportId,
                    message: 'Report details would be fetched from storage',
                },
            });
        } else {
            // List recent reports
            // In production, this would fetch from a reports table
            return NextResponse.json({
                success: true,
                data: {
                    reports: [],
                    total: 0,
                    limit,
                    offset,
                    message: 'Report list would be fetched from storage',
                },
            });
        }
    } catch (error) {
        console.error('Failed to get compliance reports:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}