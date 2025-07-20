import Bull from 'bull';
import Redis from 'ioredis';

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

// Create Redis connection
export const redis = new Redis(redisConfig);

// Email queue for processing email sending jobs
export const emailQueue = new Bull('email processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Campaign queue for processing campaign sending
export const campaignQueue = new Bull('campaign processing', {
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

// Automation queue for processing workflow executions
export const automationQueue = new Bull('automation processing', {
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

// Analytics queue for processing tracking events
export const analyticsQueue = new Bull('analytics processing', {
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

// Error handling
emailQueue.on('error', (error) => {
  console.error('Email queue error:', error);
});

campaignQueue.on('error', (error) => {
  console.error('Campaign queue error:', error);
});

automationQueue.on('error', (error) => {
  console.error('Automation queue error:', error);
});

analyticsQueue.on('error', (error) => {
  console.error('Analytics queue error:', error);
});

// Job completion logging
emailQueue.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed:`, err);
});

campaignQueue.on('completed', (job) => {
  console.log(`Campaign job ${job.id} completed`);
});

campaignQueue.on('failed', (job, err) => {
  console.error(`Campaign job ${job.id} failed:`, err);
});