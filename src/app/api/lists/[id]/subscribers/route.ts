import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'
import { z } from 'zod'

// Validation schemas
const bulkSubscriberSchema = z.object({
  subscriberIds: z.array(z.string()).min(1, 'At least one subscriber ID is required'),
  operation: z.enum(['add', 'remove'])
})

/**
 * POST /api/lists/[id]/subscribers
 * Add or remove subscribers from a list (bulk operation)
 */
async function bulkSubscriberOperation(
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
    const body = await request.json()
    const validatedData = bulkSubscriberSchema.parse(body)

    const listService = new ListService(tenantId)
    
    if (validatedData.operation === 'add') {
      await listService.addSubscribersToList(id, validatedData.subscriberIds)
    } else {
      await listService.removeSubscribersFromList(id, validatedData.subscriberIds)
    }

    return NextResponse.json({
      success: true,
      message: `Subscribers ${validatedData.operation === 'add' ? 'added to' : 'removed from'} list successfully`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'List not found') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }
      if (error.message.includes('subscribers not found')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
    }

    console.error('Error performing bulk subscriber operation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const POST = withPermission(bulkSubscriberOperation, Resource.LISTS, Action.UPDATE)