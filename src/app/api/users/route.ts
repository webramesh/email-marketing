import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserManagementService } from '@/services/user-management.service'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { UserRole } from '@/generated/prisma'

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  isActive: z.boolean().optional().default(true),
  packageId: z.string().optional(),
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.coerce.boolean().optional(),
  packageId: z.string().optional(),
  hasPackage: z.coerce.boolean().optional(),
  sortBy: z.enum(['email', 'name', 'firstName', 'lastName', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * GET /api/users
 * Get all users based on role permissions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      role: searchParams.get('role') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      packageId: searchParams.get('packageId') || undefined,
      hasPackage: searchParams.get('hasPackage') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    })

    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const result = await userManagementService.getUsers({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      filters: {
        search: query.search,
        role: query.role,
        isActive: query.isActive,
        packageId: query.packageId,
        hasPackage: query.hasPackage,
      }
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPERADMIN and ADMIN can create users
    if (session.user.role === UserRole.USER) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to create users' },
        { status: 403 }
      )
    }

    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const user = await userManagementService.createUser(validatedData)

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    )
  }
}