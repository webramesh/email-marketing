/**
 * Package Permissions API Routes
 * Handles package-based permission management
 */

import { NextRequest, NextResponse } from 'next/server';
import { PackagePermissionService } from '@/services/package-permission.service';
import { EnhancedAuthorizationService } from '@/lib/rbac/enhanced-authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { z } from 'zod';

const authService = new EnhancedAuthorizationService();
const permissionService = new PackagePermissionService();

// Validation schemas
const assignPackageSchema = z.object({
    userId: z.string(),
    packageId: z.string(),
    reason: z.string().optional(),
    customFeatures: z.record(z.string(), z.any()).optional(),
    customQuotas: z.record(z.string(), z.number()).optional(),
    expiresAt: z.string().datetime().optional()
});

const updatePermissionsSchema = z.object({
    purchaseId: z.string(),
    userId: z.string(),
    features: z.record(z.string(), z.any()).optional(),
    quotas: z.record(z.string(), z.number()).optional(),
    reason: z.string().optional()
});

const bulkUpdateSchema = z.object({
    userIds: z.array(z.string()),
    packageId: z.string().optional(),
    templateId: z.string().optional(),
    features: z.record(z.string(), z.any()).optional(),
    quotas: z.record(z.string(), z.number()).optional(),
    reason: z.string().optional()
});

/**
 * GET /api/permissions/packages
 * Get permission templates and user package permissions
 */
export async function GET(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.SUBSCRIPTION_PLANS,
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
        const userId = url.searchParams.get('userId');
        const action = url.searchParams.get('action');

        if (action === 'templates') {
            // Get permission templates
            const templates = permissionService.getPermissionTemplates();
            return NextResponse.json({ templates });
        }

        if (userId) {
            // Get user's effective permissions
            const permissions = await permissionService.getUserEffectivePermissions(
                userId,
                result.context.user.tenantId
            );
            return NextResponse.json({ permissions });
        }

        // Get current user's permissions
        const permissions = await permissionService.getUserEffectivePermissions(
            result.context.user.id,
            result.context.user.tenantId
        );

        return NextResponse.json({ permissions });

    } catch (error) {
        console.error('Error getting package permissions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/permissions/packages
 * Assign package to user or perform bulk operations
 */
export async function POST(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.SUBSCRIPTION_PLANS,
        Action.MANAGE
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

        if (action === 'assign') {
            // Assign package to user
            const validatedData = assignPackageSchema.parse(body);

            await permissionService.assignPackageToUser({
                ...validatedData,
                tenantId: result.context.user.tenantId,
                assignedBy: result.context.user.id,
                expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined
            });

            return NextResponse.json({
                success: true,
                message: 'Package assigned successfully'
            });

        } else if (action === 'bulk_update') {
            // Bulk update permissions
            const validatedData = bulkUpdateSchema.parse(body);

            const result_bulk = await permissionService.bulkUpdatePermissions({
                ...validatedData,
                tenantId: result.context.user.tenantId,
                updatedBy: result.context.user.id
            });

            return NextResponse.json({
                success: true,
                message: 'Bulk update completed',
                results: result_bulk
            });

        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error in package permissions POST:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/permissions/packages
 * Update package permissions
 */
export async function PUT(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.SUBSCRIPTION_PLANS,
        Action.UPDATE
    );

    if (!result.allowed || !result.context) {
        return NextResponse.json(
            { error: 'Forbidden', message: result.reason },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const validatedData = updatePermissionsSchema.parse(body);

        await permissionService.updatePackagePermissions({
            ...validatedData,
            tenantId: result.context.user.tenantId,
            updatedBy: result.context.user.id
        });

        return NextResponse.json({
            success: true,
            message: 'Package permissions updated successfully'
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error updating package permissions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/permissions/packages
 * Remove package from user
 */
export async function DELETE(request: NextRequest) {
    const result = await authService.checkEnhancedPermission(
        request,
        Resource.SUBSCRIPTION_PLANS,
        Action.DELETE
    );

    if (!result.allowed || !result.context) {
        return NextResponse.json(
            { error: 'Forbidden', message: result.reason },
            { status: 403 }
        );
    }

    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const packageId = url.searchParams.get('packageId');
        const reason = url.searchParams.get('reason');

        if (!userId || !packageId) {
            return NextResponse.json(
                { error: 'userId and packageId are required' },
                { status: 400 }
            );
        }

        await permissionService.removePackageFromUser(
            userId,
            result.context.user.tenantId,
            packageId,
            result.context.user.id,
            reason || undefined
        );

        return NextResponse.json({
            success: true,
            message: 'Package removed successfully'
        });

    } catch (error) {
        console.error('Error removing package:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}