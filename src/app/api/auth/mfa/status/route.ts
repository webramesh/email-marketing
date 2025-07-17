import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMFAStatus } from '@/lib/mfa'

/**
 * Get MFA status for the authenticated user
 * 
 * @route GET /api/auth/mfa/status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    
    // Get MFA status
    const status = await getMFAStatus(user.id, user.tenantId)
    
    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('MFA status error:', error)
    return NextResponse.json(
      { error: 'Failed to get MFA status' },
      { status: 500 }
    )
  }
}