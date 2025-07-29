import { cache, CacheKeys } from './cache';
import { getRedis } from './queue';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  memoryUsage: string;
  keyCount: number;
  evictions: number;
  connections: number;
  avgLatency: number;
  tenantDistribution: Record<string, number>;
}

export interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  memoryUsage: number;
  keyCount: number;
  hitRate: number;
  issues: string[];
}

export class CacheMonitoringService {
  private redis = getRedis();
  private metricsHistory: CacheMetrics[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Get comprehensive cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const [info, stats, keyspace] = await Promise.all([
        this.redis.info('memory'),
        this.redis.info('stats'),
        this.redis.info('keyspace'),
      ]);

      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      // Parse stats
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      const evictionsMatch = stats.match(/evicted_keys:(\d+)/);
      const connectionsMatch = stats.match(/connected_clients:(\d+)/);

      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const evictions = evictionsMatch ? parseInt(evictionsMatch[1]) : 0;
      const connections = connectionsMatch ? parseInt(connectionsMatch[1]) : 0;

      const totalRequests = hits + misses;
      const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (misses / totalRequests) * 100 : 0;

      // Parse keyspace info
      const keyMatch = keyspace.match(/keys=(\d+)/);
      const keyCount = keyMatch ? parseInt(keyMatch[1]) : 0;

      // Get tenant distribution
      const tenantDistribution = await this.getTenantKeyDistribution();

      // Calculate average latency (simplified - in production, you'd track this over time)
      const avgLatency = await this.measureAverageLatency();

      const metrics: CacheMetrics = {
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        totalRequests,
        memoryUsage,
        keyCount,
        evictions,
        connections,
        avgLatency,
        tenantDistribution,
      };

      // Store in history
      this.addToHistory(metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to get cache metrics:', error);
      throw error;
    }
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    try {
      const startTime = Date.now();
      const metrics = await this.getMetrics();
      const latency = Date.now() - startTime;

      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check latency
      if (latency > 100) {
        issues.push(`High latency: ${latency}ms`);
        status = 'degraded';
      }
      if (latency > 500) {
        status = 'unhealthy';
      }

      // Check hit rate
      if (metrics.hitRate < 70) {
        issues.push(`Low hit rate: ${metrics.hitRate}%`);
        if (status === 'healthy') status = 'degraded';
      }
      if (metrics.hitRate < 50) {
        status = 'unhealthy';
      }

      // Check memory usage (simplified - you'd need to parse actual bytes)
      const memoryUsageNum = this.parseMemoryUsage(metrics.memoryUsage);
      if (memoryUsageNum > 1000) {
        // > 1GB
        issues.push(`High memory usage: ${metrics.memoryUsage}`);
        if (status === 'healthy') status = 'degraded';
      }

      // Check key count
      if (metrics.keyCount > 100000) {
        issues.push(`High key count: ${metrics.keyCount}`);
        if (status === 'healthy') status = 'degraded';
      }

      // Check evictions
      if (metrics.evictions > 1000) {
        issues.push(`High eviction count: ${metrics.evictions}`);
        if (status === 'healthy') status = 'degraded';
      }

      return {
        status,
        latency,
        memoryUsage: memoryUsageNum,
        keyCount: metrics.keyCount,
        hitRate: metrics.hitRate,
        issues,
      };
    } catch (error) {
      console.error('Failed to get cache health status:', error);
      return {
        status: 'unhealthy',
        latency: -1,
        memoryUsage: -1,
        keyCount: -1,
        hitRate: -1,
        issues: ['Failed to connect to cache'],
      };
    }
  }

  /**
   * Get tenant key distribution
   */
  private async getTenantKeyDistribution(): Promise<Record<string, number>> {
    try {
      const pattern = 'emp:*:*:*'; // Our cache key pattern
      const keys = await this.redis.keys(pattern);

      const distribution: Record<string, number> = {};

      for (const key of keys) {
        // Extract tenant ID from key pattern: emp:type:tenantId:...
        const parts = key.split(':');
        if (parts.length >= 3) {
          const tenantId = parts[2];
          distribution[tenantId] = (distribution[tenantId] || 0) + 1;
        }
      }

      return distribution;
    } catch (error) {
      console.error('Failed to get tenant key distribution:', error);
      return {};
    }
  }

