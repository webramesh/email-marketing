import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { CampaignService } from '@/services/campaign.service'
import { z } from 'zod'

const duplicateSchema = z.object({
  name: z.string().min(1).max(255).optional()
})

/**
 * POST /api/campaigns/[id]/duplicate
 * Duplicate a campaign
 */
async function duplicateCampaign(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID')
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    const resolvedParams = await params
    const body = await request.json().catch(() => ({}))
    const validatedData = duplicateSchema.parse(body)
    
    const duplicatedCampaign = await CampaignService.duplicateCampaign(
      tenantId, 
      resolvedParams.id, 
      validatedData.name
    )
    
    if (!duplicatedCampaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: duplicatedCampaign,
      message: 'Campaign duplicated successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating campaign:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to duplicate campaign' },
      { status: 500 }
    )
  }
}

export const POST = withPermission(duplicateCampaign, Resource.CAMPAIGNS, Action.CREATE)