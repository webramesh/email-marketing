import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifyMFAToken } from '@/lib/mfa'
import { createMFASession } from '@/lib/mfa-middleware'
import { z } from 'zod'

// Validation schema for verify MFA request
const verifyMFASchema = z.object({
  token: z.string().min(6).max(8, 'Token must be 6-8 characters'),
  type: z.enum(['totp', 'email', 'backup'], 'Type must be either totp, email, or backup')
})

/**
 * Verify MFA token and create MFA session
 * 
 * @route POST /api/auth/mfa/verify
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
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = verifyMFASchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }
    
    const { token, type } = validationResult.data
    
    // Verify the token
    const isValid = await verifyMFAToken(
      user.id,
      user.tenantId,
      token,
      type
    )
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }
    
    // Create MFA session
    createMFASession(user.id, user.tenantId)
    
    return NextResponse.json({
      success: true,
      message: 'MFA verification successful'
    })
  } catch (error) {
    console.error('Verify MFA error:', error)
    return NextResponse.json(
      { error: 'Failed to verify MFA token' },
      { status: 500 }
    )
  }
}