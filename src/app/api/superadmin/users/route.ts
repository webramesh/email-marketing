import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'
import { UserRole } from '@/types'

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const role = searchParams.get('role') as UserRole | undefined
    const search = searchParams.get('search') || undefined

    const result = await platformAnalyticsService.getSystemUsers(page, limit, role, search)
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('System users error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch system users' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)