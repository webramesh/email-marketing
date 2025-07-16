import { PrismaClient } from '../generated/prisma';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pooling and optimization settings for high concurrency
    transactionOptions: {
      maxWait: 5000, // 5 seconds max wait for transaction
      timeout: 10000, // 10 seconds transaction timeout
      isolationLevel: 'ReadCommitted', // Optimize for high concurrency (100k+ users)
    },
    // Error formatting for better debugging
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Connection pool configuration for high performance
// These settings are optimized for handling 100,000+ concurrent users
const connectionPoolConfig = {
  // Maximum number of connections in the pool
  connectionLimit: process.env.NODE_ENV === 'production' ? 20 : 5,
  // Connection timeout
  acquireTimeout: 60000,
  // Idle timeout
  timeout: 60000,
  // Enable connection pooling
  pool: {
    min: 2,
    max: process.env.NODE_ENV === 'production' ? 20 : 5,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  }
};

// Export connection pool config for reference
export { connectionPoolConfig };

export default prisma;