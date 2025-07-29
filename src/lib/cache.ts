import Redis from 'ioredis';
import { getRedis } from './queue';

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: 3600, // 1 hour in seconds
  maxRetries: 3,
  retryDelay: 100,
  keyPrefix: 'emp:', // Email Marketing Platform prefix
};

// Cache key patterns for tenant isolation
export const CacheKeys = {
  // User and authentication
  user: (tenantId: string, userId: string) => `${CACHE_CONFIG.keyPrefix}user:${tenantId}:${userId}`,
  userSession: (tenantId: string, sessionId: string) => `${CACHE_CONFIG.keyPrefix}session:${tenantId}:${sessionId}`,
  userPermissions: (tenantId: string, userId: string) => `${CACHE_CONFIG.keyPrefix}permissions:${tenantId}:${userId}`,
  
  // Tenant data
  tenant: (tenantId: string) => `${CACHE_CONFIG.keyPrefix}tenant:${tenantId}`,
  tenantSettings: (tenantId: string) => `${CACHE_CONFIG.keyPrefix}tenant_settings:${tenantId}`,
  tenantQuota: (tenantId: string) => `${CACHE_CONFIG.keyPrefix}quota:${tenantId}`,
  
  // Subscribers and lists
  subscriber: (tenantId: string, subscriberId: string) => `${CACHE_CONFIG.keyPrefix}subscriber:${tenantId}:${subscriberId}`,
  subscriberCount: (tenantId: string, listId?: string) => 
    listId ? `${CACHE_CONFIG.keyPrefix}sub_count:${tenantId}:${listId}` : `${CACHE_CONFIG.keyPrefix}sub_count:${tenantId}:all`,
  list: (tenantId: string, listId: string) => `${CACHE_CONFIG.keyPrefix}list:${tenantId}:${listId}`,
  segment: (tenantId: string, segmentId: string) => `${CACHE_CONFIG.keyPrefix}segment:${tenantId}:${segmentId}`,
  segmentCount: (tenantId: string, segmentId: string) => `${CACHE_CONFIG.keyPrefix}seg_count:${tenantId}:${segmentId}`,
  
  // Campaigns
  campaign: (tenantId: string, campaignId: string) => `${CACHE_CONFIG.keyPrefix}campaign:${tenantId}:${campaignId}`,
  campaignStats: (tenantId: string, campaignId: string) => `${CACHE_CONFIG.keyPrefix}campaign_stats:${tenantId}:${campaignId}`,
  campaignTemplate: (tenantId: string, templateId: string) => `${CACHE_CONFIG.keyPrefix}template:${tenantId}:${templateId}`,
  
  // Analytics
  analytics: (tenantId: string, type: string, period: string) => `${CACHE_CONFIG.keyPrefix}analytics:${tenantId}:${type}:${period}`,
  dashboardStats: (tenantId: string) => `${CACHE_CONFIG.keyPrefix}dashboard:${tenantId}`,
  
  // Email verification
  emailVerification: (tenantId: string, email: string) => `${CACHE_CONFIG.keyPrefix}email_verify:${tenantId}:${email}`,
  
  // Rate limiting
  rateLimit: (tenantId: string, identifier: string, window: string) => `${CACHE_CONFIG.keyPrefix}rate_limit:${tenantId}:${identifier}:${window}`,
  
  // API keys
  apiKey: (tenantId: string, keyId: string) => `${CACHE_CONFIG.keyPrefix}api_key:${tenantId}:${keyId}`,
  
  // Sending servers and domains
  sendingServer: (tenantId: string, serverId: string) => `${CACHE_CONFIG.keyPrefix}sending_server:${tenantId}:${serverId}`,
  domain: (tenantId: string, domainId: string) => `${CACHE_CONFIG.keyPrefix}domain:${tenantId}:${domainId}`,
  
  // Automation workflows
  workflow: (tenantId: string, workflowId: string) => `${CACHE_CONFIG.keyPrefix}workflow:${tenantId}:${workflowId}`,
  workflowExecution: (tenantId: string, executionId: string) => `${CACHE_CONFIG.keyPrefix}workflow_exec:${tenantId}:${executionId}`,
};

