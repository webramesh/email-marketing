import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import { SubscriberStatus } from '@/types'
import Papa from 'papaparse'

// Validation schema for bulk import
const bulkImportSchema = z.object({
  csvData: z.string(),
  mapping: z.object({
    email: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    status: z.string().optional(),
  }),
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    updateExisting: z.boolean().default(false),
    defaultStatus: z.nativeEnum(SubscriberStatus).default(SubscriberStatus.ACTIVE),
  }).optional().default(() => ({
    skipDuplicates: true,
    updateExisting: false,
    defaultStatus: SubscriberStatus.ACTIVE,
  })),
})

interface ImportResult {
  total: number
  imported: number
  updated: number
  skipped: number
  errors: Array<{
    row: number
    email?: string
    error: string
  }>
}

/**
 * POST /api/subscribers/bulk/import
 * Import subscribers from CSV data
 */
async function importSubscribers(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = bulkImportSchema.parse(body)

    const tenantPrisma = createTenantPrisma(tenantId)
    
    // Parse CSV data
    const parseResult = Papa.parse(validatedData.csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'CSV parsing failed',
          details: parseResult.errors 
        },
        { status: 400 }
      )
    }

    const rows = parseResult.data as Record<string, string>[]
    const result: ImportResult = {
      total: rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1

      try {
        // Extract data based on mapping
        const email = row[validatedData.mapping.email]?.trim()
        
        if (!email) {
          result.errors.push({
            row: rowNumber,
            error: 'Email is required'
          })
          continue
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          result.errors.push({
            row: rowNumber,
            email,
            error: 'Invalid email format'
          })
          continue
        }

        const subscriberData = {
          email,
          firstName: validatedData.mapping.firstName ? row[validatedData.mapping.firstName]?.trim() || null : null,
          lastName: validatedData.mapping.lastName ? row[validatedData.mapping.lastName]?.trim() || null : null,
          status: validatedData.mapping.status ? 
            (row[validatedData.mapping.status]?.trim() as SubscriberStatus) || validatedData.options.defaultStatus :
            validatedData.options.defaultStatus,
        }

        // Check if subscriber already exists
        const existingSubscriber = await tenantPrisma.prisma.subscriber.findUnique({
          where: {
            email_tenantId: {
              email,
              tenantId
            }
          }
        })

        if (existingSubscriber) {
          if (validatedData.options.skipDuplicates && !validatedData.options.updateExisting) {
            result.skipped++
            continue
          }

          if (validatedData.options.updateExisting) {
            await tenantPrisma.prisma.subscriber.update({
              where: { id: existingSubscriber.id },
              data: {
                firstName: subscriberData.firstName,
                lastName: subscriberData.lastName,
                status: subscriberData.status,
              }
            })
            result.updated++
          } else {
            result.skipped++
          }
        } else {
          // Create new subscriber
          await tenantPrisma.prisma.subscriber.create({
            data: {
              ...subscriberData,
              tenant: {
                connect: { id: tenantId }
              }
            }
          })
          result.imported++
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          email: row[validatedData.mapping.email]?.trim(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Import completed: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error importing subscribers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import subscribers' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handler
export const POST = withPermission(importSubscribers, Resource.SUBSCRIBERS, Action.CREATE)