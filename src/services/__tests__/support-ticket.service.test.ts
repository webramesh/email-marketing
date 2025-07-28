import { supportTicketService } from '../support-ticket.service';
import { TicketPriority, TicketCategory, SlaLevel, TicketSource } from '@/generated/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticketSlaEvent: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    ticketComment: {
      create: jest.fn(),
    },
    supportAgentWorkload: {
      upsert: jest.fn(),
    },
    supportCompanyRule: {
      findFirst: jest.fn(),
    },
    supportSlaConfig: {
      findFirst: jest.fn(),
    },
  },
}));

describe('SupportTicketService', () => {
  const mockTenantId = 'tenant-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create a ticket with default values', async () => {
      const mockTicket = {
        id: 'ticket-123',
        ticketNumber: 'TKT-20250728-0001',
        subject: 'Test Issue',
        description: 'Test description',
        priority: TicketPriority.MEDIUM,
        category: TicketCategory.GENERAL,
        requesterEmail: 'test@example.com',
        tenantId: mockTenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { prisma } = require('@/lib/prisma');
      prisma.supportTicket.create.mockResolvedValue(mockTicket);
      prisma.supportTicket.count.mockResolvedValue(0);
      prisma.ticketSlaEvent.createMany.mockResolvedValue({ count: 2 });

      const ticketData = {
        subject: 'Test Issue',
        description: 'Test description',
        requesterEmail: 'test@example.com',
      };

      const result = await supportTicketService.createTicket(mockTenantId, ticketData);

      expect(prisma.supportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: 'Test Issue',
            description: 'Test description',
            requesterEmail: 'test@example.com',
            priority: TicketPriority.MEDIUM,
            category: TicketCategory.GENERAL,
            slaLevel: SlaLevel.STANDARD,
            source: TicketSource.WEB,
            tenantId: mockTenantId,
          }),
        })
      );

      expect(prisma.ticketSlaEvent.createMany).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should generate unique ticket numbers', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.supportTicket.count.mockResolvedValue(5); // 5 tickets created today
      
      const service = supportTicketService as any;
      const ticketNumber = await service.generateTicketNumber(mockTenantId);
      
      expect(ticketNumber).toMatch(/^TKT-\d{8}-0006$/);
    });
  });

  describe('getTickets', () => {
    it('should return paginated tickets with filters', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          subject: 'Issue 1',
          status: 'OPEN',
          priority: TicketPriority.HIGH,
        },
        {
          id: 'ticket-2',
          subject: 'Issue 2',
          status: 'IN_PROGRESS',
          priority: TicketPriority.MEDIUM,
        },
      ];

      const { prisma } = require('@/lib/prisma');
      prisma.supportTicket.findMany.mockResolvedValue(mockTickets);
      prisma.supportTicket.count.mockResolvedValue(2);

      const result = await supportTicketService.getTickets(
        mockTenantId,
        { priority: [TicketPriority.HIGH] },
        1,
        10
      );

      expect(result.tickets).toEqual(mockTickets);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      });
    });
  });

  describe('addComment', () => {
    it('should add a comment to a ticket', async () => {
      const mockTicket = {
        id: 'ticket-123',
        firstResponseAt: null,
      };

      const mockComment = {
        id: 'comment-123',
        content: 'Test comment',
        isInternal: false,
        ticketId: 'ticket-123',
      };

      const { prisma } = require('@/lib/prisma');
      prisma.supportTicket.findFirst.mockResolvedValue(mockTicket);
      prisma.ticketComment.create.mockResolvedValue(mockComment);
      prisma.supportTicket.update.mockResolvedValue(mockTicket);
      prisma.ticketSlaEvent.updateMany.mockResolvedValue({ count: 1 });

      const result = await supportTicketService.addComment(
        mockTenantId,
        'ticket-123',
        {
          content: 'Test comment',
          authorId: 'user-123',
          authorName: 'Test User',
          authorEmail: 'test@example.com',
        }
      );

      expect(prisma.ticketComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-123',
          content: 'Test comment',
          isInternal: false,
          authorId: 'user-123',
          authorName: 'Test User',
          authorEmail: 'test@example.com',
        },
      });

      expect(result).toEqual(mockComment);
    });
  });

  describe('getTicketStats', () => {
    it('should return ticket statistics', async () => {
      const { prisma } = require('@/lib/prisma');
      
      // Mock all the count queries
      prisma.supportTicket.count
        .mockResolvedValueOnce(100) // totalTickets
        .mockResolvedValueOnce(20)  // openTickets
        .mockResolvedValueOnce(15)  // inProgressTickets
        .mockResolvedValueOnce(50)  // resolvedTickets
        .mockResolvedValueOnce(15)  // closedTickets
        .mockResolvedValueOnce(5)   // urgentTickets
        .mockResolvedValueOnce(3);  // overdueTickets

      const result = await supportTicketService.getTicketStats(mockTenantId);

      expect(result).toEqual({
        totalTickets: 100,
        openTickets: 20,
        inProgressTickets: 15,
        resolvedTickets: 50,
        closedTickets: 15,
        urgentTickets: 5,
        overdueTickets: 3,
        activeTickets: 35, // openTickets + inProgressTickets
      });
    });
  });
});