import { EmailVerificationService } from '../email-verification.service';
import { VerificationStatus } from '@/types';

// Mock Prisma client
const mockPrisma = {
  emailVerification: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  listSubscriber: {
    deleteMany: jest.fn(),
  },
  subscriber: {
    updateMany: jest.fn(),
  },
} as any;

// Mock DNS lookup
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    if (fn.name === 'lookup') {
      return jest.fn().mockImplementation((domain: string) => {
        if (domain === 'invalid-domain.com') {
          return Promise.reject(new Error('Domain not found'));
        }
        // Allow all other domains including gmail.com
        return Promise.resolve({ address: '1.2.3.4' });
      });
    }
    return fn;
  }),
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => {
    if (command.includes('valid-domain.com') || command.includes('gmail.com')) {
      callback(null, { stdout: 'mail exchanger = 10 mx.valid-domain.com' });
    } else {
      callback(new Error('No MX record'), { stdout: '' });
    }
  }),
}));

// Mock net module for SMTP validation
jest.mock('net', () => ({
  createConnection: jest.fn().mockImplementation((port, domain) => {
    const mockSocket = {
      setTimeout: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'connect' && (domain === 'valid-domain.com' || domain === 'gmail.com')) {
          setTimeout(() => callback(), 10);
        } else if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 10);
        }
      }),
    };
    return mockSocket;
  }),
}));

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    service = new EmailVerificationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('validateEmail', () => {
    it('should validate a valid email address', async () => {
      const email = 'test@valid-domain.com';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      const result = await service.validateEmail(email, tenantId, false);

      expect(result.email).toBe(email);
      expect(result.details.syntax).toBe(true);
      expect(result.status).toBe(VerificationStatus.VALID);
      expect(result.isValid).toBe(true);
      expect(mockPrisma.emailVerification.upsert).toHaveBeenCalled();
    });

    it('should reject invalid email syntax', async () => {
      const email = 'invalid-email';
      
      const result = await service.validateEmail(email, tenantId, false);

      expect(result.email).toBe(email);
      expect(result.details.syntax).toBe(false);
      expect(result.status).toBe(VerificationStatus.INVALID);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid email syntax');
    });

    it('should detect disposable email addresses', async () => {
      const email = 'test@10minutemail.com';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      const result = await service.validateEmail(email, tenantId, false);

      expect(result.details.disposable).toBe(true);
      expect(result.status).toBe(VerificationStatus.RISKY);
      expect(result.reason).toBe('Disposable email address');
    });

    it('should detect role-based email addresses', async () => {
      const email = 'admin@valid-domain.com';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      const result = await service.validateEmail(email, tenantId, false);

      expect(result.details.role).toBe(true);
    });

    it('should detect free email providers', async () => {
      const email = 'test@valid-domain.com';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      // Temporarily add gmail.com to the service's free providers for this test
      service['FREE_PROVIDERS'].add('valid-domain.com');

      const result = await service.validateEmail(email, tenantId, false);

      expect(result.details.free).toBe(true);
      
      // Clean up
      service['FREE_PROVIDERS'].delete('valid-domain.com');
    });

    it('should use cache when enabled', async () => {
      const email = 'test@valid-domain.com';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      // First call
      const result1 = await service.validateEmail(email, tenantId, true);
      
      // Second call should use cache
      const result2 = await service.validateEmail(email, tenantId, true);

      expect(result1).toEqual(result2);
      // Should only call upsert once due to caching
      expect(mockPrisma.emailVerification.upsert).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors gracefully', async () => {
      const email = 'test@error-domain.com';
      
      // Mock an error in the validation process
      mockPrisma.emailVerification.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.validateEmail(email, tenantId, false);

      expect(result.status).toBe(VerificationStatus.UNKNOWN);
      expect(result.reason).toBe('Unable to fully verify email');
    });
  });

  describe('getVerificationResult', () => {
    it('should retrieve verification result from database', async () => {
      const email = 'test@example.com';
      const mockResult = {
        id: 'test-id',
        email,
        status: VerificationStatus.VALID,
        verificationData: {},
        verifiedAt: new Date(),
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.emailVerification.findUnique.mockResolvedValue(mockResult);

      const result = await service.getVerificationResult(email, tenantId);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.emailVerification.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email,
            tenantId,
          },
        },
      });
    });

    it('should return null if verification result not found', async () => {
      const email = 'test@example.com';

      mockPrisma.emailVerification.findUnique.mockResolvedValue(null);

      const result = await service.getVerificationResult(email, tenantId);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const email = 'test@example.com';

      mockPrisma.emailVerification.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.getVerificationResult(email, tenantId);

      expect(result).toBeNull();
    });
  });

  describe('getVerificationResults', () => {
    it('should retrieve paginated verification results', async () => {
      const mockResults = [
        {
          id: 'test-id-1',
          email: 'test1@example.com',
          status: VerificationStatus.VALID,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-id-2',
          email: 'test2@example.com',
          status: VerificationStatus.INVALID,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.emailVerification.findMany.mockResolvedValue(mockResults);
      mockPrisma.emailVerification.count.mockResolvedValue(2);

      const result = await service.getVerificationResults(tenantId, 1, 50);

      expect(result.data).toEqual(mockResults);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('should filter by status when provided', async () => {
      const status = VerificationStatus.VALID;
      
      mockPrisma.emailVerification.findMany.mockResolvedValue([]);
      mockPrisma.emailVerification.count.mockResolvedValue(0);

      await service.getVerificationResults(tenantId, 1, 50, status);

      expect(mockPrisma.emailVerification.findMany).toHaveBeenCalledWith({
        where: { tenantId, status },
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('cache management', () => {
    it('should clear expired cache entries', () => {
      // Add some entries to cache
      service['cache'].set('test1@example.com', {} as any);
      service['cache'].set('test2@example.com', {} as any);
      
      // Set one as expired
      service['cacheExpiry'].set('test1@example.com', Date.now() - 1000);
      service['cacheExpiry'].set('test2@example.com', Date.now() + 1000);

      service.clearExpiredCache();

      expect(service['cache'].has('test1@example.com')).toBe(false);
      expect(service['cache'].has('test2@example.com')).toBe(true);
    });

    it('should return cache statistics', () => {
      service['cache'].set('test@example.com', {} as any);
      
      const stats = service.getCacheStats();
      
      expect(stats.size).toBe(1);
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('bulk verification', () => {
    it('should start bulk verification job', async () => {
      const emails = ['test1@valid-domain.com', 'test2@valid-domain.com'];
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      const job = await service.startBulkVerification(emails, tenantId);

      expect(job.totalEmails).toBe(2);
      expect(job.processedEmails).toBe(0);
      expect(['pending', 'processing']).toContain(job.status); // Job might start processing immediately
      expect(job.tenantId).toBe(tenantId);
    });

    it('should process bulk verification job', async () => {
      const emails = ['test1@valid-domain.com', 'test2@valid-domain.com'];
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});

      const job = await service.startBulkVerification(emails, tenantId);

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedJob = service.getBulkVerificationJob(job.id);
      expect(updatedJob).toBeTruthy();
      expect(updatedJob?.id).toBe(job.id);
    });

    it('should handle bulk verification with list cleaning', async () => {
      const emails = ['test1@valid-domain.com', 'test2@10minutemail.com'];
      const listId = 'test-list-id';
      
      mockPrisma.emailVerification.upsert.mockResolvedValue({});
      mockPrisma.listSubscriber.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriber.updateMany.mockResolvedValue({ count: 0 });

      await service.startBulkVerification(emails, tenantId, {
        listId,
        removeRisky: true,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have called deleteMany for risky emails
      expect(mockPrisma.listSubscriber.deleteMany).toHaveBeenCalled();
    });
  });

  describe('export and stats', () => {
    it('should export verification results as CSV', async () => {
      const mockResults = [
        {
          email: 'test1@example.com',
          status: VerificationStatus.VALID,
          verificationData: { score: 95, reason: 'Valid email' },
          verifiedAt: new Date('2023-01-01'),
          createdAt: new Date('2023-01-01'),
        },
        {
          email: 'test2@example.com',
          status: VerificationStatus.INVALID,
          verificationData: { score: 20, reason: 'Invalid domain' },
          verifiedAt: new Date('2023-01-02'),
          createdAt: new Date('2023-01-02'),
        },
      ];

      mockPrisma.emailVerification.findMany.mockResolvedValue(mockResults);

      const csvData = await service.exportVerificationResults(tenantId, undefined, 'csv');

      expect(csvData).toContain('Email,Status,Score,Reason,Verified At,Created At');
      expect(csvData).toContain('test1@example.com');
      expect(csvData).toContain('test2@example.com');
    });

    it('should export verification results as JSON', async () => {
      const mockResults = [
        {
          email: 'test1@example.com',
          status: VerificationStatus.VALID,
          verificationData: { score: 95 },
          verifiedAt: new Date('2023-01-01'),
          createdAt: new Date('2023-01-01'),
        },
      ];

      mockPrisma.emailVerification.findMany.mockResolvedValue(mockResults);

      const jsonData = await service.exportVerificationResults(tenantId, undefined, 'json');

      const parsed = JSON.parse(jsonData);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].email).toBe('test1@example.com');
    });

    it('should get verification statistics', async () => {
      const mockStats = [
        { status: VerificationStatus.VALID, _count: { status: 10 } },
        { status: VerificationStatus.INVALID, _count: { status: 5 } },
        { status: VerificationStatus.RISKY, _count: { status: 3 } },
      ];

      mockPrisma.emailVerification.groupBy.mockResolvedValue(mockStats);

      const stats = await service.getVerificationStats(tenantId);

      expect(stats.total).toBe(18);
      expect(stats.valid).toBe(10);
      expect(stats.invalid).toBe(5);
      expect(stats.risky).toBe(3);
      expect(stats.unknown).toBe(0);
    });
  });
});