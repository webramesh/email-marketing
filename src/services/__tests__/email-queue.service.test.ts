import { EmailQueueService } from '../email-queue.service';
import { EmailMessage } from '@/types/email-sending';

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    pause: jest.fn(),
    resume: jest.fn(),
    on: jest.fn(),
  }));
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
  }));
});

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    subscriber: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
    },
    emailEvent: {
      create: jest.fn(),
    },
    automationExecution: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    automation: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock EmailSendingService
jest.mock('../email-sending/sending.service', () => ({
  EmailSendingService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'msg-123',
      provider: 'test',
      timestamp: new Date(),
    }),
  })),
}));

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    service = new EmailQueueService();
    jest.clearAllMocks();
  });

  const mockEmailMessage: EmailMessage = {
    to: 'test@example.com',
    from: 'sender@example.com',
    subject: 'Test Email',
    html: '<p>Test content</p>',
  };

  describe('addEmailJob', () => {
    it('should add email job to queue', async () => {
      const jobData = {
        tenantId: mockTenantId,
        message: mockEmailMessage,
        campaignId: 'campaign-123',
      };

      const job = await service.addEmailJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-123');
    });

    it('should add email job with delay when sendAt is specified', async () => {
      const sendAt = new Date(Date.now() + 60000); // 1 minute from now
      const jobData = {
        tenantId: mockTenantId,
        message: mockEmailMessage,
        sendAt,
      };

      const job = await service.addEmailJob(jobData);

      expect(job).toBeDefined();
    });

    it('should add email job with custom priority', async () => {
      const jobData = {
        tenantId: mockTenantId,
        message: mockEmailMessage,
        priority: 10,
      };

      const job = await service.addEmailJob(jobData, { priority: 5 });

      expect(job).toBeDefined();
    });
  });

  describe('addCampaignJob', () => {
    it('should add campaign job to queue', async () => {
      const jobData = {
        tenantId: mockTenantId,
        campaignId: 'campaign-123',
        batchSize: 100,
        offset: 0,
      };

      const job = await service.addCampaignJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-123');
    });
  });

  describe('addAutomationJob', () => {
    it('should add automation job to queue', async () => {
      const jobData = {
        tenantId: mockTenantId,
        automationId: 'automation-123',
        subscriberId: 'subscriber-123',
        stepIndex: 0,
        executionId: 'execution-123',
      };

      const job = await service.addAutomationJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-123');
    });

    it('should add automation job with delay', async () => {
      const jobData = {
        tenantId: mockTenantId,
        automationId: 'automation-123',
        subscriberId: 'subscriber-123',
        stepIndex: 0,
        executionId: 'execution-123',
      };

      const delay = 30000; // 30 seconds
      const job = await service.addAutomationJob(jobData, delay);

      expect(job).toBeDefined();
    });
  });

  describe('addAnalyticsJob', () => {
    it('should add analytics job to queue', async () => {
      const jobData = {
        tenantId: mockTenantId,
        eventType: 'OPENED',
        eventData: {
          campaignId: 'campaign-123',
          subscriberId: 'subscriber-123',
          email: 'test@example.com',
        },
        timestamp: new Date(),
      };

      const job = await service.addAnalyticsJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBe('job-123');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats.email).toBeDefined();
      expect(stats.campaign).toBeDefined();
      expect(stats.automation).toBeDefined();
      expect(stats.analytics).toBeDefined();

      expect(stats.email).toHaveProperty('waiting');
      expect(stats.email).toHaveProperty('active');
      expect(stats.email).toHaveProperty('completed');
      expect(stats.email).toHaveProperty('failed');
      expect(stats.email).toHaveProperty('delayed');
    });
  });

  describe('queue management', () => {
    it('should pause queue', async () => {
      await service.pauseQueue('email');
      // Test would verify that the queue.pause() method was called
    });

    it('should resume queue', async () => {
      await service.resumeQueue('email');
      // Test would verify that the queue.resume() method was called
    });

    it('should handle invalid queue name', async () => {
      await service.pauseQueue('invalid');
      // Should not throw error for invalid queue name
    });
  });
});