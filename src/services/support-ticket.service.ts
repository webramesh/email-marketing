import { prisma } from '@/lib/prisma';
import { supportEscalationService } from './support-escalation.service';
import {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SlaLevel,
  TicketSource,
  SlaEventType,
  Prisma,
} from '@/generated/prisma';

export interface CreateTicketData {
  subject: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  language?: string;
  requesterEmail: string;
  requesterName?: string;
  requesterUserId?: string;
  assignedCompany?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  source?: TicketSource;
  slaLevel?: SlaLevel;
}

export interface UpdateTicketData {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToUserId?: string;
  assignedCompany?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assignedToUserId?: string;
  assignedCompany?: string;
  requesterEmail?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
}

export interface TicketComment {
  content: string;
  isInternal?: boolean;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
}

export class SupportTicketService {
  /**
   * Generate a unique ticket number
   */
  private async generateTicketNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Get the count of tickets created today for this tenant
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayCount = await prisma.supportTicket.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `TKT-${year}${month}${day}-${sequence}`;
  }

  /**
   * Calculate SLA due dates based on priority and SLA level
   */
  private async calculateSLADates(
    tenantId: string,
    priority: TicketPriority,
    slaLevel: SlaLevel
  ): Promise<{ dueDate: Date; firstResponseDue: Date }> {
    // Get SLA configuration for this tenant, priority, and SLA level
    const slaConfig = await prisma.supportSlaConfig.findFirst({
      where: {
        tenantId,
        priority,
        slaLevel,
        isActive: true,
      },
    });

    // Default SLA times in minutes if no config found
    const defaultSLA = {
      [TicketPriority.URGENT]: { firstResponse: 15, resolution: 240 },
      [TicketPriority.HIGH]: { firstResponse: 60, resolution: 480 },
      [TicketPriority.MEDIUM]: { firstResponse: 240, resolution: 1440 },
      [TicketPriority.LOW]: { firstResponse: 480, resolution: 2880 },
    };

    const firstResponseTime = slaConfig?.firstResponseTime || defaultSLA[priority].firstResponse;
    const resolutionTime = slaConfig?.resolutionTime || defaultSLA[priority].resolution;

    const now = new Date();
    const firstResponseDue = new Date(now.getTime() + firstResponseTime * 60 * 1000);
    const dueDate = new Date(now.getTime() + resolutionTime * 60 * 1000);

    return { dueDate, firstResponseDue };
  }

  /**
   * Auto-assign ticket based on company rules and agent workload
   */
  private async autoAssignTicket(
    tenantId: string,
    assignedCompany?: string
  ): Promise<string | null> {
    if (!assignedCompany) return null;

    // Get company assignment rules
    const companyRule = await prisma.supportCompanyRule.findFirst({
      where: {
        tenantId,
        companyName: assignedCompany,
        isActive: true,
      },
    });

    if (!companyRule || !companyRule.assignedAgents) return null;

    const assignedAgents = companyRule.assignedAgents as string[];
    if (assignedAgents.length === 0) return null;

    // Get workload for all assigned agents
    const workloads = await prisma.supportAgentWorkload.findMany({
      where: {
        tenantId,
        userId: { in: assignedAgents },
      },
      orderBy: {
        workloadScore: 'asc',
      },
    });

    // Return the agent with the lowest workload score
    return workloads.length > 0 ? workloads[0].userId : assignedAgents[0];
  }

  /**
   * Create a new support ticket
   */
  async createTicket(tenantId: string, data: CreateTicketData): Promise<SupportTicket> {
    const ticketNumber = await this.generateTicketNumber(tenantId);
    const { dueDate, firstResponseDue } = await this.calculateSLADates(
      tenantId,
      data.priority || TicketPriority.MEDIUM,
      data.slaLevel || SlaLevel.STANDARD
    );

    const assignedToUserId = await this.autoAssignTicket(tenantId, data.assignedCompany);

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        description: data.description,
        priority: data.priority || TicketPriority.MEDIUM,
        category: data.category || TicketCategory.GENERAL,
        language: data.language || 'en',
        requesterEmail: data.requesterEmail,
        requesterName: data.requesterName,
        requesterUserId: data.requesterUserId,
        assignedCompany: data.assignedCompany,
        assignedToUserId,
        slaLevel: data.slaLevel || SlaLevel.STANDARD,
        dueDate,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
        customFields: data.customFields ? JSON.stringify(data.customFields) : undefined,
        source: data.source || TicketSource.WEB,
        tenantId,
      },
      include: {
        assignedToUser: true,
        requesterUser: true,
        comments: true,
        attachments: true,
      },
    });

    // Create SLA events
    await prisma.ticketSlaEvent.createMany({
      data: [
        {
          ticketId: ticket.id,
          eventType: SlaEventType.FIRST_RESPONSE,
          targetTime: firstResponseDue,
        },
        {
          ticketId: ticket.id,
          eventType: SlaEventType.RESOLUTION,
          targetTime: dueDate,
        },
      ],
    });

    // Update agent workload if assigned
    if (assignedToUserId) {
      await this.updateAgentWorkload(tenantId, assignedToUserId);
    }

    // Process automatic routing if no specific assignment was made
    if (!assignedToUserId) {
      await supportEscalationService.processTicketRouting(tenantId, ticket.id);
    }

    return ticket;
  }

  /**
   * Update a support ticket
   */
  async updateTicket(
    tenantId: string,
    ticketId: string,
    data: UpdateTicketData
  ): Promise<SupportTicket> {
    const existingTicket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!existingTicket) {
      throw new Error('Ticket not found');
    }

    const updateData: Prisma.SupportTicketUpdateInput = {
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      customFields: data.customFields ? JSON.stringify(data.customFields) : undefined,
    };

    // Handle status changes
    if (data.status && data.status !== existingTicket.status) {
      if (data.status === TicketStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
        // Update SLA event for resolution
        await prisma.ticketSlaEvent.updateMany({
          where: {
            ticketId,
            eventType: SlaEventType.RESOLUTION,
            actualTime: null,
          },
          data: {
            actualTime: new Date(),
          },
        });
      } else if (data.status === TicketStatus.CLOSED) {
        updateData.closedAt = new Date();
      }
    }

    // Handle assignment changes
    if (data.assignedToUserId !== undefined) {
      if (existingTicket.assignedToUserId) {
        await this.updateAgentWorkload(tenantId, existingTicket.assignedToUserId);
      }
      if (data.assignedToUserId) {
        await this.updateAgentWorkload(tenantId, data.assignedToUserId);
      }
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        assignedToUser: true,
        requesterUser: true,
        comments: true,
        attachments: true,
      },
    });

    return ticket;
  }

  /**
   * Get tickets with filtering and pagination
   */
  async getTickets(
    tenantId: string,
    filters: TicketFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    const where: Prisma.SupportTicketWhereInput = {
      tenantId,
      ...(filters.status && { status: { in: filters.status } }),
      ...(filters.priority && { priority: { in: filters.priority } }),
      ...(filters.category && { category: { in: filters.category } }),
      ...(filters.assignedToUserId && { assignedToUserId: filters.assignedToUserId }),
      ...(filters.assignedCompany && { assignedCompany: filters.assignedCompany }),
      ...(filters.requesterEmail && { requesterEmail: filters.requesterEmail }),
      ...(filters.dateFrom &&
        filters.dateTo && {
          createdAt: {
            gte: filters.dateFrom,
            lte: filters.dateTo,
          },
        }),
    };

    // Handle search across subject and description
    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search } },
        { description: { contains: filters.search } },
        { ticketNumber: { contains: filters.search } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          assignedToUser: true,
          requesterUser: true,
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single ticket by ID
   */
  async getTicketById(tenantId: string, ticketId: string): Promise<SupportTicket | null> {
    return prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        assignedToUser: true,
        requesterUser: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        escalations: {
          orderBy: { escalatedAt: 'desc' },
        },
        slaEvents: true,
      },
    });
  }

  /**
   * Add a comment to a ticket
   */
  async addComment(tenantId: string, ticketId: string, comment: TicketComment) {
    // Verify ticket exists and belongs to tenant
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const ticketComment = await prisma.ticketComment.create({
      data: {
        ticketId,
        content: comment.content,
        isInternal: comment.isInternal || false,
        authorId: comment.authorId,
        authorName: comment.authorName,
        authorEmail: comment.authorEmail,
      },
    });

    // Update first response time if this is the first non-internal comment
    if (!comment.isInternal && !ticket.firstResponseAt) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });

      // Update SLA event for first response
      await prisma.ticketSlaEvent.updateMany({
        where: {
          ticketId,
          eventType: SlaEventType.FIRST_RESPONSE,
          actualTime: null,
        },
        data: {
          actualTime: new Date(),
        },
      });
    }

    return ticketComment;
  }

  /**
   * Update agent workload statistics
   */
  private async updateAgentWorkload(tenantId: string, userId: string) {
    const activeTickets = await prisma.supportTicket.count({
      where: {
        tenantId,
        assignedToUserId: userId,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
      },
    });

    const totalTickets = await prisma.supportTicket.count({
      where: {
        tenantId,
        assignedToUserId: userId,
      },
    });

    // Calculate average response time (simplified)
    const avgResponseTime = await prisma.supportTicket.aggregate({
      where: {
        tenantId,
        assignedToUserId: userId,
        firstResponseAt: { not: null },
      },
      _avg: {
        // This would need a computed field for response time
        // For now, we'll use a placeholder
      },
    });

    // Calculate workload score (higher score = more workload)
    const workloadScore = activeTickets * 1.5 + totalTickets * 0.1;

    await prisma.supportAgentWorkload.upsert({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      update: {
        activeTickets,
        totalTickets,
        workloadScore,
        lastUpdated: new Date(),
      },
      create: {
        userId,
        tenantId,
        activeTickets,
        totalTickets,
        workloadScore,
      },
    });
  }

  /**
   * Get ticket statistics for dashboard
   */
  async getTicketStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.SupportTicketWhereInput = {
      tenantId,
      ...(dateFrom &&
        dateTo && {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
    };

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      overdueTickets,
    ] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.count({ where: { ...where, status: TicketStatus.OPEN } }),
      prisma.supportTicket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
      prisma.supportTicket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
      prisma.supportTicket.count({ where: { ...where, status: TicketStatus.CLOSED } }),
      prisma.supportTicket.count({ where: { ...where, priority: TicketPriority.URGENT } }),
      prisma.supportTicket.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        },
      }),
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      overdueTickets,
      activeTickets: openTickets + inProgressTickets,
    };
  }

  /**
   * Bulk update tickets
   */
  async bulkUpdateTickets(
    tenantId: string,
    ticketIds: string[],
    updates: Partial<UpdateTicketData>
  ) {
    const updateData: Prisma.SupportTicketUpdateManyMutationInput = {
      ...updates,
      tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
      customFields: updates.customFields ? JSON.stringify(updates.customFields) : undefined,
    };

    const result = await prisma.supportTicket.updateMany({
      where: {
        id: { in: ticketIds },
        tenantId,
      },
      data: updateData,
    });

    // Update agent workloads if assignment changed
    if (updates.assignedToUserId !== undefined) {
      const affectedTickets = await prisma.supportTicket.findMany({
        where: {
          id: { in: ticketIds },
          tenantId,
        },
        select: {
          assignedToUserId: true,
        },
      });

      const affectedUserIds = new Set(
        affectedTickets.map(t => t.assignedToUserId).filter(Boolean) as string[]
      );

      if (updates.assignedToUserId) {
        affectedUserIds.add(updates.assignedToUserId);
      }

      for (const userId of affectedUserIds) {
        await this.updateAgentWorkload(tenantId, userId);
      }
    }

    return result;
  }
}

export const supportTicketService = new SupportTicketService();
