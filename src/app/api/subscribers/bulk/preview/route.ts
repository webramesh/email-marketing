import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { z } from 'zod'
import Papa from 'papaparse'

// Validation schema for CSV preview
const previewSchema = z.object({
  csvData: z.string(),
})

/**
 * POST /api/subscribers/bulk/preview
 * Preview CSV data for import mapping
 */
async function previewCsvData(request: NextRequest) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = previewSchema.parse(body)

    // Parse CSV data for preview
    const parseResult = Papa.parse(validatedData.csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      preview: 5, // Only parse first 5 rows for preview
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

    // Get total row count
    const fullParseResult = Papa.parse(validatedData.csvData, {
      header: true,
      skipEmptyLines: true,
    })

    const previewData = {
      headers: parseResult.meta.fields || [],
      sampleRows: parseResult.data as Record<string, string>[],
      totalRows: fullParseResult.data.length,
    }

    return NextResponse.json({
      success: true,
      data: previewData
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error previewing CSV:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to preview CSV data' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handler
export const POST = withPermission(previewCsvData, Resource.SUBSCRIBERS, Action.READ)