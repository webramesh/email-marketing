import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'

/**
 * GET /api/lists/[id]/analytics
 * Get analytics for a specific list
 */
async function getListAnalytics(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const { id } = await params
    const listService = new ListService(tenantId)
    const analytics = await listService.getListAnalytics(id)

    return NextResponse.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'List not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    console.error('Error fetching list analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch list analytics' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(getListAnalytics, Resource.LISTS, Action.READ)