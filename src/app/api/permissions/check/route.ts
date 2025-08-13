/**
 * Permission Check API Route
 * Provides permission checking endpoints for frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { PackagePermissionService } from '@/services/package-permission.service';
import { EnhancedAuthorizationService } from '@/lib/rbac/enhanced-authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { z } from 'zod';

const authService = new EnhancedAuthorizationService();
const permissionService = new PackagePermissionService();

// Validation schemas
const checkPermissionSchema = z.object({
    resource: z.nativeEnum(Resource),
    permissionAction: z.nativeEnum(Action),
    userId: z.string().optional()
});

const checkQuotaSchema = z.object({
    quotaType: z.string(),
    increment: z.number().optional(),
    userId: z.string().optional()
});

/**
 * POST /api/permissions/check
 * Check if user has permission to perform action
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const action = body.action;

        if (action === 'permission') {
            return await checkPermission(request, body);
        } else if (action === 'quota') {
            return await checkQuota(request, body);
        } else if (action === 'feature') {
            return await checkFeature(request, body);
        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('Error in permission check:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Check permission for resource and action
 */
async function checkPermission(request: NextRequest, body: any) {
    try {
        const validatedData = checkPermissionSchema.parse(body);

        const result = await authService.checkEnhancedPermission(
            request,
            validatedData.resource,
            validatedData.permissionAction
        );

        if (!result.context) {
            return NextResponse.json({
                allowed: false,
                reason: 'Authentication required'
            });
        }

        const userId = validatedData.userId || result.context.user.id;
        const tenantId = result.context.user.tenantId;

        // Get detailed permission check
        const permissionResult = await permissionService.canUserPerformAction(
            userId,
            tenantId,
            validatedData.resource,
            validatedData.permissionAction
        );

        return NextResponse.json({
            allowed: permissionResult.allowed,
            reason: permissionResult.reason,
            quotaStatus: permissionResult.quotaStatus,
            context: {
                hasRolePermission: result.context.hasRolePermission,
                hasPackagePermission: result.context.hasPackagePermission,
                restrictions: result.context.restrictions
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            );
        }
        throw error;
    }
}

/**
 * Check quota status
 */
async function checkQuota(request: NextRequest, body: any) {
    try {
        const validatedData = checkQuotaSchema.parse(body);

        // Get user context
        const result = await authService.checkEnhancedPermission(
            request,
            Resource.ANALYTICS, // Use a basic resource for authentication
            Action.READ
        );

        if (!result.context) {
            return NextResponse.json({
                allowed: false,
                reason: 'Authentication required'
            });
        }

        const userId = validatedData.userId || result.context.user.id;
        const tenantId = result.context.user.tenantId;

        // Check quota
        const quotaResult = await authService.checkQuotaBeforeAction(
            userId,
            tenantId,
            validatedData.quotaType,
            validatedData.increment || 1
        );

        return NextResponse.json({
            allowed: quotaResult.allowed,
            reason: quotaResult.reason,
            usage: quotaResult.usage
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            );
        }
        throw error;
    }
}

/**
 * Check feature availability
 */
async function checkFeature(request: NextRequest, body: any) {
    try {
        const { featureKey, userId } = body;

        if (!featureKey) {
            return NextResponse.json(
                { error: 'featureKey is required' },
                { status: 400 }
            );
        }

        // Get user context
        const result = await authService.checkEnhancedPermission(
            request,
            Resource.ANALYTICS, // Use a basic resource for authentication
            Action.READ
        );

        if (!result.context) {
            return NextResponse.json({
                available: false,
                reason: 'Authentication required'
            });
        }

        const targetUserId = userId || result.context.user.id;
        const tenantId = result.context.user.tenantId;

        // Get user permissions
        const permissions = await permissionService.getUserEffectivePermissions(
            targetUserId,
            tenantId
        );

        const available = permissions.features[featureKey] === true;

        return NextResponse.json({
            available,
            reason: available ? undefined : `Feature '${featureKey}' not available in current package`,
            features: permissions.features
        });

    } catch (error) {
        throw error;
    }
}

/**
 * GET /api/permissions/check
 * Get current user's permission context
 */
export async function GET(request: NextRequest) {
    try {
        // Get user context with minimal permission check
        const result = await authService.checkEnhancedPermission(
            request,
            Resource.ANALYTICS,
            Action.READ
        );

        if (!result.context) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Get detailed permissions
        const permissions = await permissionService.getUserEffectivePermissions(
            result.context.user.id,
            result.context.user.tenantId
        );

        return NextResponse.json({
            user: result.context.user,
            packages: permissions.packages,
            features: permissions.features,
            quotas: permissions.quotas,
            usage: permissions.usage,
            quotaStatus: result.context.quotaStatus,
            restrictions: permissions.restrictions
        });

    } catch (error) {
        console.error('Error getting permission context:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}