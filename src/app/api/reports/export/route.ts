import { NextRequest, NextResponse } from 'next/server';
import { ReportingService } from '@/services/reporting.service';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { reportConfig, format } = await request.json();

    if (!reportConfig || !format) {
      return NextResponse.json(
        { error: 'Missing reportConfig or format' },
        { status: 400 }
      );
    }

    // Generate the report data
    const reportData = await ReportingService.generateReport(reportConfig, tenantId);
    
    // Export to requested format
    const exportedData = await ReportingService.exportReport(reportData, format);

    // Set appropriate headers based on format
    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename="${reportConfig.name}_${new Date().toISOString().split('T')[0]}.${format}"`,
    };

    switch (format.toLowerCase()) {
      case 'json':
        headers['Content-Type'] = 'application/json';
        break;
      case 'csv':
        headers['Content-Type'] = 'text/csv';
        break;
      case 'pdf':
        headers['Content-Type'] = 'application/pdf';
        break;
      case 'excel':
        headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      default:
        headers['Content-Type'] = 'application/octet-stream';
    }

    return new NextResponse(exportedData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Report export error:', error);
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}