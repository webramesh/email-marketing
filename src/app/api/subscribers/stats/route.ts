import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { SubscriberStatus } from '@/types'

/**
 * GET /api/subscribers/stats
 * Get subscriber statistics for the current tenant
 */
async function getSubscriberStats(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const tenantPrisma = createTenantPrisma(tenantId)
    
    const [total, active, unsubscribed, bounced, complained, invalid] = await Promise.all([
      tenantPrisma.prisma.subscriber.count(),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.ACTIVE } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.UNSUBSCRIBED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.BOUNCED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.COMPLAINED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.INVALID } }),
    ])

    const stats = {
      total,
      active,
      unsubscribed,
      bounced,
      complained,
      invalid,
    }

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching subscriber stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriber stats' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handler
export const GET = withPermission(getSubscriberStats, Resource.SUBSCRIBERS, Action.READ)