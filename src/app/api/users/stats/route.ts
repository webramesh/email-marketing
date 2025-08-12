import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserManagementService } from '@/services/user-management.service'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { UserRole } from '@/generated/prisma'

/**
 * GET /api/users/stats
 * Get user statistics based on role permissions
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

    const userManagementService = new UserManagementService(
      tenantId,
      session.user.role as UserRole
    )

    const stats = await userManagementService.getUserStats()

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user statistics' },
      { status: 500 }
    )
  }
}