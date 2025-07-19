import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { ABTestingService, ABTestConfig } from '@/services/ab-testing.service'
import { z } from 'zod'

// Validation schema for A/B test creation
const createABTestSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  variants: z.array(z.object({
    name: z.string().min(1, 'Variant name is required'),
    subject: z.string().min(1, 'Subject is required'),
    preheader: z.string().optional(),
    content: z.string().min(1, 'Content is required'),
    templateData: z.any().optional(),
    percentage: z.number().min(1).max(100)
  })).min(2, 'At least 2 variants are required'),
  testDuration: z.number().min(1).optional(),
  winnerCriteria: z.enum(['open_rate', 'click_rate', 'conversion_rate']),
  confidenceLevel: z.number().min(0.8).max(0.99).default(0.95),
  minimumSampleSize: z.number().min(50).optional()
})

/**
 * POST /api/campaigns/[id]/ab-test
 * Create A/B test variants for a campaign
 */
async function createABTest(
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
    const validatedData = createABTestSchema.parse(body)

    const variants = await ABTestingService.createABTestVariants(
      tenantId,
      resolvedParams.id,
      validatedData as ABTestConfig
    )

    return NextResponse.json({
      success: true,
      data: variants,
      message: 'A/B test created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating A/B test:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create A/B test' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/campaigns/[id]/ab-test
 * Get A/B test results for a campaign
 */
async function getABTestResults(
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
    const results = await ABTestingService.calculateABTestResults(tenantId, resolvedParams.id)

    return NextResponse.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error getting A/B test results:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get A/B test results' },
      { status: 500 }
    )
  }
}

export const POST = withPermission(createABTest, Resource.CAMPAIGNS, Action.CREATE)
export const GET = withPermission(getABTestResults, Resource.CAMPAIGNS, Action.READ)