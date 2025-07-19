import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { SubscriberStatus } from '@/types'

// Validation schemas
const createSubscriberSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.nativeEnum(SubscriberStatus).optional().default(SubscriberStatus.ACTIVE),
  customFields: z.record(z.string(), z.any()).optional(),
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(SubscriberStatus).optional(),
  sortBy: z.enum(['email', 'firstName', 'lastName', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * GET /api/subscribers
 * Get all subscribers for the current tenant with pagination and filtering
 */
async function getSubscribers(request: NextRequest) {
  try {
    // For development, use demo tenant directly
    let tenantId = 'demo-tenant'
    
    // In production, get tenant from headers
    if (process.env.NODE_ENV !== 'development') {
      const { tenantId: headerTenantId } = getTenantFromHeaders(request.headers)
      
      if (!headerTenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant context not found' },
          { status: 400 }
        )
      }
      tenantId = headerTenantId
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    })

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Build where clause
    const where: any = {}
    
    if (query.search) {
      where.OR = [
        { email: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
      ]
    }
    
    if (query.status) {
      where.status = query.status
    }

    // Get total count
    const total = await tenantPrisma.prisma.subscriber.count({ where })
    
    // Get subscribers with pagination
    const subscribers = await tenantPrisma.prisma.subscriber.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        lists: {
          include: {
            list: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: {
            emailEvents: true
          }
        }
      }
    })

    const totalPages = Math.ceil(total / query.limit)

    return NextResponse.json({
      success: true,
      data: subscribers,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
      }
    })
  } catch (error) {
    console.error('Error fetching subscribers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscribers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscribers
 * Create a new subscriber
 */
async function createSubscriber(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = createSubscriberSchema.parse(body)

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Check if subscriber already exists
    const existingSubscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: {
        email_tenantId: {
          email: validatedData.email,
          tenantId
        }
      }
    })

    if (existingSubscriber) {
      return NextResponse.json(
        { success: false, error: 'Subscriber with this email already exists' },
        { status: 409 }
      )
    }

    const subscriber = await tenantPrisma.prisma.subscriber.create({
      data: {
        ...validatedData,
        tenant: {
          connect: { id: tenantId }
        }
      },
      include: {
        lists: {
          include: {
            list: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: subscriber,
      message: 'Subscriber created successfully'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating subscriber:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create subscriber' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers (disabled in development)
export const GET = process.env.NODE_ENV === 'development' ? getSubscribers : withPermission(getSubscribers, Resource.SUBSCRIBERS, Action.READ)
export const POST = process.env.NODE_ENV === 'development' ? createSubscriber : withPermission(createSubscriber, Resource.SUBSCRIBERS, Action.CREATE)