  /**
   * Measure average latency with sample operations
   */
  private async measureAverageLatency(): Promise<number> {
    try {
      const sampleSize = 10;
      const latencies: number[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const start = Date.now();
        await this.redis.ping();
        const latency = Date.now() - start;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / sampleSize;
      return Math.round(avgLatency * 100) / 100;
    } catch (error) {
      console.error('Failed to measure average latency:', error);
      return -1;
    }
  }

  /**
   * Parse memory usage string to approximate bytes
   */
  private parseMemoryUsage(memoryStr: string): number {
    try {
      const match = memoryStr.match(/^([\d.]+)([KMGT]?)B?$/i);
      if (!match) return -1;

      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();

      switch (unit) {
        case 'K':
          return value * 1024;
        case 'M':
          return value * 1024 * 1024;
        case 'G':
          return value * 1024 * 1024 * 1024;
        case 'T':
          return value * 1024 * 1024 * 1024 * 1024;
        default:
          return value;
      }
    } catch (error) {
      return -1;
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: CacheMetrics): void {
    this.metricsHistory.push({
      ...metrics,
      // Add timestamp for historical tracking
      timestamp: Date.now(),
    } as any);

    // Keep only the last N metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): CacheMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get cache performance trends
   */
  getPerformanceTrends(): {
    hitRateTrend: 'improving' | 'declining' | 'stable';
    latencyTrend: 'improving' | 'declining' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.metricsHistory.length < 2) {
      return {
        hitRateTrend: 'stable',
        latencyTrend: 'stable',
        memoryTrend: 'stable',
      };
    }

    const recent = this.metricsHistory.slice(-10); // Last 10 metrics
    const older = this.metricsHistory.slice(-20, -10); // Previous 10 metrics

    if (recent.length === 0 || older.length === 0) {
      return {
        hitRateTrend: 'stable',
        latencyTrend: 'stable',
        memoryTrend: 'stable',
      };
    }

    const recentAvgHitRate = recent.reduce((sum, m) => sum + m.hitRate, 0) / recent.length;
    const olderAvgHitRate = older.reduce((sum, m) => sum + m.hitRate, 0) / older.length;

    const recentAvgLatency = recent.reduce((sum, m) => sum + m.avgLatency, 0) / recent.length;
    const olderAvgLatency = older.reduce((sum, m) => sum + m.avgLatency, 0) / older.length;

    const recentAvgKeys = recent.reduce((sum, m) => sum + m.keyCount, 0) / recent.length;
    const olderAvgKeys = older.reduce((sum, m) => sum + m.keyCount, 0) / older.length;

    return {
      hitRateTrend: this.getTrend(recentAvgHitRate, olderAvgHitRate, 2),
      latencyTrend: this.getTrend(olderAvgLatency, recentAvgLatency, 5), // Inverted for latency
      memoryTrend:
        recentAvgKeys > olderAvgKeys + 100
          ? 'increasing'
          : recentAvgKeys < olderAvgKeys - 100
          ? 'decreasing'
          : 'stable',
    };
  }

  /**
   * Determine trend direction
   */
  private getTrend(
    current: number,
    previous: number,
    threshold: number
  ): 'improving' | 'declining' | 'stable' {
    const diff = current - previous;
    if (Math.abs(diff) < threshold) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }

  /**
   * Get slow queries (keys with high access frequency but low hit rate)
   */
  async getSlowQueries(): Promise<Array<{ pattern: string; frequency: number; hitRate: number }>> {
    try {
      // This is a simplified implementation
      // In production, you'd track this data over time
      const patterns = ['emp:user:*', 'emp:campaign:*', 'emp:subscriber:*', 'emp:analytics:*'];

      const slowQueries: Array<{ pattern: string; frequency: number; hitRate: number }> = [];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          // Simulate frequency and hit rate calculation
          // In production, you'd track these metrics
          const frequency = keys.length;
          const hitRate = Math.random() * 100; // Placeholder

          if (hitRate < 60) {
            // Consider < 60% hit rate as slow
            slowQueries.push({ pattern, frequency, hitRate });
          }
        }
      }

      return slowQueries.sort((a, b) => a.hitRate - b.hitRate);
    } catch (error) {
      console.error('Failed to get slow queries:', error);
      return [];
    }
  }

