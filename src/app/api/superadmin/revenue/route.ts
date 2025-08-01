import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'

async function handler(request: NextRequest) {
  try {
    const revenue = await platformAnalyticsService.getRevenueMetrics()
    
    return NextResponse.json({
      success: true,
      data: revenue
    })
  } catch (error) {
    console.error('Revenue metrics error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch revenue metrics' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)