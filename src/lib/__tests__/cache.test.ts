// Mock Redis first
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  incr: jest.fn(),
  incrby: jest.fn(),
  decr: jest.fn(),
  decrby: jest.fn(),
  mget: jest.fn(),
  keys: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  info: jest.fn(),
  ping: jest.fn(),
  memory: jest.fn(),
  pipeline: jest.fn(() => ({
    set: jest.fn(),
    setex: jest.fn(),
    sadd: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  })),
};

jest.mock('../queue', () => ({
  getRedis: jest.fn(() => mockRedis),
}));

import { CacheService, CacheKeys, CacheTTL } from '../cache';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value from cache', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null if key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', testData, { ttl: 3600 });

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify(testData));
      expect(result).toBe(true);
    });

    it('should set value without TTL', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', testData, { ttl: 0 });

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle tags', async () => {
      const testData = { id: '1', name: 'test' };
      const mockPipeline = {
        set: jest.fn(),
        setex: jest.fn(),
        sadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('test-key', testData, {
        ttl: 3600,
        tags: ['tag1', 'tag2'],
      });

      expect(mockPipeline.sadd).toHaveBeenCalledWith('emp:tag:tag1', 'test-key');
      expect(mockPipeline.sadd).toHaveBeenCalledWith('emp:tag:tag2', 'test-key');
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.del('error-key');

      expect(result).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: '1', name: 'cached' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const fetcher = jest.fn().mockResolvedValue({ id: '1', name: 'fresh' });
      const result = await cacheService.getOrSet('test-key', fetcher);

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it('should fetch and cache if not exists', async () => {
      const freshData = { id: '1', name: 'fresh' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const fetcher = jest.fn().mockResolvedValue(freshData);
      const result = await cacheService.getOrSet('test-key', fetcher, { ttl: 3600 });

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(fetcher).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify(freshData));
      expect(result).toEqual(freshData);
    });
  });

  describe('incr', () => {
    it('should increment by 1', async () => {
      mockRedis.incr.mockResolvedValue(2);

      const result = await cacheService.incr('counter-key');

      expect(mockRedis.incr).toHaveBeenCalledWith('counter-key');
      expect(result).toBe(2);
    });

    it('should increment by custom amount', async () => {
      mockRedis.incrby.mockResolvedValue(15);

      const result = await cacheService.incr('counter-key', 10);

      expect(mockRedis.incrby).toHaveBeenCalledWith('counter-key', 10);
      expect(result).toBe(15);
    });
  });

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      const matchingKeys = ['key1', 'key2', 'key3'];
      mockRedis.keys.mockResolvedValue(matchingKeys);
      mockRedis.del.mockResolvedValue(3);

      const result = await cacheService.invalidatePattern('test:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
      expect(result).toBe(3);
    });

    it('should return 0 if no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cacheService.invalidatePattern('test:*');

      expect(result).toBe(0);
    });
  });

  describe('invalidateTenant', () => {
    it('should invalidate all tenant keys', async () => {
      const tenantKeys = ['emp:user:tenant1:user1', 'emp:campaign:tenant1:camp1'];
      mockRedis.keys.mockResolvedValue(tenantKeys);
      mockRedis.del.mockResolvedValue(2);

      const result = await cacheService.invalidateTenant('tenant1');

      expect(mockRedis.keys).toHaveBeenCalledWith('emp:*:tenant1:*');
      expect(result).toBe(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      mockRedis.ping.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('PONG'), 10))
      );

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status on error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('unhealthy');
    });
  });
});

describe('CacheKeys', () => {
  it('should generate correct user key', () => {
    const key = CacheKeys.user('tenant1', 'user1');
    expect(key).toBe('emp:user:tenant1:user1');
  });

  it('should generate correct campaign key', () => {
    const key = CacheKeys.campaign('tenant1', 'campaign1');
    expect(key).toBe('emp:campaign:tenant1:campaign1');
  });

  it('should generate correct subscriber count key', () => {
    const key = CacheKeys.subscriberCount('tenant1', 'list1');
    expect(key).toBe('emp:sub_count:tenant1:list1');
  });

  it('should generate correct subscriber count key without list', () => {
    const key = CacheKeys.subscriberCount('tenant1');
    expect(key).toBe('emp:sub_count:tenant1:all');
  });

  it('should generate correct analytics key', () => {
    const key = CacheKeys.analytics('tenant1', 'campaigns', '30d');
    expect(key).toBe('emp:analytics:tenant1:campaigns:30d');
  });
});

describe('CacheTTL', () => {
  it('should have correct TTL values', () => {
    expect(CacheTTL.SHORT).toBe(300);
    expect(CacheTTL.MEDIUM).toBe(3600);
    expect(CacheTTL.LONG).toBe(86400);
    expect(CacheTTL.VERY_LONG).toBe(604800);
    expect(CacheTTL.USER_SESSION).toBe(3600);
    expect(CacheTTL.SUBSCRIBER_COUNT).toBe(300);
  });
});
