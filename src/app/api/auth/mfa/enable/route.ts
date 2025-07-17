import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { enableMFA } from '@/lib/mfa'
import { z } from 'zod'

// Validation schema for enable MFA request
const enableMFASchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  token: z.string().length(6, 'Token must be 6 digits')
})

/**
 * Enable MFA for the authenticated user
 * 
 * @route POST /api/auth/mfa/enable
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
    const validationResult = enableMFASchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }
    
    const { secret, token } = validationResult.data
    
    // Enable MFA for the user
    const success = await enableMFA(
      user.id,
      user.tenantId,
      secret,
      token
    )
    
    if (!success) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'MFA enabled successfully'
    })
  } catch (error) {
    console.error('Enable MFA error:', error)
    return NextResponse.json(
      { error: 'Failed to enable MFA' },
      { status: 500 }
    )
  }
}