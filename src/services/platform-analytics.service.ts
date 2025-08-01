/**
 * Platform Analytics Service
 * Provides platform-wide analytics and monitoring for superadmins
 */

import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalCampaigns: number;
  totalEmailsSent: number;
  totalRevenue: number;
  monthlyGrowth: {
    tenants: number;
    users: number;
    revenue: number;
  };
}

export interface TenantOverview {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  userCount: number;
  campaignCount: number;
  subscriberCount: number;
  emailsSent: number;
  revenue: number;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  lastActivity?: Date;
  subscriptionPlan?: {
    name: string;
    price: number;
  } | null;
}

export interface PlatformHealthMetrics {
  systemHealth: {
    database: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      connections: number;
    };
    redis: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      memory: number;
    };
    queue: {
      status: 'healthy' | 'degraded' | 'down';
      activeJobs: number;
      failedJobs: number;
      completedJobs: number;
    };
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface RevenueMetrics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  revenueByPlan: Array<{
    planName: string;
    revenue: number;
    subscribers: number;
  }>;
  revenueGrowth: Array<{
    month: string;
    revenue: number;
    growth: number;
  }>;
}

export interface CommissionData {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  commissionsByTenant: Array<{
    tenantId: string;
    tenantName: string;
    totalRevenue: number;
    commissionRate: number;
    commissionAmount: number;
    status: 'pending' | 'paid';
  }>;
}

