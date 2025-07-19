import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { ListService } from '@/services/list.service'

/**
 * GET /api/lists/[id]/export
 * Export a list with all its subscribers
 */
async function exportList(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers)
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 400 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    const listService = new ListService(tenantId)
    const exportData = await listService.exportList(id)

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = ['Email', 'First Name', 'Last Name', 'Status', 'Added to List At']
      const csvRows = exportData.subscribers.map(sub => [
        sub.email,
        sub.firstName || '',
        sub.lastName || '',
        sub.status,
        sub.addedToListAt.toISOString()
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${exportData.list.name}_subscribers.csv"`
        }
      })
    }

    // Default JSON format
    return NextResponse.json({
      success: true,
      data: exportData
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'List not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    console.error('Error exporting list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export list' },
      { status: 500 }
    )
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(exportList, Resource.LISTS, Action.READ)