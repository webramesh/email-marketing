import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { SegmentService } from '@/services/segment.service'

/**
 * POST /api/segments/[id]/refresh
 * Refresh subscriber count for a specific segment
 */
async function refreshSegmentCount(
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
    const segment = await segmentService.refreshSegmentCount(id)

    return NextResponse.json({
      success: true,
      data: segment,
      message: 'Segment count refreshed successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Segment not found') {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    console.error('Error refreshing segment count:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh segment count' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const POST = withPermission(refreshSegmentCount, Resource.SUBSCRIBERS, Action.UPDATE)