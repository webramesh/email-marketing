import { prisma } from '@/lib/prisma';
import { TicketPriority, TicketStatus, SlaLevel, SlaEventType, Prisma } from '@/generated/prisma';

export interface EscalationRule {
  id: string;
  tenantId: string;
  name: string;
  conditions: {
    priority?: TicketPriority[];
    slaLevel?: SlaLevel[];
    category?: string[];
    timeThreshold?: number; // minutes
    noResponseTime?: number; // minutes
  };
  actions: {
    escalateToLevel?: number;
    assignToUsers?: string[];
    notifyUsers?: string[];
    changePriority?: TicketPriority;
    addTags?: string[];
  };
  isActive: boolean;
}

export interface RoutingRule {
  id: string;
  tenantId: string;
  companyName: string;
  conditions: {
    keywords?: string[];
    category?: string[];
    priority?: TicketPriority[];
    requesterDomain?: string[];
  };
  assignedAgents: string[];
  priority: number;
  isActive: boolean;
}

export class SupportEscalationService {
  /**
   * Process automatic ticket routing based on company rules
   */
  async processTicketRouting(tenantId: string, ticketId: string): Promise<void> {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) return;

    // Get company routing rules
    const companyRules = await prisma.supportCompanyRule.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    for (const rule of companyRules) {
      if (await this.matchesRoutingRule(ticket, rule)) {
        const assignedAgents = rule.assignedAgents as string[];
        if (assignedAgents.length > 0) {
          // Find the agent with the lowest workload
          const optimalAgent = await this.findOptimalAgent(tenantId, assignedAgents);

          if (optimalAgent) {
            await prisma.supportTicket.update({
              where: { id: ticketId },
              data: {
                assignedToUserId: optimalAgent,
                assignedCompany: rule.companyName,
              },
            });

            // Update agent workload
            await this.updateAgentWorkload(tenantId, optimalAgent);
            break;
          }
        }
      }
    }
  }

  /**
   * Check if ticket matches routing rule conditions
   */
  private async matchesRoutingRule(ticket: any, rule: any): Promise<boolean> {
    const routingRules = rule.routingRules as any;

    // Check keywords in subject/description
    if (routingRules.keywords?.length > 0) {
      const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
      const hasKeyword = routingRules.keywords.some((keyword: string) =>
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check category
    if (routingRules.category?.length > 0) {
      if (!routingRules.category.includes(ticket.category)) return false;
    }

    // Check priority
    if (routingRules.priority?.length > 0) {
      if (!routingRules.priority.includes(ticket.priority)) return false;
    }

    // Check requester domain
    if (routingRules.requesterDomain?.length > 0) {
      const domain = ticket.requesterEmail.split('@')[1];
      if (!routingRules.requesterDomain.includes(domain)) return false;
    }

    return true;
  }

  /**
   * Find the optimal agent based on workload
   */
  private async findOptimalAgent(tenantId: string, agentIds: string[]): Promise<string | null> {
    const workloads = await prisma.supportAgentWorkload.findMany({
      where: {
        tenantId,
        userId: { in: agentIds },
      },
      orderBy: { workloadScore: 'asc' },
    });

    if (workloads.length > 0) {
      return workloads[0].userId;
    }

    // If no workload data exists, return the first agent
    return agentIds[0] || null;
  }

  /**
   * Process SLA-based escalations
   */
  async processSLAEscalations(): Promise<void> {
    // Find tickets that are approaching or have breached SLA
    const overdueTickets = await prisma.supportTicket.findMany({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        OR: [
          {
            dueDate: { lt: new Date() }, // Overdue
          },
          {
            dueDate: {
              lt: new Date(Date.now() + 30 * 60 * 1000), // Due in next 30 minutes
            },
          },
        ],
      },
      include: {
        slaEvents: true,
      },
    });

    for (const ticket of overdueTickets) {
      await this.escalateTicket(ticket.tenantId, ticket.id, 'SLA_BREACH');
    }
  }

  /**
   * Process time-based escalations
   */
  async processTimeBasedEscalations(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    // Escalate urgent tickets with no response after 1 hour
    const urgentTickets = await prisma.supportTicket.findMany({
      where: {
        priority: TicketPriority.URGENT,
        status: TicketStatus.OPEN,
        firstResponseAt: null,
        createdAt: { lt: oneHourAgo },
        escalationLevel: 0,
      },
    });

    for (const ticket of urgentTickets) {
      await this.escalateTicket(ticket.tenantId, ticket.id, 'NO_RESPONSE_URGENT');
    }

    // Escalate high priority tickets with no response after 4 hours
    const highPriorityTickets = await prisma.supportTicket.findMany({
      where: {
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        firstResponseAt: null,
        createdAt: { lt: fourHoursAgo },
        escalationLevel: 0,
      },
    });

    for (const ticket of highPriorityTickets) {
      await this.escalateTicket(ticket.tenantId, ticket.id, 'NO_RESPONSE_HIGH');
    }
  }

  /**
   * Escalate a ticket
   */
  async escalateTicket(tenantId: string, ticketId: string, reason: string): Promise<void> {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) return;

    const newEscalationLevel = ticket.escalationLevel + 1;

    // Update ticket
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        escalationLevel: newEscalationLevel,
        escalatedAt: new Date(),
        // Increase priority if not already at highest
        priority:
          ticket.priority === TicketPriority.URGENT
            ? TicketPriority.URGENT
            : this.getNextPriorityLevel(ticket.priority),
      },
    });

    // Create escalation record
    await prisma.ticketEscalation.create({
      data: {
        ticketId,
        fromLevel: ticket.escalationLevel,
        toLevel: newEscalationLevel,
        reason,
        escalatedAt: new Date(),
      },
    });

    // Reassign to higher level agent if available
    await this.reassignEscalatedTicket(tenantId, ticketId, newEscalationLevel);

    // Send notifications
    await this.sendEscalationNotifications(tenantId, ticketId, reason);
  }

  /**
   * Get the next priority level for escalation
   */
  private getNextPriorityLevel(currentPriority: TicketPriority): TicketPriority {
    switch (currentPriority) {
      case TicketPriority.LOW:
        return TicketPriority.MEDIUM;
      case TicketPriority.MEDIUM:
        return TicketPriority.HIGH;
      case TicketPriority.HIGH:
        return TicketPriority.URGENT;
      default:
        return currentPriority;
    }
  }

  /**
   * Reassign escalated ticket to appropriate agent
   */
  private async reassignEscalatedTicket(
    tenantId: string,
    ticketId: string,
    escalationLevel: number
  ): Promise<void> {
    // Find agents who can handle escalated tickets
    // This could be based on user roles, experience level, etc.
    const escalationAgents = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['ADMIN', 'SUPPORT'] },
      },
    });

    if (escalationAgents.length > 0) {
      // Find the agent with the lowest workload among escalation agents
      const agentIds = escalationAgents.map(agent => agent.id);
      const optimalAgent = await this.findOptimalAgent(tenantId, agentIds);

      if (optimalAgent) {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { assignedToUserId: optimalAgent },
        });

        await this.updateAgentWorkload(tenantId, optimalAgent);
      }
    }
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(
    tenantId: string,
    ticketId: string,
    reason: string
  ): Promise<void> {
    // Get ticket details
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        assignedToUser: true,
      },
    });

    if (!ticket) return;

    // Get admin users for notifications
    const adminUsers = await prisma.user.findMany({
      where: {
        tenantId,
        role: 'ADMIN',
      },
    });

    // In a real implementation, this would send emails/notifications
    console.log(`Escalation notification for ticket ${ticket.ticketNumber}:`, {
      reason,
      escalationLevel: ticket.escalationLevel,
      assignedTo: ticket.assignedToUser?.email,
      adminUsers: adminUsers.map(u => u.email),
    });

    // Add internal comment about escalation
    await prisma.ticketComment.create({
      data: {
        ticketId,
        content: `Ticket escalated to level ${ticket.escalationLevel}. Reason: ${reason}`,
        isInternal: true,
        authorName: 'System',
      },
    });
  }

  /**
   * Update agent workload statistics
   */
  private async updateAgentWorkload(tenantId: string, userId: string): Promise<void> {
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
   * Create or update company routing rule
   */
  async createCompanyRule(
    tenantId: string,
    companyName: string,
    routingRules: any,
    assignedAgents: string[],
    priority: number = 1
  ): Promise<void> {
    await prisma.supportCompanyRule.upsert({
      where: {
        tenantId_companyName: {
          tenantId,
          companyName,
        },
      },
      update: {
        routingRules: JSON.stringify(routingRules),
        assignedAgents: JSON.stringify(assignedAgents),
        priority,
        isActive: true,
      },
      create: {
        tenantId,
        companyName,
        routingRules: JSON.stringify(routingRules),
        assignedAgents: JSON.stringify(assignedAgents),
        priority,
        isActive: true,
      },
    });
  }

  /**
   * Create or update SLA configuration
   */
  async createSLAConfig(
    tenantId: string,
    slaLevel: SlaLevel,
    priority: TicketPriority,
    firstResponseTime: number,
    resolutionTime: number,
    escalationTime: number,
    businessHoursOnly: boolean = false
  ): Promise<void> {
    await prisma.supportSlaConfig.upsert({
      where: {
        tenantId_slaLevel_priority: {
          tenantId,
          slaLevel,
          priority,
        },
      },
      update: {
        firstResponseTime,
        resolutionTime,
        escalationTime,
        businessHoursOnly,
        isActive: true,
      },
      create: {
        tenantId,
        slaLevel,
        priority,
        firstResponseTime,
        resolutionTime,
        escalationTime,
        businessHoursOnly,
        isActive: true,
      },
    });
  }

  /**
   * Get agent workload statistics
   */
  async getAgentWorkloads(tenantId: string): Promise<any[]> {
    return prisma.supportAgentWorkload.findMany({
      where: { tenantId },
      orderBy: { workloadScore: 'desc' },
    });
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.TicketEscalationWhereInput = {
      ticket: { tenantId },
      ...(dateFrom &&
        dateTo && {
          escalatedAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
    };

    const [totalEscalations, escalationsByLevel, escalationsByReason] = await Promise.all([
      prisma.ticketEscalation.count({ where }),
      prisma.ticketEscalation.groupBy({
        by: ['toLevel'],
        where,
        _count: { id: true },
      }),
      prisma.ticketEscalation.groupBy({
        by: ['reason'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      totalEscalations,
      escalationsByLevel,
      escalationsByReason,
    };
  }

  /**
   * Run periodic escalation checks (should be called by a cron job)
   */
  async runEscalationChecks(): Promise<void> {
    try {
      await this.processSLAEscalations();
      await this.processTimeBasedEscalations();
      console.log('Escalation checks completed successfully');
    } catch (error) {
      console.error('Error running escalation checks:', error);
    }
  }
}

export const supportEscalationService = new SupportEscalationService();
