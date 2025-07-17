import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { disableMFA, verifyMFAToken } from '@/lib/mfa'
import { withMFA } from '@/lib/mfa-middleware'
import { z } from 'zod'

// Validation schema for disable MFA request
const disableMFASchema = z.object({
  token: z.string().min(6).max(8, 'Token must be 6-8 characters'),
  type: z.enum(['totp', 'email', 'backup'], 'Type must be either totp, email, or backup')
})

/**
 * Disable MFA for the authenticated user
 * This route is protected by MFA middleware
 * 
 * @route POST /api/auth/mfa/disable
 */
export const POST = withMFA(async (request: NextRequest) => {
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
    const validationResult = disableMFASchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }
    
    const { token, type } = validationResult.data
    
    // Verify the token first
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
    
    // Disable MFA for the user
    const success = await disableMFA(
      user.id,
      user.tenantId
    )
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to disable MFA' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'MFA disabled successfully'
    })
  } catch (error) {
    console.error('Disable MFA error:', error)
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    )
  }
})