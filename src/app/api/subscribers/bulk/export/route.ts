import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { SubscriberStatus } from '@/types'
import Papa from 'papaparse'

// Validation schema for bulk export
const bulkExportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  filters: z.object({
    status: z.nativeEnum(SubscriberStatus).optional(),
    listId: z.string().optional(),
    search: z.string().optional(),
  }).optional().default({}),
  fields: z.array(z.string()).optional().default(['email', 'firstName', 'lastName', 'status', 'createdAt']),
  includeCustomFields: z.boolean().default(false),
})

/**
 * POST /api/subscribers/bulk/export
 * Export subscribers to CSV or JSON format
 */
async function exportSubscribers(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = bulkExportSchema.parse(body)

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Build where clause based on filters
    const where: any = {}
    
    if (validatedData.filters.status) {
      where.status = validatedData.filters.status
    }

    if (validatedData.filters.search) {
      where.OR = [
        { email: { contains: validatedData.filters.search } },
        { firstName: { contains: validatedData.filters.search } },
        { lastName: { contains: validatedData.filters.search } },
      ]
    }

    if (validatedData.filters.listId) {
      where.lists = {
        some: {
          listId: validatedData.filters.listId
        }
      }
    }

    // Get subscribers
    const subscribers = await tenantPrisma.prisma.subscriber.findMany({
      where,
      include: {
        lists: {
          include: {
            list: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform data based on selected fields
    const exportData = subscribers.map(subscriber => {
      const data: Record<string, any> = {}
      
      validatedData.fields.forEach(field => {
        switch (field) {
          case 'email':
            data.email = subscriber.email
            break
          case 'firstName':
            data.firstName = subscriber.firstName || ''
            break
          case 'lastName':
            data.lastName = subscriber.lastName || ''
            break
          case 'status':
            data.status = subscriber.status
            break
          case 'createdAt':
            data.createdAt = subscriber.createdAt.toISOString()
            break
          case 'updatedAt':
            data.updatedAt = subscriber.updatedAt.toISOString()
            break
          case 'lists':
            data.lists = subscriber.lists.map(l => l.list.name).join(', ')
            break
        }
      })

      // Include custom fields if requested
      if (validatedData.includeCustomFields && subscriber.customFields) {
        const customFields = subscriber.customFields as Record<string, any>
        Object.entries(customFields).forEach(([key, value]) => {
          data[`custom_${key}`] = value
        })
      }

      return data
    })

    // Generate export content based on format
    let content: string
    let contentType: string
    let filename: string

    if (validatedData.format === 'csv') {
      content = Papa.unparse(exportData)
      contentType = 'text/csv'
      filename = `subscribers_export_${new Date().toISOString().split('T')[0]}.csv`
    } else {
      content = JSON.stringify(exportData, null, 2)
      contentType = 'application/json'
      filename = `subscribers_export_${new Date().toISOString().split('T')[0]}.json`
    }

    // Return the file content
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': content.length.toString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error exporting subscribers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export subscribers' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handler
export const POST = withPermission(exportSubscribers, Resource.SUBSCRIBERS, Action.READ)