import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { withMFA } from '@/lib/mfa-middleware'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { SubscriberStatus } from '@/types'

// Validation schemas
const updateSubscriberSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.nativeEnum(SubscriberStatus).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
})

/**
 * GET /api/subscribers/[id]
 * Get a specific subscriber by ID
 */
async function getSubscriber(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const tenantPrisma = createTenantPrisma(tenantId)
    
    const subscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: { id },
      include: {
        lists: {
          include: {
            list: {
              select: { id: true, name: true }
            }
          }
        },
        emailEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            type: true,
            createdAt: true,
            campaign: {
              select: { id: true, name: true, subject: true }
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

    if (!subscriber) {
      return NextResponse.json(
        { success: false, error: 'Subscriber not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: subscriber
    })
  } catch (error) {
    console.error('Error fetching subscriber:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriber' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/subscribers/[id]
 * Update a specific subscriber
 */
async function updateSubscriber(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateSubscriberSchema.parse(body)

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Check if subscriber exists
    const existingSubscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: { id }
    })

    if (!existingSubscriber) {
      return NextResponse.json(
        { success: false, error: 'Subscriber not found' },
        { status: 404 }
      )
    }

    // If email is being updated, check for duplicates
    if (validatedData.email && validatedData.email !== existingSubscriber.email) {
      const emailExists = await tenantPrisma.prisma.subscriber.findUnique({
        where: {
          email_tenantId: {
            email: validatedData.email,
            tenantId
          }
        }
      })

      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'Subscriber with this email already exists' },
          { status: 409 }
        )
      }
    }

    const subscriber = await tenantPrisma.prisma.subscriber.update({
      where: { id },
      data: validatedData,
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
      message: 'Subscriber updated successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating subscriber:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update subscriber' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/subscribers/[id]
 * Delete a specific subscriber
 */
async function deleteSubscriber(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Check if subscriber exists
    const existingSubscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: { id }
    })

    if (!existingSubscriber) {
      return NextResponse.json(
        { success: false, error: 'Subscriber not found' },
        { status: 404 }
      )
    }

    // Delete subscriber (this will cascade delete related records)
    await tenantPrisma.prisma.subscriber.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Subscriber deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting subscriber:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete subscriber' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(getSubscriber, Resource.SUBSCRIBERS, Action.READ)
export const PUT = withPermission(updateSubscriber, Resource.SUBSCRIBERS, Action.UPDATE)
// Apply both RBAC and MFA middleware for sensitive delete operations
export const DELETE = withMFA(withPermission(deleteSubscriber, Resource.SUBSCRIBERS, Action.DELETE))