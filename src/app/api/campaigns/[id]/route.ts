import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { withMFA } from '@/lib/mfa-middleware'
import { CampaignService } from '@/services/campaign.service'
import { UpdateCampaignRequest, CampaignStatus, CampaignType } from '@/types'
import { z } from 'zod'

// Validation schema for updates
const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(255).optional(),
  preheader: z.string().max(255).optional(),
  content: z.string().optional(),
  status: z.enum([CampaignStatus.DRAFT, CampaignStatus.SCHEDULED, CampaignStatus.SENDING, CampaignStatus.SENT, CampaignStatus.PAUSED, CampaignStatus.CANCELLED]).optional(),
  campaignType: z.enum([CampaignType.REGULAR, CampaignType.AB_TEST, CampaignType.AUTOMATION, CampaignType.TRANSACTIONAL]).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email('Invalid email address').optional(),
  replyToEmail: z.string().email('Invalid email address').optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  targetLists: z.array(z.string()).optional(),
  targetSegments: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  templateData: z.any().optional(),
  customCss: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().datetime('Invalid date format').optional()
})

/**
 * GET /api/campaigns/[id]
 * Get a single campaign by ID
 */
async function getCampaign(
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
    const campaign = await CampaignService.getCampaignById(tenantId, resolvedParams.id)
    
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: campaign
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/campaigns/[id]
 * Update a campaign
 */
async function updateCampaign(
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
    
    // Validate request body
    const validatedData = updateCampaignSchema.parse(body)
    
    // Convert scheduledAt string to Date if provided
    const updateData: UpdateCampaignRequest = {
      ...validatedData,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined
    }
    
    const campaign = await CampaignService.updateCampaign(tenantId, resolvedParams.id, updateData)
    
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully'
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete a campaign
 */
async function deleteCampaign(
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
    const success = await CampaignService.deleteCampaign(tenantId, resolvedParams.id)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(getCampaign, Resource.CAMPAIGNS, Action.READ)
export const PUT = withPermission(updateCampaign, Resource.CAMPAIGNS, Action.UPDATE)
// Apply both RBAC and MFA middleware for sensitive delete operations
export const DELETE = withMFA(withPermission(deleteCampaign, Resource.CAMPAIGNS, Action.DELETE))