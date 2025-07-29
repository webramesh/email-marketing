import { PrismaClient } from '@/generated/prisma';
import { cache } from '../cache';

/**
 * Database performance optimization utilities
 */
export class DatabasePerformanceService {
  private prisma: PrismaClient;
  private queryMetrics: Map<string, QueryMetric[]> = new Map();
  private readonly maxMetricsHistory = 1000;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Execute query with performance monitoring
   */
  async executeWithMetrics<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Try cache first if cache key provided
      if (cacheKey) {
        const cached = await cache.get<T>(cacheKey);
        if (cached !== null) {
          this.recordMetric(queryName, Date.now() - startTime, true, 'cache_hit');
          return cached;
        }
      }

      // Execute query
      const result = await queryFn();
      const executionTime = Date.now() - startTime;

      // Cache result if cache key provided
      if (cacheKey && cacheTTL) {
        await cache.set(cacheKey, result, { ttl: cacheTTL });
      }

      this.recordMetric(queryName, executionTime, true, 'success');
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordMetric(queryName, executionTime, false, 'error');
      throw error;
    }
  }

  /**
   * Record query performance metric
   */
  private recordMetric(
    queryName: string,
    executionTime: number,
    success: boolean,
    status: string
  ): void {
    const metric: QueryMetric = {
      queryName,
      executionTime,
      success,
      status,
      timestamp: new Date(),
    };

    if (!this.queryMetrics.has(queryName)) {
      this.queryMetrics.set(queryName, []);
    }

    const metrics = this.queryMetrics.get(queryName)!;
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > this.maxMetricsHistory) {
      metrics.shift();
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(queryName?: string): QueryStats[] {
    const stats: QueryStats[] = [];

    const queries = queryName 
      ? [queryName].filter(name => this.queryMetrics.has(name))
      : Array.from(this.queryMetrics.keys());

    for (const name of queries) {
      const metrics = this.queryMetrics.get(name) || [];
      if (metrics.length === 0) continue;

      const executionTimes = metrics.map(m => m.executionTime);
      const successCount = metrics.filter(m => m.success).length;
      const cacheHits = metrics.filter(m => m.status === 'cache_hit').length;

      stats.push({
        queryName: name,
        totalExecutions: metrics.length,
        successRate: (successCount / metrics.length) * 100,
        cacheHitRate: (cacheHits / metrics.length) * 100,
        avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
        minExecutionTime: Math.min(...executionTimes),
        maxExecutionTime: Math.max(...executionTimes),
        p95ExecutionTime: this.calculatePercentile(executionTimes, 95),
        p99ExecutionTime: this.calculatePercentile(executionTimes, 99),
        lastExecuted: metrics[metrics.length - 1].timestamp,
      });
    }

    return stats.sort((a, b) => b.avgExecutionTime - a.avgExecutionTime);
  }

  /**
   * Calculate percentile for execution times
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get slow queries (queries with high execution time)
   */
  getSlowQueries(thresholdMs: number = 1000): SlowQuery[] {
    const slowQueries: SlowQuery[] = [];

    for (const [queryName, metrics] of this.queryMetrics.entries()) {
      const slowExecutions = metrics.filter(m => m.executionTime > thresholdMs);
      if (slowExecutions.length === 0) continue;

      const avgSlowTime = slowExecutions.reduce((sum, m) => sum + m.executionTime, 0) / slowExecutions.length;
      const maxSlowTime = Math.max(...slowExecutions.map(m => m.executionTime));

      slowQueries.push({
        queryName,
        slowExecutions: slowExecutions.length,
        totalExecutions: metrics.length,
        slowPercentage: (slowExecutions.length / metrics.length) * 100,
        avgSlowTime,
        maxSlowTime,
        recentSlowQueries: slowExecutions.slice(-5).map(m => ({
          executionTime: m.executionTime,
          timestamp: m.timestamp,
          status: m.status,
        })),
      });
    }

    return slowQueries.sort((a, b) => b.slowPercentage - a.slowPercentage);
  }

  /**
   * Clear metrics history
   */
  clearMetrics(queryName?: string): void {
    if (queryName) {
      this.queryMetrics.delete(queryName);
    } else {
      this.queryMetrics.clear();
    }
  }

  /**
   * Get database connection pool status
   */
  async getConnectionPoolStatus(): Promise<ConnectionPoolStatus> {
    try {
      // Test database connectivity with a simple query
      const startTime = Date.now();
      await (this.prisma as any).$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;
      
      // Since $metrics is not available, we'll provide estimated values
      // based on our query metrics and connection health
      const queryStats = this.getQueryStats();
      const totalQueries = queryStats.reduce((sum, stat) => sum + stat.totalExecutions, 0);
      const avgExecutionTime = queryStats.length > 0 
        ? queryStats.reduce((sum, stat) => sum + stat.avgExecutionTime, 0) / queryStats.length 
        : 0;
      
      // Estimate connection pool status based on performance
      const maxConnections = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10');
      const estimatedActiveConnections = Math.min(Math.ceil(totalQueries / 100), maxConnections);
      const poolUtilization = (estimatedActiveConnections / maxConnections) * 100;
      
      let status: 'healthy' | 'degraded' | 'error' = 'healthy';
      if (latency > 1000) status = 'degraded';
      if (latency > 5000) status = 'error';
      if (poolUtilization > 80) status = 'degraded';
      if (poolUtilization > 95) status = 'error';
      
      return {
        activeConnections: estimatedActiveConnections,
        totalConnections: totalQueries,
        waitingConnections: Math.max(0, estimatedActiveConnections - maxConnections),
        maxConnections,
        poolUtilization: Math.round(poolUtilization),
        avgWaitTime: avgExecutionTime,
        status,
      };
    } catch (error) {
      console.error('Failed to get connection pool status:', error);
      return {
        activeConnections: 0,
        totalConnections: 0,
        waitingConnections: 0,
        maxConnections: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10'),
        poolUtilization: 0,
        avgWaitTime: 0,
        status: 'error',
      };
    }
  }

  /**
   * Optimize database queries with proper indexing suggestions
   */
  async analyzeQueryPerformance(): Promise<QueryOptimizationSuggestion[]> {
    const suggestions: QueryOptimizationSuggestion[] = [];
    const slowQueries = this.getSlowQueries(500); // Queries slower than 500ms

    for (const slowQuery of slowQueries) {
      const suggestion: QueryOptimizationSuggestion = {
        queryName: slowQuery.queryName,
        issue: 'Slow execution time',
        currentPerformance: {
          avgExecutionTime: slowQuery.avgSlowTime,
          maxExecutionTime: slowQuery.maxSlowTime,
          slowPercentage: slowQuery.slowPercentage,
        },
        suggestions: [],
        priority: this.calculatePriority(slowQuery),
      };

      // Add specific suggestions based on query patterns
      if (slowQuery.queryName.includes('findMany')) {
        suggestion.suggestions.push('Consider adding pagination with take/skip');
        suggestion.suggestions.push('Add appropriate indexes for filter conditions');
        suggestion.suggestions.push('Use select to limit returned fields');
      }

      if (slowQuery.queryName.includes('count')) {
        suggestion.suggestions.push('Consider caching count results');
        suggestion.suggestions.push('Use approximate counts for large datasets');
      }

      if (slowQuery.queryName.includes('aggregate')) {
        suggestion.suggestions.push('Consider pre-computing aggregations');
        suggestion.suggestions.push('Use database views for complex aggregations');
      }

      if (slowQuery.slowPercentage > 50) {
        suggestion.suggestions.push('Consider query restructuring or caching');
      }

      suggestions.push(suggestion);
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate optimization priority
   */
  private calculatePriority(slowQuery: SlowQuery): number {
    let priority = 0;
    
    // Higher priority for frequently executed slow queries
    priority += slowQuery.totalExecutions * 0.1;
    
    // Higher priority for very slow queries
    priority += slowQuery.avgSlowTime * 0.01;
    
    // Higher priority for high percentage of slow executions
    priority += slowQuery.slowPercentage * 0.5;
    
    return Math.round(priority);
  }

  /**
   * Generate database performance report
   */
  async generatePerformanceReport(): Promise<DatabasePerformanceReport> {
    const queryStats = this.getQueryStats();
    const slowQueries = this.getSlowQueries();
    const connectionPool = await this.getConnectionPoolStatus();
    const optimizationSuggestions = await this.analyzeQueryPerformance();

    const totalQueries = queryStats.reduce((sum, stat) => sum + stat.totalExecutions, 0);
    const avgResponseTime = queryStats.length > 0 
      ? queryStats.reduce((sum, stat) => sum + stat.avgExecutionTime, 0) / queryStats.length 
      : 0;
    const overallSuccessRate = queryStats.length > 0
      ? queryStats.reduce((sum, stat) => sum + stat.successRate, 0) / queryStats.length
      : 100;

    return {
      summary: {
        totalQueries,
        avgResponseTime,
        overallSuccessRate,
        slowQueriesCount: slowQueries.length,
        cacheHitRate: queryStats.length > 0
          ? queryStats.reduce((sum, stat) => sum + stat.cacheHitRate, 0) / queryStats.length
          : 0,
      },
      queryStats: queryStats.slice(0, 20), // Top 20 queries
      slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
      connectionPool,
      optimizationSuggestions: optimizationSuggestions.slice(0, 10), // Top 10 suggestions
      generatedAt: new Date(),
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    prometheus: string;
    json: any;
  } {
    const queryStats = this.getQueryStats();
    
    // Prometheus format
    let prometheus = '# Database Query Metrics\n';
    
    for (const stat of queryStats) {
      const queryLabel = stat.queryName.replace(/[^a-zA-Z0-9_]/g, '_');
      prometheus += `# HELP db_query_duration_ms Query execution time in milliseconds\n`;
      prometheus += `# TYPE db_query_duration_ms histogram\n`;
      prometheus += `db_query_avg_duration_ms{query="${queryLabel}"} ${stat.avgExecutionTime}\n`;
      prometheus += `db_query_p95_duration_ms{query="${queryLabel}"} ${stat.p95ExecutionTime}\n`;
      prometheus += `db_query_p99_duration_ms{query="${queryLabel}"} ${stat.p99ExecutionTime}\n`;
      prometheus += `db_query_total_executions{query="${queryLabel}"} ${stat.totalExecutions}\n`;
      prometheus += `db_query_success_rate{query="${queryLabel}"} ${stat.successRate}\n`;
      prometheus += `db_query_cache_hit_rate{query="${queryLabel}"} ${stat.cacheHitRate}\n`;
    }

    // JSON format
    const json = {
      queryStats,
      slowQueries: this.getSlowQueries(),
      timestamp: new Date().toISOString(),
    };

    return { prometheus, json };
  }
}

// Types
interface QueryMetric {
  queryName: string;
  executionTime: number;
  success: boolean;
  status: string;
  timestamp: Date;
}

interface QueryStats {
  queryName: string;
  totalExecutions: number;
  successRate: number;
  cacheHitRate: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  lastExecuted: Date;
}

interface SlowQuery {
  queryName: string;
  slowExecutions: number;
  totalExecutions: number;
  slowPercentage: number;
  avgSlowTime: number;
  maxSlowTime: number;
  recentSlowQueries: Array<{
    executionTime: number;
    timestamp: Date;
    status: string;
  }>;
}

interface ConnectionPoolStatus {
  activeConnections: number;
  totalConnections: number;
  waitingConnections: number;
  maxConnections: number;
  poolUtilization: number;
  avgWaitTime: number;
  status: 'healthy' | 'degraded' | 'error';
}

interface QueryOptimizationSuggestion {
  queryName: string;
  issue: string;
  currentPerformance: {
    avgExecutionTime: number;
    maxExecutionTime: number;
    slowPercentage: number;
  };
  suggestions: string[];
  priority: number;
}

interface DatabasePerformanceReport {
  summary: {
    totalQueries: number;
    avgResponseTime: number;
    overallSuccessRate: number;
    slowQueriesCount: number;
    cacheHitRate: number;
  };
  queryStats: QueryStats[];
  slowQueries: SlowQuery[];
  connectionPool: ConnectionPoolStatus;
  optimizationSuggestions: QueryOptimizationSuggestion[];
  generatedAt: Date;
}

// Singleton instance
let performanceService: DatabasePerformanceService | null = null;

export const getDatabasePerformance = (prisma: PrismaClient): DatabasePerformanceService => {
  if (!performanceService) {
    performanceService = new DatabasePerformanceService(prisma);
  }
  return performanceService;
};