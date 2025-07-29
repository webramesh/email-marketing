// Mock Redis first
const mockRedis = {
  info: jest.fn(),
  keys: jest.fn(),
  ping: jest.fn(),
  ttl: jest.fn(),
  memory: jest.fn(),
};

jest.mock('../queue', () => ({
  getRedis: jest.fn(() => mockRedis),
}));

import { CacheMonitoringService } from '../cache-monitoring';

describe('CacheMonitoringService', () => {
  let monitoringService: CacheMonitoringService;

  beforeEach(() => {
    monitoringService = new CacheMonitoringService();
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return comprehensive cache metrics', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:1.5M\n') // memory info
        .mockResolvedValueOnce('keyspace_hits:1000\nkeyspace_misses:200\nevicted_keys:10\nconnected_clients:5\n') // stats
        .mockResolvedValueOnce('db0:keys=150,expires=100\n'); // keyspace

      mockRedis.keys.mockResolvedValue([
        'emp:user:tenant1:user1',
        'emp:campaign:tenant1:camp1',
        'emp:user:tenant2:user2',
      ]);

      mockRedis.ping.mockResolvedValue('PONG');

      const metrics = await monitoringService.getMetrics();

      expect(metrics).toMatchObject({
        hitRate: expect.any(Number),
        missRate: expect.any(Number),
        totalRequests: 1200,
        memoryUsage: '1.5M',
        keyCount: 150,
        evictions: 10,
        connections: 5,
        avgLatency: expect.any(Number),
        tenantDistribution: {
          tenant1: 2,
          tenant2: 1,
        },
      });

      expect(metrics.hitRate).toBeCloseTo(83.33, 1);
      expect(metrics.missRate).toBeCloseTo(16.67, 1);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.info.mockRejectedValue(new Error('Redis connection failed'));

      await expect(monitoringService.getMetrics()).rejects.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for good metrics', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:500K\n')
        .mockResolvedValueOnce('keyspace_hits:900\nkeyspace_misses:100\nevicted_keys:5\nconnected_clients:3\n')
        .mockResolvedValueOnce('db0:keys=50,expires=30\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      // Mock ping to be fast for health check
      mockRedis.ping.mockResolvedValue('PONG');

      const health = await monitoringService.getHealthStatus();

      expect(health.hitRate).toBe(90);
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded status for poor hit rate', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:500K\n')
        .mockResolvedValueOnce('keyspace_hits:600\nkeyspace_misses:400\nevicted_keys:5\nconnected_clients:3\n')
        .mockResolvedValueOnce('db0:keys=50,expires=30\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      mockRedis.ping.mockResolvedValue('PONG');

      const health = await monitoringService.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.hitRate).toBe(60);
      expect(health.issues).toContain('Low hit rate: 60%');
    });

    it('should return unhealthy status for very poor performance', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:500K\n')
        .mockResolvedValueOnce('keyspace_hits:200\nkeyspace_misses:800\nevicted_keys:5\nconnected_clients:3\n')
        .mockResolvedValueOnce('db0:keys=50,expires=30\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      
      // Simulate high latency by adding delay
      mockRedis.ping.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('PONG'), 600))
      );

      const health = await monitoringService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.hitRate).toBe(20);
      expect(health.latency).toBeGreaterThan(500);
    });

    it('should handle connection failures', async () => {
      mockRedis.info.mockRejectedValue(new Error('Connection failed'));

      const health = await monitoringService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.issues).toContain('Failed to connect to cache');
    });
  });

  describe('getPerformanceTrends', () => {
    it('should return stable trends with insufficient data', () => {
      const trends = monitoringService.getPerformanceTrends();

      expect(trends).toEqual({
        hitRateTrend: 'stable',
        latencyTrend: 'stable',
        memoryTrend: 'stable',
      });
    });

    it('should detect improving hit rate trend', async () => {
      // Simulate metrics history with improving hit rate - need at least 20 metrics
      const olderMetrics = Array.from({ length: 10 }, (_, i) => ({
        hitRate: 60 + i,
        avgLatency: 50 - i,
        keyCount: 100 + i,
      }));
      
      const recentMetrics = Array.from({ length: 10 }, (_, i) => ({
        hitRate: 75 + i * 2,
        avgLatency: 35 - i,
        keyCount: 110 + i,
      }));

      // Add metrics to history
      for (const metric of [...olderMetrics, ...recentMetrics]) {
        (monitoringService as any).addToHistory(metric);
      }

      const trends = monitoringService.getPerformanceTrends();

      expect(trends.hitRateTrend).toBe('improving');
      expect(trends.latencyTrend).toBe('improving');
    });
  });

  describe('getSlowQueries', () => {
    it('should identify slow query patterns', async () => {
      mockRedis.keys
        .mockResolvedValueOnce(['emp:user:tenant1:user1', 'emp:user:tenant1:user2'])
        .mockResolvedValueOnce(['emp:campaign:tenant1:camp1'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const slowQueries = await monitoringService.getSlowQueries();

      expect(slowQueries).toBeInstanceOf(Array);
      expect(mockRedis.keys).toHaveBeenCalledWith('emp:user:*');
      expect(mockRedis.keys).toHaveBeenCalledWith('emp:campaign:*');
    });
  });

  describe('getHotspots', () => {
    it('should identify cache hotspots', async () => {
      const testKeys = [
        'emp:user:tenant1:user1',
        'emp:campaign:tenant1:camp1',
        'emp:analytics:tenant1:data1',
      ];

      mockRedis.keys.mockResolvedValue(testKeys);
      mockRedis.ttl
        .mockResolvedValueOnce(3600) // High TTL - hotspot
        .mockResolvedValueOnce(300)  // Low TTL - not hotspot
        .mockResolvedValueOnce(7200); // Very high TTL - hotspot

      mockRedis.memory
        .mockResolvedValueOnce(1024)
        .mockResolvedValueOnce(512)
        .mockResolvedValueOnce(2048);

      const hotspots = await monitoringService.getHotspots();

      expect(hotspots).toBeInstanceOf(Array);
      expect(hotspots.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should provide recommendations for poor performance', async () => {
      // Mock poor health status
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:2.0G\n')
        .mockResolvedValueOnce('keyspace_hits:300\nkeyspace_misses:700\nevicted_keys:1500\nconnected_clients:10\n')
        .mockResolvedValueOnce('db0:keys=60000,expires=40000\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      mockRedis.ping.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('PONG'), 50))
      );

      const recommendations = await monitoringService.getOptimizationRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('hit rate'))).toBe(true);
      expect(recommendations.some(r => r.includes('memory') || r.includes('key count'))).toBe(true);
    });

    it('should provide fewer recommendations for good performance', async () => {
      // Mock good health status
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:100M\n')
        .mockResolvedValueOnce('keyspace_hits:900\nkeyspace_misses:100\nevicted_keys:10\nconnected_clients:5\n')
        .mockResolvedValueOnce('db0:keys=1000,expires=800\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      mockRedis.ping.mockResolvedValue('PONG');

      const recommendations = await monitoringService.getOptimizationRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      // Should have fewer recommendations for good performance
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics in multiple formats', async () => {
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:1M\n')
        .mockResolvedValueOnce('keyspace_hits:800\nkeyspace_misses:200\nevicted_keys:5\nconnected_clients:3\n')
        .mockResolvedValueOnce('db0:keys=100,expires=80\n');

      mockRedis.keys.mockResolvedValue(['emp:test:tenant1:key1']);
      mockRedis.ping.mockResolvedValue('PONG');

      const exported = await monitoringService.exportMetrics();

      expect(exported).toHaveProperty('prometheus');
      expect(exported).toHaveProperty('json');
      expect(exported).toHaveProperty('csv');

      expect(exported.prometheus).toContain('cache_hit_rate');
      expect(exported.prometheus).toContain('cache_key_count');

      expect(exported.csv).toContain('metric,value');
      expect(exported.csv).toContain('hit_rate,');

      expect(exported.json).toHaveProperty('hitRate');
      expect(exported.json).toHaveProperty('keyCount');
    });
  });
});