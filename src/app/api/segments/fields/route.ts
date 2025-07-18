import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { SegmentService } from '@/services/segment.service'

/**
 * GET /api/segments/fields
 * Get available fields for segment building
 */
async function getSegmentFields(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const segmentService = new SegmentService(tenantId)
    const fields = await segmentService.getAvailableFields()

    return NextResponse.json({
      success: true,
      data: fields
    })
  } catch (error) {
    console.error('Error fetching segment fields:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch segment fields' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(getSegmentFields, Resource.SUBSCRIBERS, Action.READ)