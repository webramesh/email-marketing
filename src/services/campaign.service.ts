import { prisma } from '@/lib/prisma'
import { 
  Campaign, 
  CampaignWithDetails, 
  CreateCampaignRequest, 
  UpdateCampaignRequest,
  CampaignStatus,
  CampaignType,
  PaginatedResponse,
  PaginationParams
} from '@/types'

export class CampaignService {
  /**
   * Get all campaigns for a tenant with pagination and filtering
   */
  static async getCampaigns(
    tenantId: string,
    params: PaginationParams & {
      status?: CampaignStatus;
      type?: CampaignType;
      search?: string;
      tags?: string[];
    }
  ): Promise<PaginatedResponse<CampaignWithDetails>> {
    const { page = 1, limit = 10, status, type, search, tags } = params
    const skip = (page - 1) * limit

    // Build where clause with tenant isolation
    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(type && { campaignType: type }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(tags && tags.length > 0 && {
        tags: {
          array_contains: tags
        }
      })
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              subject: true
            }
          },
          abTestVariants: true,
          analytics: true
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.campaign.count({ where })
    ])

    return {
      data: campaigns as CampaignWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get a single campaign by ID with full details
   */
  static async getCampaignById(
    tenantId: string, 
    campaignId: string
  ): Promise<CampaignWithDetails | null> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId // Tenant isolation
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true
          }
        },
        abTestVariants: true,
        analytics: true
      }
    })

    return campaign as CampaignWithDetails | null
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(
    tenantId: string,
    data: CreateCampaignRequest
  ): Promise<CampaignWithDetails> {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        subject: data.subject,
        preheader: data.preheader,
        content: data.content || '',
        campaignType: data.campaignType || CampaignType.REGULAR,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        replyToEmail: data.replyToEmail,
        trackOpens: data.trackOpens ?? true,
        trackClicks: data.trackClicks ?? true,
        targetLists: data.targetLists as any,
        targetSegments: data.targetSegments as any,
        templateId: data.templateId,
        tags: data.tags as any,
        notes: data.notes,
        scheduledAt: data.scheduledAt,
        tenantId // Tenant isolation
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true
          }
        },
        abTestVariants: true,
        analytics: true
      }
    })

    return campaign as CampaignWithDetails
  }

  /**
   * Update an existing campaign
   */
  static async updateCampaign(
    tenantId: string,
    campaignId: string,
    data: UpdateCampaignRequest
  ): Promise<CampaignWithDetails | null> {
    // First check if campaign exists and belongs to tenant
    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      }
    })

    if (!existingCampaign) {
      return null
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.subject && { subject: data.subject }),
        ...(data.preheader !== undefined && { preheader: data.preheader }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.status && { status: data.status }),
        ...(data.campaignType && { campaignType: data.campaignType }),
        ...(data.fromName !== undefined && { fromName: data.fromName }),
        ...(data.fromEmail !== undefined && { fromEmail: data.fromEmail }),
        ...(data.replyToEmail !== undefined && { replyToEmail: data.replyToEmail }),
        ...(data.trackOpens !== undefined && { trackOpens: data.trackOpens }),
        ...(data.trackClicks !== undefined && { trackClicks: data.trackClicks }),
        ...(data.targetLists !== undefined && { targetLists: data.targetLists }),
        ...(data.targetSegments !== undefined && { targetSegments: data.targetSegments }),
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(data.templateData !== undefined && { templateData: data.templateData }),
        ...(data.customCss !== undefined && { customCss: data.customCss }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt }),
        updatedAt: new Date()
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true
          }
        },
        abTestVariants: true,
        analytics: true
      }
    })

    return campaign as CampaignWithDetails
  }

  /**
   * Delete a campaign
   */
  static async deleteCampaign(
    tenantId: string,
    campaignId: string
  ): Promise<boolean> {
    try {
      // First check if campaign exists and belongs to tenant
      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          tenantId
        }
      })

      if (!existingCampaign) {
        return false
      }

      // Delete the campaign (cascade will handle related records)
      await prisma.campaign.delete({
        where: { id: campaignId }
      })

      return true
    } catch (error) {
      console.error('Error deleting campaign:', error)
      return false
    }
  }

  /**
   * Duplicate a campaign
   */
  static async duplicateCampaign(
    tenantId: string,
    campaignId: string,
    newName?: string
  ): Promise<CampaignWithDetails | null> {
    // Get the original campaign
    const originalCampaign = await this.getCampaignById(tenantId, campaignId)
    
    if (!originalCampaign) {
      return null
    }

    // Create a duplicate with DRAFT status
    const duplicatedCampaign = await prisma.campaign.create({
      data: {
        name: newName || `${originalCampaign.name} (Copy)`,
        subject: originalCampaign.subject,
        preheader: originalCampaign.preheader,
        content: originalCampaign.content,
        plainTextContent: originalCampaign.plainTextContent,
        campaignType: originalCampaign.campaignType,
        fromName: originalCampaign.fromName,
        fromEmail: originalCampaign.fromEmail,
        replyToEmail: originalCampaign.replyToEmail,
        trackOpens: originalCampaign.trackOpens,
        trackClicks: originalCampaign.trackClicks,
        targetLists: originalCampaign.targetLists as any,
        targetSegments: originalCampaign.targetSegments as any,
        templateData: originalCampaign.templateData as any,
        customCss: originalCampaign.customCss,
        templateId: originalCampaign.templateId,
        tags: originalCampaign.tags as any,
        notes: originalCampaign.notes,
        status: CampaignStatus.DRAFT, // Always create as draft
        tenantId
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true
          }
        },
        abTestVariants: true,
        analytics: true
      }
    })

    return duplicatedCampaign as CampaignWithDetails
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(tenantId: string) {
    const stats = await prisma.campaign.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        id: true
      }
    })

    const totalCampaigns = await prisma.campaign.count({
      where: { tenantId }
    })

    const recentCampaigns = await prisma.campaign.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    return {
      total: totalCampaigns,
      recent: recentCampaigns,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id
        return acc
      }, {} as Record<string, number>)
    }
  }

  /**
   * Update campaign statistics (called after sending)
   */
  static async updateCampaignStats(
    tenantId: string,
    campaignId: string,
    stats: {
      totalRecipients?: number;
      totalSent?: number;
      totalDelivered?: number;
      totalOpened?: number;
      totalClicked?: number;
      totalUnsubscribed?: number;
      totalBounced?: number;
      totalComplained?: number;
    }
  ): Promise<boolean> {
    try {
      await prisma.campaign.update({
        where: {
          id: campaignId,
          tenantId // Ensure tenant isolation
        },
        data: {
          ...stats,
          updatedAt: new Date()
        }
      })
      return true
    } catch (error) {
      console.error('Error updating campaign stats:', error)
      return false
    }
  }

  /**
   * Schedule a campaign
   */
  static async scheduleCampaign(
    tenantId: string,
    campaignId: string,
    scheduledAt: Date
  ): Promise<boolean> {
    try {
      await prisma.campaign.update({
        where: {
          id: campaignId,
          tenantId
        },
        data: {
          status: CampaignStatus.SCHEDULED,
          scheduledAt,
          updatedAt: new Date()
        }
      })
      return true
    } catch (error) {
      console.error('Error scheduling campaign:', error)
      return false
    }
  }

  /**
   * Cancel a scheduled campaign
   */
  static async cancelCampaign(
    tenantId: string,
    campaignId: string
  ): Promise<boolean> {
    try {
      await prisma.campaign.update({
        where: {
          id: campaignId,
          tenantId
        },
        data: {
          status: CampaignStatus.CANCELLED,
          updatedAt: new Date()
        }
      })
      return true
    } catch (error) {
      console.error('Error cancelling campaign:', error)
      return false
    }
  }

  /**
   * Get campaigns ready to send (scheduled campaigns that are due)
   */
  static async getCampaignsReadyToSend(): Promise<Campaign[]> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: {
          lte: new Date()
        }
      }
    })

    return campaigns as Campaign[]
  }
}