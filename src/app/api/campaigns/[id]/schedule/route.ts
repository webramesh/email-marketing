import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { CampaignService } from '@/services/campaign.service'
import { z } from 'zod'

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime('Invalid date format')
})

// cancelSchema removed as it's not used - validation is done inline

/**
 * POST /api/campaigns/[id]/schedule
 * Schedule a campaign for sending
 */
async function scheduleCampaign(
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
    const body = await request.json()
    
    // Check if this is a cancel request
    if (body.action === 'cancel') {
      const success = await CampaignService.cancelCampaign(tenantId, resolvedParams.id)
      
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Campaign not found or cannot be cancelled' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Campaign cancelled successfully'
      })
    }
    
    // Otherwise, schedule the campaign
    const validatedData = scheduleSchema.parse(body)
    const scheduledAt = new Date(validatedData.scheduledAt)
    
    // Validate that the scheduled time is in the future
    if (scheduledAt <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Scheduled time must be in the future' },
        { status: 400 }
      )
    }
    
    const success = await CampaignService.scheduleCampaign(tenantId, resolvedParams.id, scheduledAt)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or cannot be scheduled' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign scheduled successfully'
    })
  } catch (error) {
    console.error('Error scheduling campaign:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to schedule campaign' },
      { status: 500 }
    )
  }
}

export const POST = withPermission(scheduleCampaign, Resource.CAMPAIGNS, Action.UPDATE)