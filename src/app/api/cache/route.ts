import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cache } from '@/lib/cache';
import { cacheMonitoring } from '@/lib/cache-monitoring';
import { CacheWarmingService } from '@/lib/cache-warming';

/**
 * GET /api/cache - Get cache statistics and health
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to access cache management
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = searchParams.get('tenantId');

    switch (action) {
      case 'health':
        const health = await cacheMonitoring.getHealthStatus();
        return NextResponse.json({ health });

      case 'metrics':
        const metrics = await cacheMonitoring.getMetrics();
        return NextResponse.json({ metrics });

      case 'trends':
        const trends = cacheMonitoring.getPerformanceTrends();
        return NextResponse.json({ trends });

      case 'hotspots':
        const hotspots = await cacheMonitoring.getHotspots();
        return NextResponse.json({ hotspots });

      case 'slow-queries':
        const slowQueries = await cacheMonitoring.getSlowQueries();
        return NextResponse.json({ slowQueries });

      case 'recommendations':
        const recommendations = await cacheMonitoring.getOptimizationRecommendations();
        return NextResponse.json({ recommendations });

      case 'export':
        const format = searchParams.get('format') || 'json';
        const exported = await cacheMonitoring.exportMetrics();

        switch (format) {
          case 'prometheus':
            return new NextResponse(exported.prometheus, {
              headers: { 'Content-Type': 'text/plain' },
            });
          case 'csv':
            return new NextResponse(exported.csv, {
              headers: { 'Content-Type': 'text/csv' },
            });
          default:
            return NextResponse.json(exported.json);
        }

      case 'tenant-stats':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        const tenantStats = await getTenantCacheStats(tenantId);
        return NextResponse.json({ tenantStats });

      default:
        // Return comprehensive cache overview
        const [healthStatus, cacheMetrics, performanceTrends] = await Promise.all([
          cacheMonitoring.getHealthStatus(),
          cacheMonitoring.getMetrics(),
          cacheMonitoring.getPerformanceTrends(),
        ]);

        return NextResponse.json({
          health: healthStatus,
          metrics: cacheMetrics,
          trends: performanceTrends,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Cache API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/cache - Cache management operations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to manage cache
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, tenantId, key, pattern, tags } = body;

    switch (action) {
      case 'invalidate-key':
        if (!key) {
          return NextResponse.json({ error: 'Key required' }, { status: 400 });
        }

        const deleted = await cache.del(key);
        return NextResponse.json({
          success: deleted,
          message: deleted ? 'Key invalidated' : 'Key not found',
        });

      case 'invalidate-pattern':
        if (!pattern) {
          return NextResponse.json({ error: 'Pattern required' }, { status: 400 });
        }

        const deletedCount = await cache.invalidatePattern(pattern);
        return NextResponse.json({
          success: true,
          deletedCount,
          message: `${deletedCount} keys invalidated`,
        });

      case 'invalidate-tenant':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        const tenantDeletedCount = await cache.invalidateTenant(tenantId);
        return NextResponse.json({
          success: true,
          deletedCount: tenantDeletedCount,
          message: `${tenantDeletedCount} tenant keys invalidated`,
        });

      case 'invalidate-tags':
        if (!tags || !Array.isArray(tags)) {
          return NextResponse.json({ error: 'Tags array required' }, { status: 400 });
        }

        const tagDeletedCount = await cache.invalidateByTags(tags);
        return NextResponse.json({
          success: true,
          deletedCount: tagDeletedCount,
          message: `${tagDeletedCount} tagged keys invalidated`,
        });

      case 'warm-tenant':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        await CacheWarmingService.warmTenantData(tenantId);
        return NextResponse.json({
          success: true,
          message: 'Tenant cache warming initiated',
        });

      case 'warm-all-tenants':
        // This is a heavy operation, so we'll run it in the background
        CacheWarmingService.scheduleWarmingForAllTenants().catch(error => {
          console.error('Background cache warming failed:', error);
        });

        return NextResponse.json({
          success: true,
          message: 'Cache warming for all tenants initiated in background',
        });

      case 'warm-dashboard':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        await CacheWarmingService.warmDashboardStats(tenantId);
        return NextResponse.json({
          success: true,
          message: 'Dashboard cache warming completed',
        });

      case 'warm-analytics':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        await CacheWarmingService.warmAnalyticsData(tenantId);
        return NextResponse.json({
          success: true,
          message: 'Analytics cache warming completed',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/cache - Clear cache
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin users to clear cache
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const tenantId = searchParams.get('tenantId');

    switch (scope) {
      case 'tenant':
        if (!tenantId) {
          return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        const deletedCount = await cache.invalidateTenant(tenantId);
        return NextResponse.json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} keys for tenant ${tenantId}`,
        });

      case 'all':
        // This is a dangerous operation - clear all cache
        const allKeys = await cache.keys('emp:*');
        const totalDeleted = await cache.delMany(allKeys);

        return NextResponse.json({
          success: true,
          deletedCount: totalDeleted,
          message: `Cleared ${totalDeleted} keys from cache`,
        });

      default:
        return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get cache statistics for a specific tenant
 */
async function getTenantCacheStats(tenantId: string) {
  try {
    const pattern = `emp:*:${tenantId}:*`;
    const keys = await cache.keys(pattern);

    const stats = {
      totalKeys: keys.length,
      keysByType: {} as Record<string, number>,
      memoryUsage: 0,
      hitRate: 0, // Would need to track this over time
    };

    // Categorize keys by type
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 2) {
        const type = parts[1];
        stats.keysByType[type] = (stats.keysByType[type] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    console.error(`Failed to get tenant cache stats for ${tenantId}:`, error);
    return {
      totalKeys: 0,
      keysByType: {},
      memoryUsage: 0,
      hitRate: 0,
    };
  }
}
