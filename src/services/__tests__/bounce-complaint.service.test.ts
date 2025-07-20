import { BounceComplaintService, BounceData, ComplaintData } from '../bounce-complaint.service';

// Mock BounceComplaintType enum
const BounceComplaintType = {
  HARD_BOUNCE: 'HARD_BOUNCE',
  SOFT_BOUNCE: 'SOFT_BOUNCE',
  COMPLAINT: 'COMPLAINT',
  BLOCK: 'BLOCK',
};

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bounceComplaint: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    subscriber: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    campaign: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock Prisma client types
jest.mock('@prisma/client', () => ({
  BounceComplaintType: {
    HARD_BOUNCE: 'HARD_BOUNCE',
    SOFT_BOUNCE: 'SOFT_BOUNCE',
    COMPLAINT: 'COMPLAINT',
    BLOCK: 'BLOCK',
  },
}));

const { prisma } = require('@/lib/prisma');

describe('BounceComplaintService', () => {
  let service: BounceComplaintService;
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    service = new BounceComplaintService();
    jest.clearAllMocks();
  });

  describe('processBounce', () => {
    const mockBounceData: BounceData = {
      email: 'test@example.com',
      bounceType: 'hard',
      bounceSubType: 'general',
      reason: 'Mailbox does not exist',
      campaignId: 'campaign-123',
      timestamp: new Date(),
    };

    it('should process hard bounce and update subscriber status', async () => {
      prisma.bounceComplaint.create.mockResolvedValue({});
      prisma.subscriber.updateMany.mockResolvedValue({ count: 1 });
      prisma.campaign.update.mockResolvedValue({});
      prisma.auditLog.count.mockResolvedValue(10);

      await service.processBounce(mockTenantId, mockBounceData);

      expect(prisma.bounceComplaint.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          email: mockBounceData.email,
          type: BounceComplaintType.HARD_BOUNCE,
          reason: mockBounceData.reason,
          bounceType: mockBounceData.bounceSubType,
          campaignId: mockBounceData.campaignId,
          rawData: mockBounceData.rawData,
          createdAt: mockBounceData.timestamp,
        },
      });

      expect(prisma.subscriber.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          email: mockBounceData.email,
        },
        data: {
          status: 'BOUNCED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should process soft bounce without updating subscriber status', async () => {
      const softBounceData = { ...mockBounceData, bounceType: 'soft' as const };
      
      prisma.bounceComplaint.create.mockResolvedValue({});
      prisma.campaign.update.mockResolvedValue({});
      prisma.auditLog.count.mockResolvedValue(10);

      await service.processBounce(mockTenantId, softBounceData);

      expect(prisma.bounceComplaint.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          email: softBounceData.email,
          type: BounceComplaintType.SOFT_BOUNCE,
          reason: softBounceData.reason,
          bounceType: softBounceData.bounceSubType,
          campaignId: softBounceData.campaignId,
          rawData: softBounceData.rawData,
          createdAt: softBounceData.timestamp,
        },
      });

      // Should not update subscriber status for soft bounces
      expect(prisma.subscriber.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('processComplaint', () => {
    const mockComplaintData: ComplaintData = {
      email: 'test@example.com',
      reason: 'spam',
      campaignId: 'campaign-123',
      timestamp: new Date(),
    };

    it('should process complaint and update subscriber status', async () => {
      prisma.bounceComplaint.create.mockResolvedValue({});
      prisma.subscriber.updateMany.mockResolvedValue({ count: 1 });
      prisma.campaign.update.mockResolvedValue({});
      prisma.auditLog.count.mockResolvedValue(10);

      await service.processComplaint(mockTenantId, mockComplaintData);

      expect(prisma.bounceComplaint.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          email: mockComplaintData.email,
          type: BounceComplaintType.COMPLAINT,
          reason: mockComplaintData.reason,
          campaignId: mockComplaintData.campaignId,
          rawData: mockComplaintData.rawData,
          createdAt: mockComplaintData.timestamp,
        },
      });

      expect(prisma.subscriber.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          email: mockComplaintData.email,
        },
        data: {
          status: 'COMPLAINED',
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getSuppressionList', () => {
    it('should return list of suppressed emails', async () => {
      const mockSuppressedSubscribers = [
        { email: 'bounced@example.com' },
        { email: 'complained@example.com' },
        { email: 'unsubscribed@example.com' },
      ];

      prisma.subscriber.findMany.mockResolvedValue(mockSuppressedSubscribers);

      const result = await service.getSuppressionList(mockTenantId);

      expect(result).toEqual([
        'bounced@example.com',
        'complained@example.com',
        'unsubscribed@example.com',
      ]);

      expect(prisma.subscriber.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          status: {
            in: ['BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'],
          },
        },
        select: {
          email: true,
        },
      });
    });
  });

  describe('isEmailSuppressed', () => {
    it('should return true for suppressed email', async () => {
      prisma.subscriber.findFirst.mockResolvedValue({ id: 'subscriber-123' });

      const result = await service.isEmailSuppressed(mockTenantId, 'test@example.com');

      expect(result).toBe(true);
    });

    it('should return false for non-suppressed email', async () => {
      prisma.subscriber.findFirst.mockResolvedValue(null);

      const result = await service.isEmailSuppressed(mockTenantId, 'test@example.com');

      expect(result).toBe(false);
    });
  });

  describe('getReputationMetrics', () => {
    it('should calculate reputation metrics correctly', async () => {
      // Mock data
      prisma.auditLog.count
        .mockResolvedValueOnce(1000) // totalSent
        .mockResolvedValueOnce(50); // totalUnsubscribed

      prisma.bounceComplaint.count
        .mockResolvedValueOnce(30) // totalBounced
        .mockResolvedValueOnce(5); // totalComplaints

      const result = await service.getReputationMetrics(mockTenantId, 30);

      expect(result).toEqual({
        bounceRate: 3, // 30/1000 * 100
        complaintRate: 0.5, // 5/1000 * 100
        unsubscribeRate: 5, // 50/1000 * 100
        totalSent: 1000,
        totalBounced: 30,
        totalComplaints: 5,
        totalUnsubscribed: 50,
        riskLevel: 'medium',
        recommendations: expect.any(Array),
      });
    });

    it('should handle zero sent emails', async () => {
      prisma.auditLog.count.mockResolvedValue(0);
      prisma.bounceComplaint.count.mockResolvedValue(0);

      const result = await service.getReputationMetrics(mockTenantId, 30);

      expect(result.bounceRate).toBe(0);
      expect(result.complaintRate).toBe(0);
      expect(result.unsubscribeRate).toBe(0);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('cleanSuppressionList', () => {
    it('should clean old soft bounces', async () => {
      prisma.bounceComplaint.deleteMany.mockResolvedValue({ count: 25 });

      const result = await service.cleanSuppressionList(mockTenantId, 365);

      expect(result).toBe(25);
      expect(prisma.bounceComplaint.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          type: BounceComplaintType.SOFT_BOUNCE,
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});