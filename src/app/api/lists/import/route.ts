import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'
import { z } from 'zod'

// Validation schemas
const importListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(255, 'List name too long'),
  description: z.string().optional(),
  subscribers: z.array(z.object({
    email: z.string().email('Invalid email address'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    customFields: z.record(z.string(), z.any()).optional()
  })).min(1, 'At least one subscriber is required')
})

/**
 * POST /api/lists/import
 * Import a list with subscribers from data
 */
async function importList(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = importListSchema.parse(body)

    const listService = new ListService(tenantId)
    const importedList = await listService.importList(validatedData)

    return NextResponse.json({
      success: true,
      data: importedList,
      message: `List imported successfully with ${validatedData.subscribers.length} subscribers`
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'List with this name already exists') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    console.error('Error importing list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import list' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const POST = withPermission(importList, Resource.LISTS, Action.CREATE)