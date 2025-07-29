import { PrismaClient, Prisma } from '../generated/prisma';
import { getDatabasePerformance } from './database/performance';

// Connection pool configuration for high performance
// These settings are optimized for handling 100,000+ concurrent users
const connectionPoolConfig = {
  // Maximum number of connections in the pool
  connectionLimit: parseInt(
    process.env.DATABASE_CONNECTION_LIMIT || (process.env.NODE_ENV === 'production' ? '20' : '5')
  ),

  // Connection timeout in milliseconds
  connectTimeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '60000'),

  // Pool timeout in milliseconds
  poolTimeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '60000'),

  // Idle timeout in milliseconds
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000'),
};

// Prisma client configuration with optimizations
const prismaConfig: Prisma.PrismaClientOptions = {
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { level: 'query', emit: 'stdout' },
          { level: 'info', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
          { level: 'error', emit: 'stdout' },
        ]
      : [{ level: 'error', emit: 'stdout' }],

  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },

  // Transaction optimization settings for high concurrency
  transactionOptions: {
    maxWait: 5000, // 5 seconds max wait for transaction
    timeout: 10000, // 10 seconds transaction timeout
    isolationLevel: 'ReadCommitted' as const, // Optimize for high concurrency (100k+ users)
  },

  // Error formatting for better debugging
  errorFormat: 'pretty' as const,
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  performanceService: any;
};

// Create optimized Prisma client
export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaConfig);

// Initialize performance monitoring
export const dbPerformance = getDatabasePerformance(prisma);

// Add query performance monitoring middleware
if (!globalForPrisma.performanceService) {
  prisma.$use(async (params, next) => {
    const queryName = `${params.model}.${params.action}`;

    return await dbPerformance.executeWithMetrics(queryName, () => next(params));
  });

  globalForPrisma.performanceService = true;
}

// Connection pool monitoring
export const getConnectionPoolMetrics = async () => {
  try {
    return await dbPerformance.getConnectionPoolStatus();
  } catch (error) {
    console.error('Failed to get connection pool metrics:', error);
    return null;
  }
};

// Query optimization helpers
export const optimizedQueries = {
  /**
   * Get paginated results with performance optimization
   */
  async findManyPaginated<T>(
    model: any,
    params: {
      where?: any;
      select?: any;
      include?: any;
      orderBy?: any;
      page?: number;
      limit?: number;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    const queryName = `${model.name}.findManyPaginated`;

    return await dbPerformance.executeWithMetrics(
      queryName,
      async () => {
        const [data, total] = await Promise.all([
          model.findMany({
            where: params.where,
            select: params.select,
            include: params.include,
            orderBy: params.orderBy,
            skip,
            take: limit,
          }),
          model.count({ where: params.where }),
        ]);

        return {
          data,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      },
      params.cacheKey,
      params.cacheTTL
    );
  },

  /**
   * Get count with caching
   */
  async count(
    model: any,
    where: any,
    cacheKey?: string,
    cacheTTL: number = 300 // 5 minutes default
  ): Promise<number> {
    const queryName = `${model.name}.count`;

    return await dbPerformance.executeWithMetrics(
      queryName,
      () => model.count({ where }),
      cacheKey,
      cacheTTL
    );
  },

  /**
   * Get aggregations with caching
   */
  async aggregate(
    model: any,
    params: {
      where?: any;
      _count?: any;
      _sum?: any;
      _avg?: any;
      _min?: any;
      _max?: any;
    },
    cacheKey?: string,
    cacheTTL: number = 600 // 10 minutes default
  ): Promise<any> {
    const queryName = `${model.name}.aggregate`;

    return await dbPerformance.executeWithMetrics(
      queryName,
      () => model.aggregate(params),
      cacheKey,
      cacheTTL
    );
  },

  /**
   * Bulk operations with batching
   */
  async createMany<T>(model: any, data: T[], batchSize: number = 1000): Promise<{ count: number }> {
    const queryName = `${model.name}.createMany`;

    return await dbPerformance.executeWithMetrics(queryName, async () => {
      let totalCount = 0;

      // Process in batches to avoid memory issues
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const result = await model.createMany({
          data: batch,
          skipDuplicates: true,
        });
        totalCount += result.count;
      }

      return { count: totalCount };
    });
  },

  /**
   * Bulk update with batching
   */
  async updateMany(
    model: any,
    updates: Array<{ where: any; data: any }>,
    batchSize: number = 100
  ): Promise<{ count: number }> {
    const queryName = `${model.name}.updateMany`;

    return await dbPerformance.executeWithMetrics(queryName, async () => {
      let totalCount = 0;

      // Process updates in batches
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(update =>
            model.updateMany({
              where: update.where,
              data: update.data,
            })
          )
        );

        totalCount += results.reduce((sum, result) => sum + result.count, 0);
      }

      return { count: totalCount };
    });
  },
};

// Database health check
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  connectionPool: any;
  issues: string[];
}> => {
  const start = Date.now();
  const issues: string[] = [];
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    // Check connection pool
    const connectionPool = await getConnectionPoolMetrics();

    // Evaluate health
    if (latency > 1000) {
      issues.push(`High database latency: ${latency}ms`);
      status = 'degraded';
    }

    if (latency > 5000) {
      status = 'unhealthy';
    }

    if (connectionPool && connectionPool.poolUtilization > 80) {
      issues.push(`High connection pool utilization: ${connectionPool.poolUtilization}%`);
      if (status === 'healthy') status = 'degraded';
    }

    if (connectionPool && connectionPool.waitingConnections > 5) {
      issues.push(`High number of waiting connections: ${connectionPool.waitingConnections}`);
      if (status === 'healthy') status = 'degraded';
    }

    return {
      status,
      latency,
      connectionPool,
      issues,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      connectionPool: null,
      issues: [`Database connection failed: ${error}`],
    };
  }
};

// Graceful shutdown
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('Database connections closed gracefully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
};

// Export connection pool config for reference
export { connectionPoolConfig };

// Development only - don't cache in production
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
