import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserManagementService } from '@/services/user-management.service'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { UserRole } from '@/generated/prisma'

const bulkUpdateSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
  data: z.object({
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    deactivationReason: z.string().optional(),
  })
})

/**
 * PUT /api/users/bulk
 * Bulk update users
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPERADMIN and ADMIN can perform bulk operations
    if (session.user.role === UserRole.USER) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions for bulk operations' },
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
    const validatedData = bulkUpdateSchema.parse(body)

    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const updatedCount = await userManagementService.bulkUpdateUsers(
      validatedData.userIds,
      validatedData.data
    )

    return NextResponse.json({
      success: true,
      data: { updatedCount },
      message: `Successfully updated ${updatedCount} users`
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

    console.error('Error performing bulk update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform bulk update' },
      { status: 500 }
    )
  }
}