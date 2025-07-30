// Ensure this module only runs on the server
if (typeof window !== 'undefined') {
  throw new Error('Queue module should only be imported on the server side');
}

import Bull from 'bull';
import Redis from 'ioredis';

// Check if we're in a build environment
const isBuildTime =
  process.env.NODE_ENV === 'test' ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.argv.includes('build');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

// Lazy Redis connection - only create when needed and not during build
let _redis: Redis | null = null;
export const getRedis = () => {
  if (isBuildTime) {
    throw new Error('Redis not available during build time');
  }
  if (!_redis) {
    _redis = new Redis(redisConfig);
  }
  return _redis;
};

// For backward compatibility - return mock during build time
export const redis = isBuildTime
  ? ({} as Redis)
  : new Proxy({} as Redis, {
      get(target, prop) {
        return getRedis()[prop as keyof Redis];
      },
    });

// Lazy queue initialization - only create when needed and not during build
let _emailQueue: Bull.Queue | null = null;
let _campaignQueue: Bull.Queue | null = null;
let _automationQueue: Bull.Queue | null = null;
let _analyticsQueue: Bull.Queue | null = null;

const createQueueIfNeeded = () => {
  if (isBuildTime) {
    throw new Error('Queues not available during build time');
  }
};

export const getEmailQueue = () => {
  createQueueIfNeeded();
  if (!_emailQueue) {
    _emailQueue = new Bull('email processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    _emailQueue.on('error', error => {
      console.error('Email queue error:', error);
    });

    _emailQueue.on('completed', job => {
      console.log(`Email job ${job.id} completed`);
    });

    _emailQueue.on('failed', (job, err) => {
      console.error(`Email job ${job.id} failed:`, err);
    });
  }
  return _emailQueue;
};

export const getCampaignQueue = () => {
  createQueueIfNeeded();
  if (!_campaignQueue) {
    _campaignQueue = new Bull('campaign processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    _campaignQueue.on('error', error => {
      console.error('Campaign queue error:', error);
    });

    _campaignQueue.on('completed', job => {
      console.log(`Campaign job ${job.id} completed`);
    });

    _campaignQueue.on('failed', (job, err) => {
      console.error(`Campaign job ${job.id} failed:`, err);
    });
  }
  return _campaignQueue;
};

export const getAutomationQueue = () => {
  createQueueIfNeeded();
  if (!_automationQueue) {
    _automationQueue = new Bull('automation processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    _automationQueue.on('error', error => {
      console.error('Automation queue error:', error);
    });
  }
  return _automationQueue;
};

export const getAnalyticsQueue = () => {
  createQueueIfNeeded();
  if (!_analyticsQueue) {
    _analyticsQueue = new Bull('analytics processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 500,
        },
      },
    });

    _analyticsQueue.on('error', error => {
      console.error('Analytics queue error:', error);
    });
  }
  return _analyticsQueue;
};

// Backward compatibility exports - return mocks during build time
export const emailQueue = isBuildTime
  ? ({} as Bull.Queue)
  : new Proxy({} as Bull.Queue, {
      get(target, prop) {
        return getEmailQueue()[prop as keyof Bull.Queue];
      },
    });

export const campaignQueue = isBuildTime
  ? ({} as Bull.Queue)
  : new Proxy({} as Bull.Queue, {
      get(target, prop) {
        return getCampaignQueue()[prop as keyof Bull.Queue];
      },
    });

export const automationQueue = isBuildTime
  ? ({} as Bull.Queue)
  : new Proxy({} as Bull.Queue, {
      get(target, prop) {
        return getAutomationQueue()[prop as keyof Bull.Queue];
      },
    });

export const analyticsQueue = isBuildTime
  ? ({} as Bull.Queue)
  : new Proxy({} as Bull.Queue, {
      get(target, prop) {
        return getAnalyticsQueue()[prop as keyof Bull.Queue];
      },
    });

// Queue monitoring and health check
export const getQueueStats = async () => {
  const queues = [
    { name: 'email', queue: emailQueue },
    { name: 'campaign', queue: campaignQueue },
    { name: 'automation', queue: automationQueue },
    { name: 'analytics', queue: analyticsQueue },
  ];

  const stats = await Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        name,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    })
  );

  return stats;
};

// Graceful shutdown
export const closeQueues = async () => {
  await Promise.all([
    emailQueue.close(),
    campaignQueue.close(),
    automationQueue.close(),
    analyticsQueue.close(),
    redis.disconnect(),
  ]);
};

// Note: Event listeners are now attached within the individual queue getter functions
// to prevent initialization during build time
