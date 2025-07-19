import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { CampaignService } from '@/services/campaign.service'

/**
 * GET /api/campaigns/stats
 * Get campaign statistics for the current tenant
 */
async function getCampaignStats(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID')
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    const stats = await CampaignService.getCampaignStats(tenantId)

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching campaign stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaign statistics' },
      { status: 500 }
    )
  }
}

export const GET = withPermission(getCampaignStats, Resource.CAMPAIGNS, Action.READ)