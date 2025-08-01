import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/rbac/authorization'
import { platformAnalyticsService } from '@/services/platform-analytics.service'

async function handler(request: NextRequest) {
  try {
    const commissions = await platformAnalyticsService.getCommissionData()
    
    return NextResponse.json({
      success: true,
      data: commissions
    })
  } catch (error) {
    console.error('Commission data error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch commission data' 
      },
      { status: 500 }
    )
  }
}

export const GET = withSuperAdmin(handler)