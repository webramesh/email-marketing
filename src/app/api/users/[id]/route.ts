import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserManagementService } from '@/services/user-management.service'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { UserRole } from '@/generated/prisma'

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  deactivationReason: z.string().optional(),
  packageId: z.string().optional(),
})

/**
 * GET /api/users/[id]
 * Get a specific user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    
    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const user = await userManagementService.getUserById(resolvedParams.id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found or insufficient permissions' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/[id]
 * Update a specific user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const user = await userManagementService.updateUser(resolvedParams.id, validatedData)

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    })
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

    console.error('Error updating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a specific user (SUPERADMIN only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPERADMIN can delete users
    if (session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: 'Only superadmins can delete users' },
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

    const resolvedParams = await params
    
    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    await userManagementService.deleteUser(resolvedParams.id)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    console.error('Error deleting user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}