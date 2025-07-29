import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { dbPerformance, checkDatabaseHealth, getConnectionPoolMetrics } from '@/lib/prisma';

/**
 * GET /api/database/performance - Get database performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to access database performance metrics
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const queryName = searchParams.get('queryName');

    switch (action) {
      case 'health':
        const health = await checkDatabaseHealth();
        return NextResponse.json({ health });

      case 'connection-pool':
        const connectionPool = await getConnectionPoolMetrics();
        return NextResponse.json({ connectionPool });

      case 'query-stats':
        const queryStats = dbPerformance.getQueryStats(queryName || undefined);
        return NextResponse.json({ queryStats });

      case 'slow-queries':
        const threshold = parseInt(searchParams.get('threshold') || '1000');
        const slowQueries = dbPerformance.getSlowQueries(threshold);
        return NextResponse.json({ slowQueries });

      case 'optimization-suggestions':
        const suggestions = await dbPerformance.analyzeQueryPerformance();
        return NextResponse.json({ suggestions });

      case 'report':
        const report = await dbPerformance.generatePerformanceReport();
        return NextResponse.json({ report });

      case 'export':
        const format = searchParams.get('format') || 'json';
        const exported = dbPerformance.exportMetrics();
        
        switch (format) {
          case 'prometheus':
            return new NextResponse(exported.prometheus, {
              headers: { 'Content-Type': 'text/plain' },
            });
          default:
            return NextResponse.json(exported.json);
        }

      default:
        // Return comprehensive database performance overview
        const [
          healthStatus,
          connectionPoolStatus,
          allQueryStats,
          slowQueriesData,
          optimizationSuggestions,
        ] = await Promise.all([
          checkDatabaseHealth(),
          getConnectionPoolMetrics(),
          Promise.resolve(dbPerformance.getQueryStats()),
          Promise.resolve(dbPerformance.getSlowQueries()),
          dbPerformance.analyzeQueryPerformance(),
        ]);

        return NextResponse.json({
          health: healthStatus,
          connectionPool: connectionPoolStatus,
          queryStats: allQueryStats.slice(0, 20), // Top 20 queries
          slowQueries: slowQueriesData.slice(0, 10), // Top 10 slow queries
          optimizationSuggestions: optimizationSuggestions.slice(0, 5), // Top 5 suggestions
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Database performance API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/database/performance - Database performance management operations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to manage database performance
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, queryName } = body;

    switch (action) {
      case 'clear-metrics':
        dbPerformance.clearMetrics(queryName);
        return NextResponse.json({ 
          success: true,
          message: queryName 
            ? `Metrics cleared for query: ${queryName}`
            : 'All metrics cleared'
        });

      case 'analyze-performance':
        const analysis = await dbPerformance.analyzeQueryPerformance();
        return NextResponse.json({ 
          success: true,
          analysis,
          message: `Found ${analysis.length} optimization suggestions`
        });

      case 'generate-report':
        const report = await dbPerformance.generatePerformanceReport();
        return NextResponse.json({ 
          success: true,
          report,
          message: 'Performance report generated successfully'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database performance management error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/database/performance - Clear performance metrics
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to clear performance metrics
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryName = searchParams.get('queryName');

    dbPerformance.clearMetrics(queryName || undefined);

    return NextResponse.json({ 
      success: true,
      message: queryName 
        ? `Metrics cleared for query: ${queryName}`
        : 'All performance metrics cleared'
    });
  } catch (error) {
    console.error('Database performance clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}