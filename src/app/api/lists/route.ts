import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'
import { z } from 'zod'

// Validation schemas
const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(255, 'List name too long'),
  description: z.string().optional(),
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * GET /api/lists
 * Get all lists for the current tenant with pagination and filtering
 */
async function getLists(request: NextRequest) {
  try {
    // For development, use demo tenant directly
    let tenantId = 'demo-tenant'
    
    // In production, get tenant from headers
    if (process.env.NODE_ENV !== 'development') {
      const { tenantId: headerTenantId } = getTenantFromHeaders(request.headers)
      
      if (!headerTenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant context not found' },
          { status: 400 }
        )
      }
      tenantId = headerTenantId
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    })

    const listService = new ListService(tenantId)
    const result = await listService.getLists({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      filters: {
        search: query.search
      }
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta
    })
  } catch (error) {
    console.error('Error fetching lists:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lists' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lists
 * Create a new list
 */
async function createList(request: NextRequest) {
  try {
    // For development, use demo tenant directly
    let tenantId = 'demo-tenant'
    
    // In production, get tenant from headers
    if (process.env.NODE_ENV !== 'development') {
      const { tenantId: headerTenantId } = getTenantFromHeaders(request.headers)
      
      if (!headerTenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant context not found' },
          { status: 400 }
        )
      }
      tenantId = headerTenantId
    }

    const body = await request.json()
    const validatedData = createListSchema.parse(body)

    const listService = new ListService(tenantId)
    const list = await listService.createList(validatedData)

    return NextResponse.json({
      success: true,
      data: list,
      message: 'List created successfully'
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

    console.error('Error creating list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create list' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers (disabled in development)
export const GET = process.env.NODE_ENV === 'development' ? getLists : withPermission(getLists, Resource.LISTS, Action.READ)
export const POST = process.env.NODE_ENV === 'development' ? createList : withPermission(createList, Resource.LISTS, Action.CREATE)