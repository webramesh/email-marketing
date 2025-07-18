import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus } from '@/types'
import Papa from 'papaparse'

export interface ImportOptions {
  skipDuplicates: boolean
  updateExisting: boolean
  defaultStatus: SubscriberStatus
}

export interface ImportResult {
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

export interface ExportOptions {
  format: 'csv' | 'json'
  filters: {
    status?: SubscriberStatus
    listId?: string
    search?: string
  }
  fields: string[]
  includeCustomFields: boolean
}

export interface ColumnMapping {
  email: string
  firstName?: string
  lastName?: string
  status?: string
}

export class SubscriberBulkService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Preview CSV data for import mapping
   */
  async previewCsvData(csvData: string): Promise<{
    headers: string[]
    sampleRows: Record<string, string>[]
    totalRows: number
  }> {
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      preview: 5, // Only parse first 5 rows for preview
    })

    if (parseResult.errors.length > 0) {
      throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`)
    }

    const fullParseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    })

    return {
      headers: parseResult.meta.fields || [],
      sampleRows: parseResult.data as Record<string, string>[],
      totalRows: fullParseResult.data.length,
    }
  }

  /**
   * Import subscribers from CSV data
   */
  async importFromCsv(
    csvData: string,
    mapping: ColumnMapping,
    options: ImportOptions
  ): Promise<ImportResult> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Parse CSV data
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parseResult.errors.length > 0) {
      throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`)
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
        const email = row[mapping.email]?.trim()
        
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
          firstName: mapping.firstName ? row[mapping.firstName]?.trim() || null : null,
          lastName: mapping.lastName ? row[mapping.lastName]?.trim() || null : null,
          status: mapping.status ? 
            (row[mapping.status]?.trim() as SubscriberStatus) || options.defaultStatus :
            options.defaultStatus,
        }

        // Validate status if provided
        if (mapping.status && row[mapping.status]) {
          const statusValue = row[mapping.status]?.trim().toUpperCase()
          if (!Object.values(SubscriberStatus).includes(statusValue as SubscriberStatus)) {
            subscriberData.status = options.defaultStatus
          }
        }

        // Check if subscriber already exists
        const existingSubscriber = await tenantPrisma.prisma.subscriber.findUnique({
          where: {
            email_tenantId: {
              email,
              tenantId: this.tenantId
            }
          }
        })

        if (existingSubscriber) {
          if (options.skipDuplicates && !options.updateExisting) {
            result.skipped++
            continue
          }

          if (options.updateExisting) {
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
                connect: { id: this.tenantId }
              }
            }
          })
          result.imported++
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          email: row[mapping.email]?.trim(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  /**
   * Export subscribers to specified format
   */
  async exportSubscribers(options: ExportOptions): Promise<{
    content: string
    filename: string
    contentType: string
  }> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Build where clause based on filters
    const where: any = {}
    
    if (options.filters.status) {
      where.status = options.filters.status
    }

    if (options.filters.search) {
      where.OR = [
        { email: { contains: options.filters.search } },
        { firstName: { contains: options.filters.search } },
        { lastName: { contains: options.filters.search } },
      ]
    }

    if (options.filters.listId) {
      where.lists = {
        some: {
          listId: options.filters.listId
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
      
      options.fields.forEach(field => {
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
      if (options.includeCustomFields && subscriber.customFields) {
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

    if (options.format === 'csv') {
      content = Papa.unparse(exportData)
      contentType = 'text/csv'
      filename = `subscribers_export_${new Date().toISOString().split('T')[0]}.csv`
    } else {
      content = JSON.stringify(exportData, null, 2)
      contentType = 'application/json'
      filename = `subscribers_export_${new Date().toISOString().split('T')[0]}.json`
    }

    return {
      content,
      filename,
      contentType,
    }
  }

  /**
   * Get import progress (for future implementation with job queues)
   */
  async getImportProgress(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress: number
    result?: ImportResult
    error?: string
  }> {
    // This would be implemented with a job queue system like Bull
    // For now, return a placeholder
    return {
      status: 'completed',
      progress: 100,
    }
  }
}