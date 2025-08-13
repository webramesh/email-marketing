import { NextRequest, NextResponse } from 'next/server'
import { withEnhancedPermission } from '@/lib/rbac/authorization'
import { withAdvancedPermission } from '@/lib/rbac/package-middleware'
import { Resource, Action } from '@/lib/rbac/permissions'
import { CampaignService } from '@/services/campaign.service'
import { CreateCampaignRequest, CampaignStatus, CampaignType } from '@/types'
import { z } from 'zod'

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(255),
  preheader: z.string().max(255).optional(),
  content: z.string().optional(),
  campaignType: z.enum([CampaignType.REGULAR, CampaignType.AB_TEST, CampaignType.AUTOMATION, CampaignType.TRANSACTIONAL]).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email('Invalid email address').optional(),
  replyToEmail: z.string().email('Invalid email address').optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  targetLists: z.array(z.string()).optional(),
  targetSegments: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().datetime('Invalid date format').optional()
})

const querySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  status: z.enum([CampaignStatus.DRAFT, CampaignStatus.SCHEDULED, CampaignStatus.SENDING, CampaignStatus.SENT, CampaignStatus.PAUSED, CampaignStatus.CANCELLED]).optional(),
  type: z.enum([CampaignType.REGULAR, CampaignType.AB_TEST, CampaignType.AUTOMATION, CampaignType.TRANSACTIONAL]).optional(),
  search: z.string().optional(),
  tags: z.string().transform(val => val.split(',')).optional()
})

/**
 * GET /api/campaigns
 * Get all campaigns for the current tenant with pagination and filtering
 */
async function getCampaigns(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID')
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = querySchema.parse(queryParams)
    
    const result = await CampaignService.getCampaigns(tenantId, {
      page: validatedParams.page || 1,
      limit: Math.min(validatedParams.limit || 10, 100), // Max 100 per page
      status: validatedParams.status,
      type: validatedParams.type,
      search: validatedParams.search,
      tags: validatedParams.tags
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
async function createCampaign(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID')
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    
    // Validate request body
    const validatedData = createCampaignSchema.parse(body)
    
    // Convert scheduledAt string to Date if provided
    const campaignData: CreateCampaignRequest = {
      ...validatedData,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined
    }
    
    const campaign = await CampaignService.createCampaign(tenantId, campaignData)
    
    return NextResponse.json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}

// Apply enhanced RBAC middleware with package-based permissions
export const GET = withEnhancedPermission(getCampaigns, Resource.CAMPAIGNS, Action.READ)

// Apply advanced permission middleware with quota checking for campaign creation
export const POST = withAdvancedPermission(createCampaign, {
  resource: Resource.CAMPAIGNS,
  action: Action.CREATE,
  feature: 'email_builder', // Require email builder feature
  quota: {
    type: 'monthly_campaigns',
    increment: 1,
    updateAfter: true
  }
})