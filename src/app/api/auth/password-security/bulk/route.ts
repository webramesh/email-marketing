import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { PasswordSecurityService } from '@/services/password-security.service';
import { prisma } from '@/lib/prisma';

const bulkPasswordActionSchema = z.object({
  action: z.enum(['force_reset', 'mark_compromised', 'unlock_accounts']),
  userIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

/**
 * POST /api/auth/password-security/bulk - Perform bulk password security actions (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = bulkPasswordActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, userIds, reason } = validation.data;

    let affectedUsers = 0;
    const results: string[] = [];

    switch (action) {
      case 'force_reset':
        if (userIds && userIds.length > 0) {
          // Force password reset for specific users
          const updateResult = await prisma.user.updateMany({
            where: {
              id: { in: userIds },
              tenantId: session.user.role === 'ADMIN' ? session.user.tenantId : undefined,
            },
            data: {
              mustChangePassword: true,
              updatedAt: new Date(),
            },
          });
          affectedUsers = updateResult.count;
          results.push(`Forced password reset for ${affectedUsers} users`);
        } else {
          // Force password reset for all users with expired passwords
          const expiredUsers = await prisma.user.updateMany({
            where: {
              passwordExpiresAt: { lt: new Date() },
              tenantId: session.user.role === 'ADMIN' ? session.user.tenantId : undefined,
              isActive: true,
            },
            data: {
              mustChangePassword: true,
              updatedAt: new Date(),
            },
          });
          affectedUsers = expiredUsers.count;
          results.push(`Forced password reset for ${affectedUsers} users with expired passwords`);
        }
        break;

      case 'mark_compromised':
        if (userIds && userIds.length > 0) {
          for (const userId of userIds) {
            await PasswordSecurityService.markPasswordAsCompromised(userId, reason);
            affectedUsers++;
          }
          results.push(`Marked ${affectedUsers} passwords as compromised`);
        }
        break;

      case 'unlock_accounts':
        if (userIds && userIds.length > 0) {
          const unlockResult = await prisma.user.updateMany({
            where: {
              id: { in: userIds },
              tenantId: session.user.role === 'ADMIN' ? session.user.tenantId : undefined,
            },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              updatedAt: new Date(),
            },
          });
          affectedUsers = unlockResult.count;
          results.push(`Unlocked ${affectedUsers} accounts`);
        } else {
          // Unlock all locked accounts
          const unlockResult = await prisma.user.updateMany({
            where: {
              lockedUntil: { gt: new Date() },
              tenantId: session.user.role === 'ADMIN' ? session.user.tenantId : undefined,
            },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              updatedAt: new Date(),
            },
          });
          affectedUsers = unlockResult.count;
          results.push(`Unlocked ${affectedUsers} locked accounts`);
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log the bulk action
    await prisma.securityEvent.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        eventType: 'UNAUTHORIZED_ACCESS', // Using closest available type
        severity: 'MEDIUM',
        description: `Bulk password security action: ${action}`,
        metadata: {
          action,
          affectedUsers,
          userIds: userIds || [],
          reason,
          results,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Bulk action completed successfully`,
      affectedUsers,
      results,
    });

  } catch (error) {
    console.error('Bulk password security action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}