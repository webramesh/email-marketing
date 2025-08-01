import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') as 'active' | 'suspended' | 'inactive' | undefined

    const result = await platformAnalyticsService.getTenantsOverview(page, limit, search, status)
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Tenants overview error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch tenants overview' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)