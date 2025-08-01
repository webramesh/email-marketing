/**
 * Platform Analytics Service Tests
 */

import { platformAnalyticsService } from '../platform-analytics.service'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    campaign: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
    },
    tenantSubscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    subscriptionPlan: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}))

describe('PlatformAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPlatformMetrics', () => {
    it('should return platform metrics successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock the database responses
      prisma.tenant.count.mockResolvedValueOnce(10) // totalTenants
      prisma.tenant.count.mockResolvedValueOnce(8)  // activeTenants
      prisma.user.count.mockResolvedValueOnce(50)   // totalUsers
      prisma.campaign.count.mockResolvedValueOnce(25) // totalCampaigns
      prisma.campaign.aggregate.mockResolvedValueOnce({ _sum: { totalSent: 10000 } })
      prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 5000 } })
      
      // Mock previous month metrics
      prisma.tenant.count.mockResolvedValueOnce(8)  // previous month tenants
      prisma.user.count.mockResolvedValueOnce(40)   // previous month users
      prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 4000 } })

      const result = await platformAnalyticsService.getPlatformMetrics()

      expect(result).toEqual({
        totalTenants: 10,
        activeTenants: 8,
        totalUsers: 50,
        totalCampaigns: 25,
        totalEmailsSent: 10000,
        totalRevenue: 5000,
        monthlyGrowth: {
          tenants: 25, // (10-8)/8 * 100
          users: 25,   // (50-40)/40 * 100
          revenue: 25  // (5000-4000)/4000 * 100
        }
      })
    })
  })

  describe('updateTenantStatus', () => {
    it('should suspend a tenant successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.tenantSubscription.updateMany.mockResolvedValueOnce({ count: 1 })

      await platformAnalyticsService.updateTenantStatus('tenant-123', 'suspend')

      expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'CANCELLED' }
      })
    })

    it('should activate a tenant successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.tenantSubscription.updateMany.mockResolvedValueOnce({ count: 1 })

      await platformAnalyticsService.updateTenantStatus('tenant-123', 'activate')

      expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { status: 'ACTIVE' }
      })
    })
  })

  describe('getPlatformHealth', () => {
    it('should return healthy status when database is responsive', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.$queryRaw.mockResolvedValueOnce([{ '1': 1 }])

      const result = await platformAnalyticsService.getPlatformHealth()

      expect(result.systemHealth.database.status).toBe('healthy')
      expect(result.systemHealth.database.responseTime).toBeLessThan(100)
    })

    it('should return down status when database fails', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'))

      const result = await platformAnalyticsService.getPlatformHealth()

      expect(result.systemHealth.database.status).toBe('down')
    })
  })
})