import { NextRequest, NextResponse } from 'next/server'
import { withEnhancedSession } from '@/lib/enhanced-session-middleware'

/**
 * Test endpoint to verify enhanced session management
 */
export const GET = withEnhancedSession(async (request: NextRequest, sessionData) => {
  return NextResponse.json({
    message: 'Enhanced session test successful',
    sessionData: {
      userId: sessionData.userId,
      tenantId: sessionData.tenantId,
      sessionId: sessionData.sessionId,
      securityScore: sessionData.securityScore,
      isSecure: sessionData.isSecure,
      deviceInfo: sessionData.deviceInfo
    },
    timestamp: new Date().toISOString()
  })
})

export const POST = withEnhancedSession(async (request: NextRequest, sessionData) => {
  const body = await request.json()
  
  return NextResponse.json({
    message: 'Enhanced session POST test successful',
    receivedData: body,
    sessionData: {
      userId: sessionData.userId,
      tenantId: sessionData.tenantId,
      securityScore: sessionData.securityScore,
      isSecure: sessionData.isSecure
    }
  })
})