import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import {
  validateSession,
  logSessionActivity,
  analyzeSessionSecurity,
  getClientIP,
  parseDeviceInfo,
  logSecurityEvent
} from './session-management'

export interface EnhancedSessionData {
  userId: string
  tenantId: string
  sessionId: string
  deviceInfo: any
  securityScore: number
  isSecure: boolean
}

// Session activity tracking configuration
const TRACK_ACTIVITIES = [
  'page_view',
  'api_call',
  'sensitive_operation',
  'data_export',
  'settings_change',
  'user_management',
  'billing_operation'
]

// High-risk paths that require additional security checks
const HIGH_RISK_PATHS = [
  '/api/users/delete',
  '/api/billing',
  '/api/settings/security',
  '/api/admin',
  '/api/payment',
  '/api/account/delete',
  '/api/data/export',
  '/api/subscribers/bulk-delete',
  '/api/campaigns/delete'
]

// Paths that should be tracked for activity monitoring
const TRACKED_PATHS = [
  '/api/',
  '/dashboard/',
  '/settings/',
  '/admin/',
  '/billing/'
]

/**
 * Enhanced session middleware that provides comprehensive session management
 */
export async function enhancedSessionMiddleware(request: NextRequest): Promise<NextResponse | null> {
  try {
    const pathname = request.nextUrl.pathname
    
    // Skip middleware for public paths
    if (isPublicPath(pathname)) {
      return null
    }

    // Get current session from NextAuth
    const session = await auth()
    
    if (!session?.user) {
      return null // Let NextAuth handle authentication
    }

    const { user } = session
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    const deviceInfo = parseDeviceInfo(userAgent)

    // Validate enhanced session if session token exists
    const sessionToken = request.cookies.get('session-token')?.value
    
    if (sessionToken) {
      const enhancedSession = await validateSession(sessionToken, request)
      
      if (!enhancedSession) {
        // Enhanced session is invalid, but NextAuth session exists
        // This could indicate a security issue
        await logSecurityEvent(
          user.id,
          'SESSION_HIJACK_ATTEMPT',
          'HIGH',
          'Enhanced session validation failed while NextAuth session exists',
          { ipAddress, userAgent, sessionToken: sessionToken.substring(0, 8) + '...' }
        )
        
        // Clear the invalid session token
        const response = NextResponse.next()
        response.cookies.delete('session-token')
        return response
      }
    }

    // Analyze current request security
    const securityAnalysis = await analyzeSessionSecurity(user.id, ipAddress, userAgent)
    
    if (securityAnalysis.isBlocked) {
      await logSecurityEvent(
        user.id,
        'SUSPICIOUS_LOGIN',
        'HIGH',
        securityAnalysis.blockReason || 'Request blocked due to security analysis',
        {
          ipAddress,
          userAgent,
          riskScore: securityAnalysis.riskScore,
          factors: securityAnalysis.factors
        }
      )

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Your request has been blocked due to security concerns. Please contact support if you believe this is an error.',
          code: 'SECURITY_BLOCK'
        },
        { status: 403 }
      )
    }

    // Check for high-risk operations
    if (isHighRiskPath(pathname)) {
      // Require additional verification for high-risk operations
      if (securityAnalysis.riskScore > 30) {
        await logSecurityEvent(
          user.id,
          'UNAUTHORIZED_ACCESS',
          'MEDIUM',
          'High-risk operation attempted with elevated risk score',
          {
            pathname,
            riskScore: securityAnalysis.riskScore,
            factors: securityAnalysis.factors
          }
        )

        return NextResponse.json(
          {
            error: 'Additional verification required',
            message: 'This operation requires additional security verification.',
            requireMFAVerification: true,
            riskScore: securityAnalysis.riskScore
          },
          { status: 403 }
        )
      }
    }

    // Log activity for tracked paths
    if (shouldTrackActivity(pathname)) {
      const activityType = getActivityType(pathname, request.method)
      
      await logSessionActivity(
        user.id,
        activityType,
        sessionToken ? 'enhanced' : 'basic',
        pathname,
        ipAddress,
        userAgent,
        undefined, // location will be resolved in the function
        {
          method: request.method,
          deviceInfo,
          riskScore: securityAnalysis.riskScore,
          tenantId: user.tenantId
        }
      )
    }

    // Add security headers to response
    const response = NextResponse.next()
    
    // Add security headers
    response.headers.set('X-Session-Security-Score', securityAnalysis.riskScore.toString())
    response.headers.set('X-Session-Factors', securityAnalysis.factors.join(','))
    
    // Add session info to request headers for API routes
    response.headers.set('X-Enhanced-Session', JSON.stringify({
      userId: user.id,
      tenantId: user.tenantId,
      sessionId: sessionToken || 'basic',
      deviceInfo,
      securityScore: securityAnalysis.riskScore,
      isSecure: securityAnalysis.riskScore < 30
    }))

    return response
  } catch (error) {
    console.error('Enhanced session middleware error:', error)
    
    // Log the error but don't block the request
    if (error instanceof Error) {
      console.error('Session middleware error details:', {
        message: error.message,
        stack: error.stack,
        pathname: request.nextUrl.pathname
      })
    }
    
    return null
  }
}

