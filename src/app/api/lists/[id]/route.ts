import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'
import { z } from 'zod'

// Validation schemas
const updateListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(255, 'List name too long').optional(),
  description: z.string().optional(),
})

/**
 * GET /api/lists/[id]
 * Get a specific list by ID
 */
async function getList(
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
    const list = await listService.getListById(id)

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'List not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: list
    })
  } catch (error) {
    console.error('Error fetching list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/lists/[id]
 * Update a specific list
 */
async function updateList(
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

    const body = await request.json()
    const validatedData = updateListSchema.parse(body)

    const { id } = await params
    const listService = new ListService(tenantId)
    const list = await listService.updateList(id, validatedData)

    return NextResponse.json({
      success: true,
      data: list,
      message: 'List updated successfully'
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
      if (error.message === 'List with this name already exists') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        )
      }
    }

    console.error('Error updating list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update list' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/lists/[id]
 * Delete a specific list
 */
async function deleteList(
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
    await listService.deleteList(id)

    return NextResponse.json({
      success: true,
      message: 'List deleted successfully'
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'List not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    console.error('Error deleting list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete list' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(getList, Resource.LISTS, Action.READ)
export const PUT = withPermission(updateList, Resource.LISTS, Action.UPDATE)
export const DELETE = withPermission(deleteList, Resource.LISTS, Action.DELETE)