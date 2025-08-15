import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for cleanup request
const cleanupRequestSchema = z.object({
    retentionDays: z.number().min(30).max(3650).optional().default(2555), // Default 7 years
    dryRun: z.boolean().optional().default(false), // Preview mode
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only superadmins can perform cleanup operations
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Only superadmins can perform cleanup operations' },
                { status: 403 }
            );
        }

        const context = await AuditMiddleware.extractAuditContext(request);
        const body = await request.json();

        // Validate request body
        const validatedData = cleanupRequestSchema.parse(body);

        if (validatedData.dryRun) {
            // Dry run - preview what would be cleaned up
            const cutoffDate = new Date(Date.now() - validatedData.retentionDays * 24 * 60 * 60 * 1000);

            // Count records that would be affected
            const oldLogsCount = await prisma.auditLog.count({
                where: {
                    tenantId: context.tenantId,
                    createdAt: { lt: cutoffDate },
                },
            });

            // Separate critical vs regular logs
            const criticalActions = [
                'GDPR_DATA_DELETION',
                'GDPR_DATA_EXPORT',
                'USER_DELETED',
                'PAYMENT_PROCESSED',
                'SECURITY_VIOLATION',
            ];

            const criticalLogsCount = await prisma.auditLog.count({
                where: {
                    tenantId: context.tenantId,
                    createdAt: { lt: cutoffDate },
                    action: { in: criticalActions },
                },
            });

            const regularLogsCount = oldLogsCount - criticalLogsCount;

            return NextResponse.json({
                success: true,
                dryRun: true,
                data: {
                    cutoffDate,
                    retentionDays: validatedData.retentionDays,
                    totalOldLogs: oldLogsCount,
                    criticalLogsToAnonymize: criticalLogsCount,
                    regularLogsToDelete: regularLogsCount,
                    estimatedSpaceSaved: `${Math.round(oldLogsCount * 0.001)} MB`, // Rough estimate
                },
                message: 'Cleanup preview completed successfully',
            });
        } else {
            // Perform actual cleanup
            const cleanupResult = await complianceService.cleanupOldAuditLogs(
                context.tenantId,
                validatedData.retentionDays
            );

            return NextResponse.json({
                success: true,
                data: {
                    retentionDays: validatedData.retentionDays,
                    deletedCount: cleanupResult.deletedCount,
                    anonymizedCount: cleanupResult.anonymizedCount,
                    totalProcessed: cleanupResult.deletedCount + cleanupResult.anonymizedCount,
                },
                message: 'Audit log cleanup completed successfully',
            });
        }
    } catch (error) {
        console.error('Failed to perform cleanup:', error);

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

        // Only admins and superadmins can view cleanup status
        if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Insufficient permissions' },
                { status: 403 }
            );
        }

        const context = await AuditMiddleware.extractAuditContext(request);

        // Get audit log statistics
        const totalLogs = await prisma.auditLog.count({
            where: { tenantId: context.tenantId },
        });

        const logsLast30Days = await prisma.auditLog.count({
            where: {
                tenantId: context.tenantId,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
        });

        const logsLast90Days = await prisma.auditLog.count({
            where: {
                tenantId: context.tenantId,
                createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
        });

        const logsLast365Days = await prisma.auditLog.count({
            where: {
                tenantId: context.tenantId,
                createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
            },
        });

        const oldestLog = await prisma.auditLog.findFirst({
            where: { tenantId: context.tenantId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        });

        const newestLog = await prisma.auditLog.findFirst({
            where: { tenantId: context.tenantId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        return NextResponse.json({
            success: true,
            data: {
                statistics: {
                    totalLogs,
                    logsLast30Days,
                    logsLast90Days,
                    logsLast365Days,
                    oldestLogDate: oldestLog?.createdAt,
                    newestLogDate: newestLog?.createdAt,
                    estimatedSize: `${Math.round(totalLogs * 0.001)} MB`,
                },
                retentionRecommendations: {
                    lowRisk: {
                        retentionDays: 1095, // 3 years
                        description: 'Suitable for most compliance requirements',
                    },
                    mediumRisk: {
                        retentionDays: 2555, // 7 years
                        description: 'Recommended for financial and healthcare sectors',
                    },
                    highRisk: {
                        retentionDays: 3650, // 10 years
                        description: 'Maximum retention for highly regulated industries',
                    },
                },
            },
        });
    } catch (error) {
        console.error('Failed to get cleanup status:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}