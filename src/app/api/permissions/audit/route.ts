/**
 * Permission Audit API Routes
 * Handles permission audit trail and reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { PermissionAuditService } from '@/lib/rbac/permission-audit';
import { EnhancedAuthorizationService } from '@/lib/rbac/enhanced-authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { PrismaClient } from '@/generated/prisma';
import { z } from 'zod';

const authService = new EnhancedAuthorizationService();
const prisma = new PrismaClient();
const auditService = new PermissionAuditService(prisma);

// Validation schemas
const auditQuerySchema = z.object({
    userId: z.string().optional(),
    eventTypes: z.array(z.string()).optional(),
    resource: z.nativeEnum(Resource).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.number().min(1).max(1000).optional(),
    offset: z.number().min(0).optional()
});

/**
 * GET /api/permissions/audit
 * Get permission audit logs
 */
export async function GET(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.AUDIT_LOGS,
        Action.READ
    );

    if (!result.allowed || !result.context) {
        return NextResponse.json(
            { error: 'Forbidden', message: result.reason },
            { status: 403 }
        );
    }

    try {
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        // Parse query parameters
        const query: any = {};
        if (queryParams.userId) query.userId = queryParams.userId;
        if (queryParams.eventTypes) query.eventTypes = queryParams.eventTypes.split(',');
        if (queryParams.resource) query.resource = queryParams.resource as Resource;
        if (queryParams.startDate) query.startDate = queryParams.startDate;
        if (queryParams.endDate) query.endDate = queryParams.endDate;
        if (queryParams.limit) query.limit = parseInt(queryParams.limit);
        if (queryParams.offset) query.offset = parseInt(queryParams.offset);

        const validatedQuery = auditQuerySchema.parse(query);

        // Convert date strings to Date objects
        const options: any = {
            ...validatedQuery,
            startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
            endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined
        };

        // Get audit history
        const auditHistory = await auditService.getPermissionHistory(
            validatedQuery.userId || result.context.user.id,
            result.context.user.tenantId,
            options
        );

        return NextResponse.json({
            events: auditHistory.events,
            total: auditHistory.total,
            pagination: {
                limit: options.limit || 50,
                offset: options.offset || 0,
                hasMore: auditHistory.total > (options.offset || 0) + auditHistory.events.length
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error getting audit logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/permissions/audit/stats
 * Get permission audit statistics
 */
export async function POST(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.AUDIT_LOGS,
        Action.READ
    );

    if (!result.allowed || !result.context) {
        return NextResponse.json(
            { error: 'Forbidden', message: result.reason },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const action = body.action;

        if (action === 'stats') {
            // Get audit statistics
            const startDate = body.startDate ? new Date(body.startDate) : undefined;
            const endDate = body.endDate ? new Date(body.endDate) : undefined;

            const stats = await auditService.getPermissionStats(
                result.context.user.tenantId,
                startDate,
                endDate
            );

            return NextResponse.json({ stats });

        } else if (action === 'cleanup') {
            // Clean up old audit logs (admin only)
            if (result.context.user.role !== 'ADMIN' && result.context.user.role !== 'SUPERADMIN') {
                return NextResponse.json(
                    { error: 'Admin privileges required' },
                    { status: 403 }
                );
            }

            const retentionDays = body.retentionDays || 365;
            const deletedCount = await auditService.cleanupOldAuditLogs(retentionDays);

            return NextResponse.json({
                success: true,
                message: `Cleaned up ${deletedCount} old audit log entries`,
                deletedCount
            });

        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('Error in audit stats/cleanup:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}