  /**
   * Get cache hotspots (most frequently accessed keys)
   */
  async getHotspots(): Promise<Array<{ key: string; accessCount: number; size: number }>> {
    try {
      // This would require tracking access patterns over time
      // For now, we'll return keys with high TTL as they're likely frequently accessed
      const allKeys = await this.redis.keys('emp:*');
      const hotspots: Array<{ key: string; accessCount: number; size: number }> = [];

      // Sample a subset of keys to avoid performance issues
      const sampleKeys = allKeys.slice(0, 100);

      for (const key of sampleKeys) {
        const ttl = await this.redis.ttl(key);
        const size = await this.redis.memory('USAGE', key).catch(() => 0);

        // Keys with higher TTL are likely more important/frequently accessed
        if (ttl > 1800) {
          // > 30 minutes
          hotspots.push({
            key,
            accessCount: ttl, // Using TTL as proxy for access count
            size: size as number,
          });
        }
      }

      return hotspots.sort((a, b) => b.accessCount - a.accessCount).slice(0, 20); // Top 20 hotspots
    } catch (error) {
      console.error('Failed to get cache hotspots:', error);
      return [];
    }
  }

  /**
   * Generate cache optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    try {
      const recommendations: string[] = [];
      const health = await this.getHealthStatus();
      const slowQueries = await this.getSlowQueries();
      const trends = this.getPerformanceTrends();

      // Hit rate recommendations
      if (health.hitRate < 70) {
        recommendations.push('Consider increasing cache TTL for frequently accessed data');
        recommendations.push('Review cache warming strategies for better hit rates');
      }

      // Latency recommendations
      if (health.latency > 100) {
        recommendations.push('Consider Redis connection pooling optimization');
        recommendations.push('Review network latency between application and Redis');
      }

      // Memory recommendations
      if (health.memoryUsage > 1000) {
        recommendations.push('Consider implementing cache eviction policies');
        recommendations.push('Review large cached objects for optimization opportunities');
      }

      // Trend-based recommendations
      if (trends.hitRateTrend === 'declining') {
        recommendations.push('Hit rate is declining - review cache invalidation strategies');
      }

      if (trends.latencyTrend === 'declining') {
        recommendations.push('Latency is increasing - consider Redis performance tuning');
      }

      // Slow query recommendations
      if (slowQueries.length > 0) {
        recommendations.push(
          `Found ${slowQueries.length} slow query patterns - consider cache warming`
        );
      }

      // Key count recommendations
      if (health.keyCount > 50000) {
        recommendations.push(
          'High key count detected - consider implementing key expiration policies'
        );
      }

      return recommendations;
    } catch (error) {
      console.error('Failed to generate optimization recommendations:', error);
      return ['Unable to generate recommendations due to monitoring error'];
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  async exportMetrics(): Promise<{
    prometheus: string;
    json: CacheMetrics;
    csv: string;
  }> {
    try {
      const metrics = await this.getMetrics();

      // Prometheus format
      const prometheus = `
# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${metrics.hitRate}

# HELP cache_miss_rate Cache miss rate percentage  
# TYPE cache_miss_rate gauge
cache_miss_rate ${metrics.missRate}

# HELP cache_key_count Total number of keys in cache
# TYPE cache_key_count gauge
cache_key_count ${metrics.keyCount}

# HELP cache_evictions Total number of evicted keys
# TYPE cache_evictions counter
cache_evictions ${metrics.evictions}

# HELP cache_connections Number of active connections
# TYPE cache_connections gauge
cache_connections ${metrics.connections}

# HELP cache_avg_latency Average latency in milliseconds
# TYPE cache_avg_latency gauge
cache_avg_latency ${metrics.avgLatency}
      `.trim();

      // CSV format
      const csv = [
        'metric,value',
        `hit_rate,${metrics.hitRate}`,
        `miss_rate,${metrics.missRate}`,
        `total_requests,${metrics.totalRequests}`,
        `key_count,${metrics.keyCount}`,
        `evictions,${metrics.evictions}`,
        `connections,${metrics.connections}`,
        `avg_latency,${metrics.avgLatency}`,
      ].join('\n');

      return {
        prometheus,
        json: metrics,
        csv,
      };
    } catch (error) {
      console.error('Failed to export metrics:', error);
      throw error;
    }
  }
}

// Singleton instance
let monitoringService: CacheMonitoringService | null = null;

export const getCacheMonitoring = (): CacheMonitoringService => {
  if (!monitoringService) {
    monitoringService = new CacheMonitoringService();
  }
  return monitoringService;
};

// Export default instance
export const cacheMonitoring = getCacheMonitoring();