// Cache TTL configurations for different data types
export const CacheTTL = {
  // Short-lived data (5 minutes)
  SHORT: 300,
  
  // Medium-lived data (1 hour)
  MEDIUM: 3600,
  
  // Long-lived data (24 hours)
  LONG: 86400,
  
  // Very long-lived data (7 days)
  VERY_LONG: 604800,
  
  // Specific TTLs
  USER_SESSION: 3600, // 1 hour
  USER_PERMISSIONS: 1800, // 30 minutes
  TENANT_SETTINGS: 3600, // 1 hour
  SUBSCRIBER_COUNT: 300, // 5 minutes
  CAMPAIGN_STATS: 300, // 5 minutes
  ANALYTICS: 1800, // 30 minutes
  EMAIL_VERIFICATION: 86400, // 24 hours
  RATE_LIMIT: 3600, // 1 hour
  API_KEY: 3600, // 1 hour
  DOMAIN_VERIFICATION: 300, // 5 minutes
};

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  tags?: string[];
}

export class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = getRedis();
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const ttl = options.ttl !== undefined ? options.ttl : CACHE_CONFIG.defaultTTL;
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      
      // Add tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addTags(key, options.tags);
      }
      
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async delMany(keys: string[]): Promise<number> {
    try {
      if (keys.length === 0) return 0;
      return await this.redis.del(...keys);
    } catch (error) {
      console.error(`Cache delete many error:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      const fresh = await fetcher();
      
      // Cache the result
      await this.set(key, fresh, options);
      
      return fresh;
    } catch (error) {
      console.error(`Cache getOrSet error for key ${key}:`, error);
      // If cache fails, still return the fetched data
      return await fetcher();
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      if (amount === 1) {
        return await this.redis.incr(key);
      } else {
        return await this.redis.incrby(key, amount);
      }
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value in cache
   */
  async decr(key: string, amount: number = 1): Promise<number> {
    try {
      if (amount === 1) {
        return await this.redis.decr(key);
      } else {
        return await this.redis.decrby(key, amount);
      }
    } catch (error) {
      console.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      
      const values = await this.redis.mget(...keys);
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error(`Cache mget error:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs at once
   */
  async mset(pairs: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, value, ttl } of pairs) {
        const serializedValue = JSON.stringify(value);
        if (ttl && ttl > 0) {
          pipeline.setex(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error(`Cache mset error:`, error);
      return false;
    }
  }

  /**
   * Find keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.delMany(keys);
    } catch (error) {
      console.error(`Cache invalidate pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate all cache for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    const pattern = `${CACHE_CONFIG.keyPrefix}*:${tenantId}:*`;
    return await this.invalidatePattern(pattern);
  }

  /**
   * Add tags to a cache key for grouped invalidation
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const tagKey = `${CACHE_CONFIG.keyPrefix}tag:${tag}`;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, CacheTTL.VERY_LONG);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error(`Cache add tags error:`, error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      
      for (const tag of tags) {
        const tagKey = `${CACHE_CONFIG.keyPrefix}tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          totalDeleted += await this.delMany(keys);
        }
        
        // Remove the tag set itself
        await this.del(tagKey);
      }
      
      return totalDeleted;
    } catch (error) {
      console.error(`Cache invalidate by tags error:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: string;
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');
      
      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      // Parse key count
      const keyMatch = keyspace.match(/keys=(\d+)/);
      const keys = keyMatch ? parseInt(keyMatch[1]) : 0;
      
      // Parse hit/miss stats
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;
      
      return {
        memory,
        keys,
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        memory: 'Unknown',
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(tenantId: string): Promise<void> {
    try {
      // This would typically be called during application startup
      // or when a tenant becomes active
      console.log(`Warming up cache for tenant: ${tenantId}`);
      
      // Implementation would depend on specific use cases
      // For example, pre-load tenant settings, user permissions, etc.
    } catch (error) {
      console.error(`Cache warm up error for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();
    
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      console.error('Cache health check failed:', error);
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
      };
    }
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export const getCache = (): CacheService => {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
};

// Export default instance
export const cache = getCache();