export class PlatformAnalyticsService {
  /**
   * Get overall platform metrics
   */
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalCampaigns,
      totalEmailsSent,
      totalRevenue,
      previousMonthMetrics,
    ] = await Promise.all([
      // Total tenants
      prisma.tenant.count(),

      // Active tenants (with activity in last 30 days)
      prisma.tenant.count({
        where: {
          users: {
            some: {
              updatedAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      }),

      // Total users
      prisma.user.count(),

      // Total campaigns
      prisma.campaign.count(),

      // Total emails sent (sum of totalSent from all campaigns)
      prisma.campaign.aggregate({
        _sum: {
          totalSent: true,
        },
      }),

      // Total revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      // Previous month metrics for growth calculation
      this.getPreviousMonthMetrics(),
    ]);

    const currentMetrics = {
      tenants: totalTenants,
      users: totalUsers,
      revenue: totalRevenue._sum.amount || 0,
    };

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      totalCampaigns,
      totalEmailsSent: totalEmailsSent._sum.totalSent || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyGrowth: {
        tenants: this.calculateGrowthRate(currentMetrics.tenants, previousMonthMetrics.tenants),
        users: this.calculateGrowthRate(currentMetrics.users, previousMonthMetrics.users),
        revenue: this.calculateGrowthRate(currentMetrics.revenue, previousMonthMetrics.revenue),
      },
    };
  }

  /**
   * Get tenant overview with key metrics
   */
  async getTenantsOverview(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: 'active' | 'suspended' | 'inactive'
  ): Promise<{
    tenants: TenantOverview[];
    total: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          users: {
            select: { id: true },
          },
          campaigns: {
            select: {
              id: true,
              totalSent: true,
            },
          },
          subscribers: {
            select: { id: true },
          },
          payments: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              amount: true,
            },
          },
          subscriptionPlan: {
            select: {
              name: true,
              price: true,
            },
          },
          subscription: {
            select: {
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.tenant.count({ where: whereClause }),
    ]);

    const tenantsOverview: TenantOverview[] = tenants.map(tenant => {
      const totalRevenue = tenant.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const totalEmailsSent = tenant.campaigns.reduce(
        (sum, campaign) => sum + campaign.totalSent,
        0
      );

      let tenantStatus: 'active' | 'suspended' | 'inactive' = 'active';
      if (tenant.subscription?.status === 'CANCELLED') {
        tenantStatus = 'suspended';
      } else if (tenant.users.length === 0) {
        tenantStatus = 'inactive';
      }

      return {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        customDomain: tenant.customDomain,
        userCount: tenant.users.length,
        campaignCount: tenant.campaigns.length,
        subscriberCount: tenant.subscribers.length,
        emailsSent: totalEmailsSent,
        revenue: totalRevenue,
        status: tenantStatus,
        createdAt: tenant.createdAt,
        subscriptionPlan: tenant.subscriptionPlan,
      };
    });

    // Filter by status if provided
    const filteredTenants = status
      ? tenantsOverview.filter(t => t.status === status)
      : tenantsOverview;

    return {
      tenants: filteredTenants,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get platform health metrics
   */
  async getPlatformHealth(): Promise<PlatformHealthMetrics> {
    const startTime = Date.now();

    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - startTime;

      // Get database connection info (simplified)
      const dbConnections = 10; // This would come from actual connection pool metrics

      // Get queue metrics (simplified - would integrate with actual Bull queue)
      const queueMetrics = {
        activeJobs: 0,
        failedJobs: 0,
        completedJobs: 0,
      };

      return {
        systemHealth: {
          database: {
            status: dbResponseTime < 100 ? 'healthy' : dbResponseTime < 500 ? 'degraded' : 'down',
            responseTime: dbResponseTime,
            connections: dbConnections,
          },
          redis: {
            status: 'healthy', // Would check actual Redis connection
            responseTime: 5,
            memory: 50, // MB
          },
          queue: {
            status: 'healthy',
            activeJobs: queueMetrics.activeJobs,
            failedJobs: queueMetrics.failedJobs,
            completedJobs: queueMetrics.completedJobs,
          },
        },
        performance: {
          avgResponseTime: 150, // Would come from actual metrics
          errorRate: 0.1, // 0.1%
          throughput: 1000, // requests per minute
        },
      };
    } catch (error) {
      return {
        systemHealth: {
          database: {
            status: 'down',
            responseTime: Date.now() - startTime,
            connections: 0,
          },
          redis: {
            status: 'down',
            responseTime: 0,
            memory: 0,
          },
          queue: {
            status: 'down',
            activeJobs: 0,
            failedJobs: 0,
            completedJobs: 0,
          },
        },
        performance: {
          avgResponseTime: 0,
          errorRate: 100,
          throughput: 0,
        },
      };
    }
  }

  /**
   * Get revenue metrics and analytics
   */
  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const [totalRevenue, subscriptions, revenueByPlan, monthlyRevenue] = await Promise.all([
      // Total revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      // Active subscriptions for MRR calculation
      prisma.tenantSubscription.findMany({
        where: {
          status: 'ACTIVE',
        },
        include: {
          plan: {
            select: {
              price: true,
              billingCycle: true,
            },
          },
        },
      }),

      // Revenue by plan
      prisma.subscriptionPlan.findMany({
        include: {
          subscriptions: {
            where: {
              status: 'ACTIVE',
            },
            include: {
              tenant: {
                include: {
                  payments: {
                    where: {
                      status: 'COMPLETED',
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Monthly revenue for growth calculation
      this.getMonthlyRevenueData(),
    ]);

    // Calculate MRR
    const monthlyRecurringRevenue = subscriptions.reduce((mrr, sub) => {
      const planPrice = sub.plan.price;
      if (sub.plan.billingCycle === 'monthly') {
        return mrr + planPrice;
      } else if (sub.plan.billingCycle === 'yearly') {
        return mrr + planPrice / 12;
      }
      return mrr;
    }, 0);

    // Calculate ARPU
    const totalActiveUsers = await prisma.user.count();
    const averageRevenuePerUser =
      totalActiveUsers > 0 ? (totalRevenue._sum.amount || 0) / totalActiveUsers : 0;

    // Calculate churn rate (simplified)
    const churnRate = 2.5; // Would calculate based on actual subscription cancellations

    // Revenue by plan
    const revenueByPlanData = revenueByPlan.map(plan => ({
      planName: plan.name,
      revenue: plan.subscriptions.reduce(
        (sum, sub) =>
          sum + sub.tenant.payments.reduce((paySum, payment) => paySum + payment.amount, 0),
        0
      ),
      subscribers: plan.subscriptions.length,
    }));

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRecurringRevenue,
      averageRevenuePerUser,
      churnRate,
      revenueByPlan: revenueByPlanData,
      revenueGrowth: monthlyRevenue,
    };
  }

  /**
   * Get commission data for admin companies
   */
  async getCommissionData(): Promise<CommissionData> {
    // This would be implemented based on the commission structure
    // For now, returning mock data structure
    const tenants = await prisma.tenant.findMany({
      include: {
        payments: {
          where: {
            status: 'COMPLETED',
          },
        },
      },
    });

    const commissionRate = 0.1; // 10% commission rate
    let totalCommissions = 0;
    let pendingCommissions = 0;
    let paidCommissions = 0;

    const commissionsByTenant = tenants.map(tenant => {
      const totalRevenue = tenant.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const commissionAmount = totalRevenue * commissionRate;

      totalCommissions += commissionAmount;
      pendingCommissions += commissionAmount; // Simplified - all pending for now

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        totalRevenue,
        commissionRate,
        commissionAmount,
        status: 'pending' as const,
      };
    });

    return {
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      commissionsByTenant,
    };
  }

  /**
   * Suspend or activate a tenant
   */
  async updateTenantStatus(tenantId: string, action: 'suspend' | 'activate'): Promise<void> {
    const status = action === 'suspend' ? 'CANCELLED' : 'ACTIVE';

    await prisma.tenantSubscription.updateMany({
      where: {
        tenantId,
      },
      data: {
        status,
      },
    });
  }

  /**
   * Get system-wide user management data
   */
  async getSystemUsers(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
    search?: string
  ): Promise<{
    users: Array<{
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      tenantId: string;
      tenantName: string;
      mfaEnabled: boolean;
      createdAt: Date;
      lastLogin?: Date;
    }>;
    total: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role;
    }

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          tenant: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    const usersData = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      lastLogin: user.updatedAt, // Simplified - would track actual last login
    }));

    return {
      users: usersData,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Helper method to get previous month metrics
   */
  private async getPreviousMonthMetrics() {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(1);

    const thisMonth = new Date();
    thisMonth.setDate(1);

    const [tenants, users, revenue] = await Promise.all([
      prisma.tenant.count({
        where: {
          createdAt: {
            lt: thisMonth,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            lt: thisMonth,
          },
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            lt: thisMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      tenants,
      users,
      revenue: revenue._sum.amount || 0,
    };
  }

  /**
   * Helper method to calculate growth rate
   */
  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Helper method to get monthly revenue data
   */
  private async getMonthlyRevenueData() {
    // This would implement actual monthly revenue tracking
    // For now, returning mock data
    return [
      { month: '2024-01', revenue: 10000, growth: 0 },
      { month: '2024-02', revenue: 12000, growth: 20 },
      { month: '2024-03', revenue: 15000, growth: 25 },
      { month: '2024-04', revenue: 18000, growth: 20 },
      { month: '2024-05', revenue: 22000, growth: 22.2 },
      { month: '2024-06', revenue: 25000, growth: 13.6 },
    ];
  }
}

export const platformAnalyticsService = new PlatformAnalyticsService();
