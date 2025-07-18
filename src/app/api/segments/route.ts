import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { SegmentService } from '@/services/segment.service'
import { z } from 'zod'

// Validation schemas
const segmentConditionSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'in', 'not_in', 'is_empty', 'is_not_empty', 'between', 'not_between']),
  value: z.any().optional(),
  secondValue: z.any().optional(),
})

const segmentConditionsSchema: z.ZodType<any> = z.lazy(() => z.object({
  operator: z.enum(['AND', 'OR']).default('AND'),
  rules: z.array(segmentConditionSchema),
  groups: z.array(segmentConditionsSchema).optional(),
}))

const createSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  conditions: segmentConditionsSchema,
})

const updateSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  conditions: segmentConditionsSchema.optional(),
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
})

const previewSchema = z.object({
  conditions: segmentConditionsSchema,
})

/**
 * GET /api/segments
 * Get all segments for the current tenant with pagination
 */
async function getSegments(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
    })

    const segmentService = new SegmentService(tenantId)
    const result = await segmentService.getSegmentsPaginated({
      page: query.page,
      limit: query.limit,
      search: query.search,
    })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch segments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/segments
 * Create a new segment
 */
async function createSegment(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    
    // Handle preview request
    if (body.preview) {
      const previewData = previewSchema.parse(body)
      const segmentService = new SegmentService(tenantId)
      const result = await segmentService.previewSegmentCount(previewData.conditions)
      
      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // Handle segment creation
    const validatedData = createSegmentSchema.parse(body)
    const segmentService = new SegmentService(tenantId)
    const segment = await segmentService.createSegment(validatedData)

    return NextResponse.json({
      success: true,
      data: segment,
      message: 'Segment created successfully'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating segment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create segment' },
      { status: 500 }
    )
  }
}



// Apply RBAC middleware to route handlers
export const GET = withPermission(getSegments, Resource.SUBSCRIBERS, Action.READ)
export const POST = withPermission(createSegment, Resource.SUBSCRIBERS, Action.CREATE)