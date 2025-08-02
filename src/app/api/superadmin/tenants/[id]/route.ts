import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'
import { prisma } from '@/lib/prisma'

async function handlePatch(request: NextRequest, context: { params: { id: string } }) {
  const { params } = context;
  try {
    const { action } = await request.json()
    
    if (!['suspend', 'activate'].includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid action. Must be "suspend" or "activate"' 
        },
        { status: 400 }
      )
    }

    await platformAnalyticsService.updateTenantStatus(params.id, action)
    
    return NextResponse.json({
      success: true,
      message: `Tenant ${action}d successfully`
    })
  } catch (error) {
    console.error('Update tenant status error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update tenant status' 
      },
      { status: 500 }
    )
  }
}

async function handleDelete(request: NextRequest, context: { params: { id: string } }) {
  const { params } = context;
  try {
    // Delete tenant and all associated data
    await prisma.tenant.delete({
      where: {
        id: params.id
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully'
    })
  } catch (error) {
    console.error('Delete tenant error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete tenant' 
      },
      { status: 500 }
    )
  }
}

export const PATCH = withSuperAdmin(handlePatch as any)
export const DELETE = withSuperAdmin(handleDelete as any)