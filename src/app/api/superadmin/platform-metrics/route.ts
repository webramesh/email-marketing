import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'

async function handler(request: NextRequest) {
  try {
    const metrics = await platformAnalyticsService.getPlatformMetrics()
    
    return NextResponse.json({
      success: true,
      data: metrics
    })
  } catch (error) {
    console.error('Platform metrics error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch platform metrics' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)