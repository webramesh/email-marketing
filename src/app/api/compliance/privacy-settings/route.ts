import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/services/compliance-audit.service';
import { AuditMiddleware } from '@/lib/audit-middleware';
import { z } from 'zod';

const complianceService = ComplianceAuditService.getInstance();

// Schema for privacy settings update
const privacySettingsSchema = z.object({
    userId: z.string().optional(), // Optional for admins updating other users
    dataProcessingConsent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
    analyticsConsent: z.boolean().optional(),
    thirdPartySharing: z.boolean().optional(),
    dataRetentionPreference: z.number().min(30).max(3650).optional(), // 30 days to 10 years
    communicationPreferences: z.object({
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        push: z.boolean().optional(),
    }).optional(),
});

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const context = await AuditMiddleware.extractAuditContext(request);
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        // Determine target user ID
        let targetUserId = userId || session.user.id;

        // Check permissions - users can only view their own settings unless they're admin
        if (targetUserId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: You can only view your own privacy settings' },
                { status: 403 }
            );
        }

        // Get privacy settings
        const privacySettings = await complianceService.getPrivacySettings(
            context.tenantId,
            targetUserId
        );

        // Log privacy settings access
        await complianceService.logUserAction({
            tenantId: context.tenantId,
            userId: session.user.id,
            action: 'PRIVACY_SETTINGS_ACCESSED',
            resource: 'privacy_settings',
            resourceId: targetUserId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            sessionId: context.sessionId,
            metadata: {
                targetUserId,
                accessedBy: session.user.id,
            },
        });

        return NextResponse.json({
            success: true,
            data: privacySettings,
        });
    } catch (error) {
        console.error('Failed to get privacy settings:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const context = await AuditMiddleware.extractAuditContext(request);
        const body = await request.json();

        // Validate request body
        const validatedData = privacySettingsSchema.parse(body);

        // Determine target user ID
        let targetUserId = validatedData.userId || session.user.id;

        // Check permissions - users can only update their own settings unless they're admin
        if (targetUserId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: You can only update your own privacy settings' },
                { status: 403 }
            );
        }

        // Remove userId from settings data
        const { userId, ...settingsData } = validatedData;

        // Update privacy settings
        const updatedSettings = await complianceService.updatePrivacySettings(
            context.tenantId,
            targetUserId,
            settingsData,
            session.user.id
        );

        return NextResponse.json({
            success: true,
            data: updatedSettings,
            message: 'Privacy settings updated successfully',
        });
    } catch (error) {
        console.error('Failed to update privacy settings:', error);

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