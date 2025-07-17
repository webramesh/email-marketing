import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { isMFAEnabled } from './mfa'

export interface MFASession {
  userId: string
  tenantId: string
  mfaVerified: boolean
  mfaVerifiedAt?: number
}

// In-memory store for MFA sessions (in production, use Redis)
const mfaSessions = new Map<string, MFASession>()

// MFA session timeout (30 minutes)
const MFA_SESSION_TIMEOUT = 30 * 60 * 1000

/**
 * Paths that require MFA verification for sensitive operations
 */
const SENSITIVE_PATHS = [
  '/api/auth/mfa/disable',
  '/api/users/delete',
  '/api/billing/cancel',
  '/api/settings/security',
  '/api/admin',
  '/api/campaigns/delete',
  '/api/subscribers/delete',
  '/api/domains/delete',
  '/api/sending-servers/delete',
  '/api/payment/update',
  '/api/account/delete'
]

/**
 * Check if a path requires MFA verification
 */
export function requiresMFA(pathname: string): boolean {
  return SENSITIVE_PATHS.some(path => pathname.startsWith(path))
}

/**
 * Create MFA session after successful verification
 */
export function createMFASession(userId: string, tenantId: string): void {
  const sessionKey = `${userId}:${tenantId}`
  mfaSessions.set(sessionKey, {
    userId,
    tenantId,
    mfaVerified: true,
    mfaVerifiedAt: Date.now()
  })
}

/**
 * Check if user has valid MFA session
 */
export function hasValidMFASession(userId: string, tenantId: string): boolean {
  const sessionKey = `${userId}:${tenantId}`
  const session = mfaSessions.get(sessionKey)
  
  if (!session || !session.mfaVerified) {
    return false
  }
  
  // Check if session has expired
  if (session.mfaVerifiedAt && Date.now() - session.mfaVerifiedAt > MFA_SESSION_TIMEOUT) {
    mfaSessions.delete(sessionKey)
    return false
  }
  
  return true
}

/**
 * Clear MFA session
 */
export function clearMFASession(userId: string, tenantId: string): void {
  const sessionKey = `${userId}:${tenantId}`
  mfaSessions.delete(sessionKey)
}

/**
 * Refresh MFA session to extend its validity
 */
export function refreshMFASession(userId: string, tenantId: string): void {
  const sessionKey = `${userId}:${tenantId}`
  const session = mfaSessions.get(sessionKey)
  
  if (session) {
    session.mfaVerifiedAt = Date.now()
    mfaSessions.set(sessionKey, session)
  }
}

/**
 * Middleware to enforce MFA for sensitive operations
 */
export async function enforceMFA(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  
  // Check if this path requires MFA
  if (!requiresMFA(pathname)) {
    return null // Continue without MFA check
  }
  
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    
    // Check if user has MFA enabled
    const mfaEnabled = await isMFAEnabled(user.id, user.tenantId)
    
    if (!mfaEnabled) {
      // If MFA is not enabled, require user to enable it first
      return NextResponse.json(
        { 
          error: 'MFA required',
          message: 'Multi-factor authentication must be enabled to perform this action',
          requireMFASetup: true
        },
        { status: 403 }
      )
    }
    
    // Check if user has valid MFA session
    const hasValidSession = hasValidMFASession(user.id, user.tenantId)
    
    if (!hasValidSession) {
      return NextResponse.json(
        { 
          error: 'MFA verification required',
          message: 'Please verify your identity to perform this sensitive operation',
          requireMFAVerification: true
        },
        { status: 403 }
      )
    }
    
    // Refresh the MFA session to extend its validity
    refreshMFASession(user.id, user.tenantId)
    
    return null // Continue with the request
  } catch (error) {
    console.error('MFA enforcement error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * API route wrapper that enforces MFA
 */
export function withMFA<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const mfaResponse = await enforceMFA(request)
    if (mfaResponse) {
      return mfaResponse
    }
    
    return handler(request, ...args)
  }
}

/**
 * Next.js middleware function to enforce MFA for sensitive pages
 * This can be used in middleware.ts to protect frontend routes
 */
export async function mfaPageMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  
  // Define sensitive frontend paths that require MFA
  const sensitiveFrontendPaths = [
    '/settings/security',
    '/admin',
    '/billing/cancel',
    '/account/delete'
  ]
  
  // Check if this path requires MFA
  const requiresMFACheck = sensitiveFrontendPaths.some(path => pathname.startsWith(path))
  
  if (!requiresMFACheck) {
    return null // Continue without MFA check
  }
  
  try {
    const session = await auth()
    
    if (!session?.user) {
      // Redirect to login page
      const redirectUrl = new URL('/auth/signin', request.url)
      redirectUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    const { user } = session
    
    // Check if user has MFA enabled
    const mfaEnabled = await isMFAEnabled(user.id, user.tenantId)
    
    if (!mfaEnabled) {
      // Redirect to MFA setup page
      const redirectUrl = new URL('/settings/security/mfa-setup', request.url)
      redirectUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Check if user has valid MFA session
    const hasValidSession = hasValidMFASession(user.id, user.tenantId)
    
    if (!hasValidSession) {
      // Redirect to MFA verification page
      const redirectUrl = new URL('/auth/mfa-verify', request.url)
      redirectUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Refresh the MFA session to extend its validity
    refreshMFASession(user.id, user.tenantId)
    
    return null // Continue with the request
  } catch (error) {
    console.error('MFA page middleware error:', error)
    return null // Continue with the request in case of error
  }
}