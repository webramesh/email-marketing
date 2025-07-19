import { CampaignService } from '../campaign.service'
import { CampaignType, CampaignStatus } from '@/types'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    }
  }
}))

const mockPrisma = require('@/lib/prisma').prisma

describe('CampaignService', () => {
  const mockTenantId = 'test-tenant-id'
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCampaigns', () => {
    it('should fetch campaigns with tenant isolation', async () => {
      const mockCampaigns = [
        {
          id: '1',
          name: 'Test Campaign',
          subject: 'Test Subject',
          content: 'Test Content',
          status: CampaignStatus.DRAFT,
          campaignType: CampaignType.REGULAR,
          tenantId: mockTenantId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns)
      mockPrisma.campaign.count.mockResolvedValue(1)

      const result = await CampaignService.getCampaigns(mockTenantId, { page: 1, limit: 10 })

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
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
        skip: 0,
        take: 10
      })

      expect(result.data).toEqual(mockCampaigns)
      expect(result.meta.total).toBe(1)
    })

    it('should apply search filters', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([])
      mockPrisma.campaign.count.mockResolvedValue(0)

      await CampaignService.getCampaigns(mockTenantId, {
        page: 1,
        limit: 10,
        search: 'test',
        status: CampaignStatus.DRAFT
      })

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          status: CampaignStatus.DRAFT,
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { subject: { contains: 'test', mode: 'insensitive' } }
          ]
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10
      })
    })
  })

  describe('createCampaign', () => {
    it('should create a campaign with tenant isolation', async () => {
      const campaignData = {
        name: 'New Campaign',
        subject: 'New Subject',
        content: 'New Content'
      }

      const mockCreatedCampaign = {
        id: '1',
        ...campaignData,
        status: CampaignStatus.DRAFT,
        campaignType: CampaignType.REGULAR,
        tenantId: mockTenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrisma.campaign.create.mockResolvedValue(mockCreatedCampaign)

      const result = await CampaignService.createCampaign(mockTenantId, campaignData)

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: campaignData.name,
          subject: campaignData.subject,
          content: campaignData.content,
          campaignType: CampaignType.REGULAR,
          trackOpens: true,
          trackClicks: true,
          tenantId: mockTenantId,
          preheader: undefined,
          fromName: undefined,
          fromEmail: undefined,
          replyToEmail: undefined,
          targetLists: undefined,
          targetSegments: undefined,
          templateId: undefined,
          tags: undefined,
          notes: undefined,
          scheduledAt: undefined
        },
        include: expect.any(Object)
      })

      expect(result).toEqual(mockCreatedCampaign)
    })
  })

  describe('updateCampaign', () => {
    it('should update campaign with tenant isolation check', async () => {
      const campaignId = 'campaign-1'
      const updateData = { name: 'Updated Campaign' }

      mockPrisma.campaign.findFirst.mockResolvedValue({ id: campaignId, tenantId: mockTenantId })
      mockPrisma.campaign.update.mockResolvedValue({
        id: campaignId,
        name: 'Updated Campaign',
        tenantId: mockTenantId
      })

      const result = await CampaignService.updateCampaign(mockTenantId, campaignId, updateData)

      expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
        where: { id: campaignId, tenantId: mockTenantId }
      })

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: campaignId },
        data: {
          name: 'Updated Campaign',
          updatedAt: expect.any(Date)
        },
        include: expect.any(Object)
      })

      expect(result).toBeDefined()
    })

    it('should return null if campaign not found or not owned by tenant', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null)

      const result = await CampaignService.updateCampaign(mockTenantId, 'non-existent', {})

      expect(result).toBeNull()
      expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteCampaign', () => {
    it('should delete campaign with tenant isolation check', async () => {
      const campaignId = 'campaign-1'

      mockPrisma.campaign.findFirst.mockResolvedValue({ id: campaignId, tenantId: mockTenantId })
      mockPrisma.campaign.delete.mockResolvedValue({ id: campaignId })

      const result = await CampaignService.deleteCampaign(mockTenantId, campaignId)

      expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
        where: { id: campaignId, tenantId: mockTenantId }
      })

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: campaignId }
      })

      expect(result).toBe(true)
    })

    it('should return false if campaign not found', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null)

      const result = await CampaignService.deleteCampaign(mockTenantId, 'non-existent')

      expect(result).toBe(false)
      expect(mockPrisma.campaign.delete).not.toHaveBeenCalled()
    })
  })
})