/**
 * Check if path is public and doesn't require session tracking
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/auth/',
    '/api/auth/',
    '/api/health',
    '/api/docs',
    '/forms/',
    '/unsubscribe/',
    '/track/',
    '/_next/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml'
  ]

  return publicPaths.some(path => pathname.startsWith(path)) || pathname === '/'
}

/**
 * Check if path is high-risk and requires additional security
 */
function isHighRiskPath(pathname: string): boolean {
  return HIGH_RISK_PATHS.some(path => pathname.startsWith(path))
}

/**
 * Check if activity should be tracked for this path
 */
function shouldTrackActivity(pathname: string): boolean {
  return TRACKED_PATHS.some(path => pathname.startsWith(path))
}

/**
 * Determine activity type based on path and method
 */
function getActivityType(pathname: string, method: string): string {
  if (pathname.startsWith('/api/')) {
    if (method === 'DELETE') return 'api_delete'
    if (method === 'POST') return 'api_create'
    if (method === 'PUT' || method === 'PATCH') return 'api_update'
    return 'api_call'
  }
  
  if (pathname.startsWith('/dashboard/')) return 'page_view'
  if (pathname.startsWith('/settings/')) return 'settings_view'
  if (pathname.startsWith('/admin/')) return 'admin_access'
  if (pathname.startsWith('/billing/')) return 'billing_access'
  
  return 'page_view'
}

/**
 * API route wrapper that provides enhanced session data
 */
export function withEnhancedSession<T extends any[]>(
  handler: (request: NextRequest, sessionData: EnhancedSessionData, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Get enhanced session data from headers (set by middleware)
      const sessionHeader = request.headers.get('X-Enhanced-Session')
      
      if (!sessionHeader) {
        return NextResponse.json(
          { error: 'Session data not available' },
          { status: 500 }
        )
      }

      const sessionData: EnhancedSessionData = JSON.parse(sessionHeader)
      
      // Additional security check for API routes
      if (!sessionData.isSecure && isHighRiskPath(request.nextUrl.pathname)) {
        await logSecurityEvent(
          sessionData.userId,
          'UNAUTHORIZED_ACCESS',
          'HIGH',
          'High-risk API access with insecure session',
          {
            pathname: request.nextUrl.pathname,
            securityScore: sessionData.securityScore
          }
        )

        return NextResponse.json(
          {
            error: 'Access denied',
            message: 'This operation requires a secure session.',
            requireMFAVerification: true
          },
          { status: 403 }
        )
      }

      return handler(request, sessionData, ...args)
    } catch (error) {
      console.error('Enhanced session wrapper error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Hook for React components to access enhanced session data
 */
export function useEnhancedSession() {
  // This would be implemented as a React hook in a real application
  // For now, we'll provide the interface
  return {
    sessionData: null as EnhancedSessionData | null,
    isLoading: false,
    error: null as Error | null,
    refreshSession: async () => {},
    invalidateSession: async () => {}
  }
}

/**
 * Utility to check if current session meets security requirements
 */
export async function requireSecureSession(
  userId: string,
  minSecurityScore: number = 70
): Promise<boolean> {
  try {
    const ipAddress = '127.0.0.1' // This would come from request context
    const userAgent = 'Unknown' // This would come from request context
    
    const analysis = await analyzeSessionSecurity(userId, ipAddress, userAgent)
    
    return analysis.riskScore <= (100 - minSecurityScore) && !analysis.isBlocked
  } catch (error) {
    console.error('Error checking session security:', error)
    return false
  }
}

/**
 * Force session refresh for security reasons
 */
export async function forceSessionRefresh(userId: string, reason: string): Promise<void> {
  try {
    await logSecurityEvent(
      userId,
      'ACCOUNT_LOCKOUT',
      'MEDIUM',
      `Forced session refresh: ${reason}`
    )

    // This would trigger a session refresh in the client
    // Implementation depends on the specific session management strategy
  } catch (error) {
    console.error('Error forcing session refresh:', error)
  }
}