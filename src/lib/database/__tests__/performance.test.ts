import { DatabasePerformanceService } from '../performance';
import { PrismaClient } from '@/generated/prisma';

// Mock Prisma client
const mockPrisma = {
  $metrics: {
    json: jest.fn(),
  },
} as any;

// Mock cache
jest.mock('../../cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('DatabasePerformanceService', () => {
  let performanceService: DatabasePerformanceService;

  beforeEach(() => {
    performanceService = new DatabasePerformanceService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('executeWithMetrics', () => {
    it('should execute query and record metrics', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      expect(mockQueryFn).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should use cache when available', async () => {
      const { cache } = require('../../cache');
      cache.get.mockResolvedValue({ id: 1, name: 'cached' });

      const mockQueryFn = jest.fn();

      const result = await performanceService.executeWithMetrics(
        'test.findMany',
        mockQueryFn,
        'test-cache-key'
      );

      expect(cache.get).toHaveBeenCalledWith('test-cache-key');
      expect(mockQueryFn).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'cached' });
    });

    it('should cache result when cache key provided', async () => {
      const { cache } = require('../../cache');
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      const mockQueryFn = jest.fn().mockResolvedValue({ id: 1, name: 'fresh' });

      const result = await performanceService.executeWithMetrics(
        'test.findMany',
        mockQueryFn,
        'test-cache-key',
        300
      );

      expect(cache.set).toHaveBeenCalledWith(
        'test-cache-key',
        { id: 1, name: 'fresh' },
        { ttl: 300 }
      );
      expect(result).toEqual({ id: 1, name: 'fresh' });
    });

    it('should record error metrics on failure', async () => {
      const mockQueryFn = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(
        performanceService.executeWithMetrics('test.findMany', mockQueryFn)
      ).rejects.toThrow('Query failed');

      const stats = performanceService.getQueryStats('test.findMany');
      expect(stats).toHaveLength(1);
      expect(stats[0].successRate).toBe(0);
    });
  });

  describe('getQueryStats', () => {
    it('should return empty array when no metrics recorded', () => {
      const stats = performanceService.getQueryStats();
      expect(stats).toEqual([]);
    });

    it('should return stats for specific query', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });

      // Execute query multiple times to generate metrics
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      const stats = performanceService.getQueryStats('test.findMany');

      expect(stats).toHaveLength(1);
      expect(stats[0].queryName).toBe('test.findMany');
      expect(stats[0].totalExecutions).toBe(2);
      expect(stats[0].successRate).toBe(100);
    });

    it('should calculate correct statistics', async () => {
      const mockQueryFn = jest
        .fn()
        .mockResolvedValueOnce({ data: 'test1' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ data: 'test2' });

      // Execute queries with different outcomes
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn).catch(() => {});
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      const stats = performanceService.getQueryStats('test.findMany');

      expect(stats[0].totalExecutions).toBe(3);
      expect(stats[0].successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('getSlowQueries', () => {
    it('should identify slow queries', async () => {
      // Mock a slow query
      const slowQueryFn = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: 'slow' }), 1100))
        );

      const fastQueryFn = jest.fn().mockResolvedValue({ data: 'fast' });

      await performanceService.executeWithMetrics('slow.query', slowQueryFn);
      await performanceService.executeWithMetrics('fast.query', fastQueryFn);

      const slowQueries = performanceService.getSlowQueries(1000);

      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].queryName).toBe('slow.query');
      expect(slowQueries[0].slowExecutions).toBe(1);
    });

    it('should return empty array when no slow queries', async () => {
      const fastQueryFn = jest.fn().mockResolvedValue({ data: 'fast' });

      await performanceService.executeWithMetrics('fast.query', fastQueryFn);

      const slowQueries = performanceService.getSlowQueries(1000);

      expect(slowQueries).toEqual([]);
    });
  });

  describe('getConnectionPoolStatus', () => {
    it('should return connection pool metrics', async () => {
      const mockMetrics = {
        counters: [
          { key: 'prisma_client_queries_active', value: 5 },
          { key: 'prisma_client_queries_total', value: 100 },
          { key: 'prisma_client_queries_wait', value: 2 },
        ],
        histograms: [{ key: 'prisma_client_queries_wait_histogram', value: { mean: 50 } }],
      };

      (mockPrisma.$metrics.json as jest.Mock).mockResolvedValue(mockMetrics);

      const status = await performanceService.getConnectionPoolStatus();

      expect(status.activeConnections).toBe(5);
      expect(status.totalConnections).toBe(100);
      expect(status.waitingConnections).toBe(2);
      expect(status.avgWaitTime).toBe(50);
      expect(status.status).toBe('healthy');
    });

    it('should handle errors gracefully', async () => {
      (mockPrisma.$metrics.json as jest.Mock).mockRejectedValue(new Error('Metrics failed'));

      const status = await performanceService.getConnectionPoolStatus();

      expect(status.status).toBe('error');
      expect(status.activeConnections).toBe(0);
    });
  });

  describe('analyzeQueryPerformance', () => {
    it('should provide optimization suggestions for slow queries', async () => {
      // Create slow queries
      const slowQueryFn = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: 'slow' }), 600))
        );

      await performanceService.executeWithMetrics('user.findMany', slowQueryFn);
      await performanceService.executeWithMetrics('campaign.count', slowQueryFn);

      const suggestions = await performanceService.analyzeQueryPerformance();

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('queryName');
      expect(suggestions[0]).toHaveProperty('suggestions');
      expect(suggestions[0]).toHaveProperty('priority');
    });

    it('should provide specific suggestions based on query patterns', async () => {
      const slowQueryFn = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: 'slow' }), 600))
        );

      await performanceService.executeWithMetrics('user.findMany', slowQueryFn);

      const suggestions = await performanceService.analyzeQueryPerformance();

      const userSuggestion = suggestions.find(s => s.queryName === 'user.findMany');
      expect(userSuggestion?.suggestions).toContain('Consider adding pagination with take/skip');
      expect(userSuggestion?.suggestions).toContain(
        'Add appropriate indexes for filter conditions'
      );
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });

      // Generate some metrics
      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      const mockMetrics = {
        counters: [
          { key: 'prisma_client_queries_active', value: 3 },
          { key: 'prisma_client_queries_total', value: 50 },
        ],
        histograms: [],
      };

      (mockPrisma.$metrics.json as jest.Mock).mockResolvedValue(mockMetrics);

      const report = await performanceService.generatePerformanceReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('queryStats');
      expect(report).toHaveProperty('slowQueries');
      expect(report).toHaveProperty('connectionPool');
      expect(report).toHaveProperty('optimizationSuggestions');
      expect(report).toHaveProperty('generatedAt');

      expect(report.summary.totalQueries).toBeGreaterThan(0);
      expect(report.summary.overallSuccessRate).toBe(100);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics in Prometheus and JSON formats', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });

      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      const exported = performanceService.exportMetrics();

      expect(exported).toHaveProperty('prometheus');
      expect(exported).toHaveProperty('json');

      expect(exported.prometheus).toContain('db_query_avg_duration_ms');
      expect(exported.prometheus).toContain('test_findMany');

      expect(exported.json).toHaveProperty('queryStats');
      expect(exported.json).toHaveProperty('slowQueries');
      expect(exported.json).toHaveProperty('timestamp');
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics when no query name provided', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });

      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);

      let stats = performanceService.getQueryStats();
      expect(stats.length).toBeGreaterThan(0);

      performanceService.clearMetrics();

      stats = performanceService.getQueryStats();
      expect(stats).toEqual([]);
    });

    it('should clear metrics for specific query', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });

      await performanceService.executeWithMetrics('test.findMany', mockQueryFn);
      await performanceService.executeWithMetrics('user.findMany', mockQueryFn);

      performanceService.clearMetrics('test.findMany');

      const stats = performanceService.getQueryStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].queryName).toBe('user.findMany');
    });
  });
});
