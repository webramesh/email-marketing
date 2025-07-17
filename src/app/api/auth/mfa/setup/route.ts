import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateTOTPSetup } from '@/lib/mfa'

/**
 * Generate TOTP setup data for MFA
 * 
 * @route POST /api/auth/mfa/setup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    
    // Check if email exists
    if (!user.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }
    
    // Generate TOTP setup data
    const setupData = await generateTOTPSetup(
      user.id,
      user.email,
      user.tenant.name
    )
    
    return NextResponse.json({
      success: true,
      data: setupData
    })
  } catch (error) {
    console.error('MFA setup error:', error)
    return NextResponse.json(
      { error: 'Failed to generate MFA setup data' },
      { status: 500 }
    )
  }
}