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

const updateSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  conditions: segmentConditionsSchema.optional(),
})

const subscribersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

/**
 * GET /api/segments/[id]
 * Get a specific segment by ID with optional analytics
 */
async function getSegment(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeAnalytics = searchParams.get('analytics') === 'true'
    const includeSubscribers = searchParams.get('subscribers') === 'true'

    const segmentService = new SegmentService(tenantId)
    
    if (includeAnalytics) {
      const analytics = await segmentService.getSegmentAnalytics(id)
      return NextResponse.json({
        success: true,
        data: analytics
      })
    }

    if (includeSubscribers) {
      const query = subscribersQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      })
      
      const subscribers = await segmentService.getSegmentSubscribers(id, {
        page: query.page,
        limit: query.limit
      })
      
      return NextResponse.json({
        success: true,
        data: subscribers
      })
    }

    const segment = await segmentService.getSegmentById(id)
    if (!segment) {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: segment
    })
  } catch (error) {
    console.error('Error fetching segment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch segment' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/segments/[id]
 * Update a specific segment
 */
async function updateSegment(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateSegmentSchema.parse(body)

    const segmentService = new SegmentService(tenantId)
    const segment = await segmentService.updateSegment(id, validatedData)

    return NextResponse.json({
      success: true,
      data: segment,
      message: 'Segment updated successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'Segment not found') {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    console.error('Error updating segment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update segment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/segments/[id]
 * Delete a specific segment
 */
async function deleteSegment(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const segmentService = new SegmentService(tenantId)
    await segmentService.deleteSegment(id)

    return NextResponse.json({
      success: true,
      message: 'Segment deleted successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Segment not found') {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting segment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete segment' },
      { status: 500 }
    )
  }
}



// Apply RBAC middleware to route handlers
export const GET = withPermission(getSegment, Resource.SUBSCRIBERS, Action.READ)
export const PUT = withPermission(updateSegment, Resource.SUBSCRIBERS, Action.UPDATE)
export const DELETE = withPermission(deleteSegment, Resource.SUBSCRIBERS, Action.DELETE)