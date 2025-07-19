import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'
import { z } from 'zod'

// Validation schemas
const duplicateListSchema = z.object({
  name: z.string().min(1, 'New list name is required').max(255, 'List name too long')
})

/**
 * POST /api/lists/[id]/duplicate
 * Duplicate a list with all its subscribers
 */
async function duplicateList(
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
    const validatedData = duplicateListSchema.parse(body)

    const listService = new ListService(tenantId)
    const duplicatedList = await listService.duplicateList(id, validatedData.name)

    return NextResponse.json({
      success: true,
      data: duplicatedList,
      message: 'List duplicated successfully'
    }, { status: 201 })
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
      if (error.message === 'List with this name already exists') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        )
      }
    }

    console.error('Error duplicating list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to duplicate list' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const POST = withPermission(duplicateList, Resource.LISTS, Action.CREATE)