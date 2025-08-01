import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'

async function handler(request: NextRequest) {
  try {
    const health = await platformAnalyticsService.getPlatformHealth()
    
    return NextResponse.json({
      success: true,
      data: health
    })
  } catch (error) {
    console.error('Platform health error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch platform health metrics' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)