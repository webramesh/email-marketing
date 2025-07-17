import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateEmailOTP, sendEmailOTP } from '@/lib/mfa'

/**
 * Send email OTP for MFA verification
 * 
 * @route POST /api/auth/mfa/send-otp
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
    
    // Generate email OTP
    const otp = await generateEmailOTP(user.email, user.tenantId)
    
    // Send email OTP
    const sent = await sendEmailOTP(user.email, otp)
    
    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send email OTP' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email OTP sent successfully'
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to send email OTP' },
      { status: 500 }
    )
  }
}