import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * GET /api/auth/session/activities - Get session activities and security events
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
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const type = url.searchParams.get('type') // 'activities' or 'security'

    if (type === 'security') {
      // Get security events
      const securityEvents = await prisma.securityEvent.findMany({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          eventType: true,
          severity: true,
          description: true,
          ipAddress: true,
          location: true,
          isResolved: true,
          createdAt: true
        }
      })

      const totalCount = await prisma.securityEvent.count({
        where: {
          userId: user.id
        }
      })

      return NextResponse.json({
        events: securityEvents,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      })
    } else {
      // Get session activities
      const activities = await prisma.sessionActivity.findMany({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          resource: true,
          ipAddress: true,
          location: true,
          riskScore: true,
          isBlocked: true,
          blockReason: true,
          createdAt: true,
          session: {
            select: {
              deviceName: true,
              deviceType: true,
              browser: true
            }
          }
        }
      })

      const totalCount = await prisma.sessionActivity.count({
        where: {
          userId: user.id
        }
      })

      return NextResponse.json({
        activities,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      })
    }
  } catch (error) {
    console.error('Error getting session activities:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/session/activities - Mark security event as resolved
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

    const body = await request.json()
    const { eventId, action } = body

    if (action === 'resolve') {
      const event = await prisma.securityEvent.findFirst({
        where: {
          id: eventId,
          userId: session.user.id
        }
      })

      if (!event) {
        return NextResponse.json(
          { error: 'Security event not found' },
          { status: 404 }
        )
      }

      await prisma.securityEvent.update({
        where: { id: eventId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: session.user.id
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Security event marked as resolved'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating security event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}