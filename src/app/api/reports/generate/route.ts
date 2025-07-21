import { NextRequest, NextResponse } from 'next/server';
import { ReportingService, ReportConfig } from '@/services/reporting.service';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const reportConfig: ReportConfig = await request.json();

    // Validate report configuration
    if (!reportConfig.name || !reportConfig.type || !reportConfig.metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, metrics' },
        { status: 400 }
      );
    }

    // Generate the report
    const reportData = await ReportingService.generateReport(reportConfig, tenantId);
    
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}