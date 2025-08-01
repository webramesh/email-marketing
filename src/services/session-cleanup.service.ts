import { PrismaClient } from '@/generated/prisma';
import { cleanupExpiredSessions } from '@/lib/session-management';

const prisma = new PrismaClient();

/**
 * Session cleanup service for maintaining database hygiene
 */
export class SessionCleanupService {
  private static instance: SessionCleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly RETENTION_DAYS = 90; // Keep session data for 90 days

  private constructor() {}

  static getInstance(): SessionCleanupService {
    if (!SessionCleanupService.instance) {
      SessionCleanupService.instance = new SessionCleanupService();
    }
    return SessionCleanupService.instance;
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    console.log('Starting session cleanup service...');

    // Run cleanup immediately
    this.performCleanup();

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Session cleanup service stopped');
    }
  }

  /**
   * Perform comprehensive cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      console.log('Starting session cleanup...');

      // Clean up expired sessions and tokens
      await cleanupExpiredSessions();

      // Clean up old session activities
      await this.cleanupOldSessionActivities();

      // Clean up resolved security events
      await this.cleanupOldSecurityEvents();

      // Clean up orphaned remember tokens
      await this.cleanupOrphanedRememberTokens();

      // Update session statistics
      await this.updateSessionStatistics();

      console.log('Session cleanup completed successfully');
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  /**
   * Clean up old session activities
   */
  private async cleanupOldSessionActivities(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const result = await prisma.sessionActivity.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        // Keep high-risk activities longer
        riskScore: {
          lt: 50,
        },
      },
    });

    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} old session activities`);
    }
  }

  /**
   * Clean up old resolved security events
   */
  private async cleanupOldSecurityEvents(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS * 2); // Keep security events longer

    const result = await prisma.securityEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isResolved: true,
        severity: {
          in: ['LOW', 'MEDIUM'],
        },
      },
    });

    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} old resolved security events`);
    }
  }

  /**
   * Clean up orphaned remember tokens
   */
  private async cleanupOrphanedRememberTokens(): Promise<void> {
    try {
      // Find remember tokens where the user no longer exists
      // We'll use a raw query approach since Prisma doesn't handle this well
      const orphanedTokens = await prisma.$queryRaw<{ id: string }[]>`
        SELECT rt.id 
        FROM remember_tokens rt 
        LEFT JOIN users u ON rt.userId = u.id 
        WHERE u.id IS NULL
      `;

      if (orphanedTokens.length > 0) {
        await prisma.rememberToken.deleteMany({
          where: {
            id: {
              in: orphanedTokens.map(token => token.id),
            },
          },
        });

        console.log(`Cleaned up ${orphanedTokens.length} orphaned remember tokens`);
      }
    } catch (error) {
      console.error('Error cleaning up orphaned remember tokens:', error);

      // Fallback: clean up tokens older than retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS * 2);

      const result = await prisma.rememberToken.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isActive: false,
        },
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} old inactive remember tokens as fallback`);
      }
    }
  }

  /**
   * Update session statistics for monitoring
   */
  private async updateSessionStatistics(): Promise<void> {
    try {
      // Count active sessions
      const activeSessions = await prisma.userSession.count({
        where: {
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      // Count recent activities
      const recentActivities = await prisma.sessionActivity.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      // Count unresolved security events
      const unresolvedEvents = await prisma.securityEvent.count({
        where: {
          isResolved: false,
        },
      });

      // Count high-risk activities
      const highRiskActivities = await prisma.sessionActivity.count({
        where: {
          riskScore: {
            gte: 70,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      console.log('Session Statistics:', {
        activeSessions,
        recentActivities,
        unresolvedEvents,
        highRiskActivities,
      });

      // Log alerts for high numbers
      if (unresolvedEvents > 100) {
        console.warn(`High number of unresolved security events: ${unresolvedEvents}`);
      }

      if (highRiskActivities > 50) {
        console.warn(`High number of high-risk activities in last 24h: ${highRiskActivities}`);
      }
    } catch (error) {
      console.error('Error updating session statistics:', error);
    }
  }

  /**
   * Force cleanup of all sessions for a specific user
   */
  async cleanupUserSessions(userId: string): Promise<void> {
    try {
      // Deactivate all user sessions
      await prisma.userSession.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      // Deactivate all remember tokens
      await prisma.rememberToken.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      console.log(`Cleaned up all sessions for user: ${userId}`);
    } catch (error) {
      console.error(`Error cleaning up sessions for user ${userId}:`, error);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    totalActivities: number;
    totalSecurityEvents: number;
    unresolvedEvents: number;
  }> {
    try {
      const [
        totalSessions,
        activeSessions,
        expiredSessions,
        totalActivities,
        totalSecurityEvents,
        unresolvedEvents,
      ] = await Promise.all([
        prisma.userSession.count(),
        prisma.userSession.count({
          where: {
            isActive: true,
            expiresAt: { gt: new Date() },
          },
        }),
        prisma.userSession.count({
          where: {
            OR: [{ isActive: false }, { expiresAt: { lte: new Date() } }],
          },
        }),
        prisma.sessionActivity.count(),
        prisma.securityEvent.count(),
        prisma.securityEvent.count({
          where: { isResolved: false },
        }),
      ]);

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        totalActivities,
        totalSecurityEvents,
        unresolvedEvents,
      };
    } catch (error) {
      console.error('Error getting cleanup statistics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        totalActivities: 0,
        totalSecurityEvents: 0,
        unresolvedEvents: 0,
      };
    }
  }
}

// Export singleton instance
export const sessionCleanupService = SessionCleanupService.getInstance();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  sessionCleanupService.start();
}
