import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createUserSession,
  validateSession,
  invalidateSession,
  getUserActiveSessions,
  updateSessionPreferences,
  validateRememberToken,
  invalidateRememberToken
} from '@/lib/session-management'

/**
 * GET /api/auth/session - Get current session info and active sessions
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
    
    // Get all active sessions for the user
    const activeSessions = await getUserActiveSessions(user.id)
    
    // Get current session info if session token exists
    const sessionToken = request.cookies.get('session-token')?.value
    let currentSession = null
    
    if (sessionToken) {
      currentSession = await validateSession(sessionToken, request)
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      },
      currentSession,
      activeSessions: activeSessions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        location: s.location,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
        isCurrent: s.sessionToken === sessionToken
      }))
    })
  } catch (error) {
    console.error('Error getting session info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/session - Create enhanced session (login with session tracking)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rememberMe = false, location } = body

    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user } = session

    // Create enhanced session
    const { sessionToken, rememberToken } = await createUserSession(
      user.id,
      request,
      rememberMe,
      location
    )

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      sessionToken: sessionToken.substring(0, 8) + '...', // Don't expose full token
      rememberMe: !!rememberToken
    })

    // Set secure HTTP-only cookies
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    if (rememberToken) {
      response.cookies.set('remember-token', rememberToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })
    }

    return response
  } catch (error) {
    console.error('Error creating enhanced session:', error)
    
    if (error instanceof Error && error.message.includes('blocked')) {
      return NextResponse.json(
        { 
          error: 'Login blocked',
          message: error.message
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/session - Logout and invalidate session
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const allSessions = url.searchParams.get('all') === 'true'

    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const sessionToken = request.cookies.get('session-token')?.value
    const rememberToken = request.cookies.get('remember-token')?.value

    if (allSessions) {
      // Invalidate all sessions for the user
      const { invalidateAllUserSessions } = await import('@/lib/session-management')
      const count = await invalidateAllUserSessions(session.user.id)
      
      const response = NextResponse.json({
        success: true,
        message: `${count} sessions invalidated`
      })

      // Clear cookies
      response.cookies.delete('session-token')
      response.cookies.delete('remember-token')

      return response
    } else if (sessionId) {
      // Invalidate specific session by ID
      // This would require additional implementation to find session by ID
      return NextResponse.json(
        { error: 'Not implemented' },
        { status: 501 }
      )
    } else {
      // Invalidate current session
      let success = true
      
      if (sessionToken) {
        success = await invalidateSession(sessionToken)
      }

      if (rememberToken) {
        await invalidateRememberToken(rememberToken)
      }

      const response = NextResponse.json({
        success,
        message: 'Session invalidated'
      })

      // Clear cookies
      response.cookies.delete('session-token')
      response.cookies.delete('remember-token')

      return response
    }
  } catch (error) {
    console.error('Error invalidating session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/auth/session - Update session preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionTimeout, maxConcurrentSessions, rememberMeEnabled } = body

    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate input
    const preferences: any = {}
    
    if (typeof sessionTimeout === 'number' && sessionTimeout >= 300 && sessionTimeout <= 86400) {
      preferences.sessionTimeout = sessionTimeout
    }
    
    if (typeof maxConcurrentSessions === 'number' && maxConcurrentSessions >= 1 && maxConcurrentSessions <= 10) {
      preferences.maxConcurrentSessions = maxConcurrentSessions
    }
    
    if (typeof rememberMeEnabled === 'boolean') {
      preferences.rememberMeEnabled = rememberMeEnabled
    }

    if (Object.keys(preferences).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided' },
        { status: 400 }
      )
    }

    const success = await updateSessionPreferences(session.user.id, preferences)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Session preferences updated',
      preferences
    })
  } catch (error) {
    console.error('Error updating session preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}