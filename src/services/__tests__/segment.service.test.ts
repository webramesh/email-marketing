import { SegmentService, SegmentConditions } from '../segment.service'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus } from '@/types'

// Mock the tenant prisma wrapper
jest.mock('@/lib/tenant/prisma-wrapper')

const mockTenantPrisma = {
  prisma: {
    segment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    subscriber: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    emailEvent: {
      findMany: jest.fn(),
    },
  },
}

;(createTenantPrisma as jest.Mock).mockReturnValue(mockTenantPrisma)

describe('SegmentService', () => {
  let segmentService: SegmentService
  const tenantId = 'test-tenant-id'

  beforeEach(() => {
    segmentService = new SegmentService(tenantId)
    jest.clearAllMocks()
  })

  describe('getSegments', () => {
    it('should return all segments for the tenant', async () => {
      const mockSegments = [
        {
          id: '1',
          name: 'Active Users',
          description: 'All active subscribers',
          conditions: { operator: 'AND', rules: [] },
          subscriberCount: 100,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          tenantId,
        },
      ]

      mockTenantPrisma.prisma.segment.findMany.mockResolvedValue(mockSegments)

      const result = await segmentService.getSegments()

      expect(result).toEqual(mockSegments)
      expect(mockTenantPrisma.prisma.segment.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('getSegmentById', () => {
    it('should return a segment by ID', async () => {
      const mockSegment = {
        id: '1',
        name: 'Active Users',
        description: 'All active subscribers',
        conditions: { operator: 'AND', rules: [] },
        subscriberCount: 100,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(mockSegment)

      const result = await segmentService.getSegmentById('1')

      expect(result).toEqual(mockSegment)
      expect(mockTenantPrisma.prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      })
    })

    it('should return null if segment not found', async () => {
      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(null)

      const result = await segmentService.getSegmentById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('createSegment', () => {
    it('should create a new segment with calculated subscriber count', async () => {
      const segmentData = {
        name: 'New Segment',
        description: 'Test segment',
        conditions: {
          operator: 'AND' as const,
          rules: [
            {
              id: '1',
              field: 'status',
              operator: 'equals' as const,
              value: SubscriberStatus.ACTIVE,
            },
          ],
        },
      }

      const mockCreatedSegment = {
        id: '1',
        ...segmentData,
        subscriberCount: 50,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      // Mock subscriber count calculation
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(50)
      mockTenantPrisma.prisma.segment.create.mockResolvedValue(mockCreatedSegment)

      const result = await segmentService.createSegment(segmentData)

      expect(result).toEqual(mockCreatedSegment)
      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalled()
      expect(mockTenantPrisma.prisma.segment.create).toHaveBeenCalledWith({
        data: {
          name: segmentData.name,
          description: segmentData.description,
          conditions: segmentData.conditions,
          subscriberCount: 50,
          tenant: {
            connect: { id: tenantId },
          },
        },
      })
    })
  })

  describe('updateSegment', () => {
    it('should update a segment and recalculate subscriber count', async () => {
      const existingSegment = {
        id: '1',
        name: 'Old Name',
        description: 'Old description',
        conditions: { operator: 'AND', rules: [] },
        subscriberCount: 100,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      const updateData = {
        name: 'Updated Name',
        conditions: {
          operator: 'AND' as const,
          rules: [
            {
              id: '1',
              field: 'status',
              operator: 'equals' as const,
              value: SubscriberStatus.ACTIVE,
            },
          ],
        },
      }

      const updatedSegment = {
        ...existingSegment,
        ...updateData,
        subscriberCount: 75,
        lastUpdated: new Date(),
      }

      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(existingSegment)
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(75)
      mockTenantPrisma.prisma.segment.update.mockResolvedValue(updatedSegment)

      const result = await segmentService.updateSegment('1', updateData)

      expect(result).toEqual(updatedSegment)
      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalled()
    })

    it('should throw error if segment not found', async () => {
      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(null)

      await expect(segmentService.updateSegment('nonexistent', { name: 'Test' })).rejects.toThrow(
        'Segment not found'
      )
    })
  })

  describe('deleteSegment', () => {
    it('should delete a segment', async () => {
      const existingSegment = {
        id: '1',
        name: 'Test Segment',
        conditions: { operator: 'AND', rules: [] },
        subscriberCount: 100,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(existingSegment)
      mockTenantPrisma.prisma.segment.delete.mockResolvedValue(existingSegment)

      await segmentService.deleteSegment('1')

      expect(mockTenantPrisma.prisma.segment.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      })
    })

    it('should throw error if segment not found', async () => {
      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(null)

      await expect(segmentService.deleteSegment('nonexistent')).rejects.toThrow('Segment not found')
    })
  })

  describe('getSegmentSubscribers', () => {
    it('should return subscribers matching segment conditions', async () => {
      const mockSegment = {
        id: '1',
        name: 'Active Users',
        conditions: {
          operator: 'AND',
          rules: [
            {
              id: '1',
              field: 'status',
              operator: 'equals',
              value: SubscriberStatus.ACTIVE,
            },
          ],
        },
        subscriberCount: 100,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      const mockSubscribers = [
        {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          status: SubscriberStatus.ACTIVE,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lists: [],
        },
      ]

      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(mockSegment)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue(mockSubscribers)
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(1)

      const result = await segmentService.getSegmentSubscribers('1', { page: 1, limit: 20 })

      expect(result.subscribers).toEqual(mockSubscribers)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.totalPages).toBe(1)
    })
  })

  describe('calculateSegmentCount', () => {
    it('should calculate subscriber count for given conditions', async () => {
      const conditions: SegmentConditions = {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'status',
            operator: 'equals',
            value: SubscriberStatus.ACTIVE,
          },
        ],
      }

      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(150)

      const result = await segmentService.calculateSegmentCount(conditions)

      expect(result).toBe(150)
      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledWith({
        where: { AND: [{ status: SubscriberStatus.ACTIVE }] },
      })
    })

    it('should return 0 if calculation fails', async () => {
      const conditions: SegmentConditions = {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'status',
            operator: 'equals',
            value: SubscriberStatus.ACTIVE,
          },
        ],
      }

      mockTenantPrisma.prisma.subscriber.count.mockRejectedValue(new Error('Database error'))

      const result = await segmentService.calculateSegmentCount(conditions)

      expect(result).toBe(0)
    })
  })

  describe('getAvailableFields', () => {
    it('should return available fields including custom fields', async () => {
      const mockSubscribers = [
        {
          customFields: { age: 25, city: 'New York' },
        },
        {
          customFields: { age: 30, country: 'USA' },
        },
      ]

      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue(mockSubscribers)

      const result = await segmentService.getAvailableFields()

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'email', label: 'Email', type: 'string' }),
          expect.objectContaining({ key: 'firstName', label: 'First Name', type: 'string' }),
          expect.objectContaining({ key: 'status', label: 'Status', type: 'enum' }),
          expect.objectContaining({ key: 'custom_age', label: 'Custom: age', type: 'string' }),
          expect.objectContaining({ key: 'custom_city', label: 'Custom: city', type: 'string' }),
          expect.objectContaining({ key: 'custom_country', label: 'Custom: country', type: 'string' }),
        ])
      )
    })
  })

  describe('previewSegmentCount', () => {
    it('should return count and sample subscribers for preview', async () => {
      const conditions: SegmentConditions = {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'status',
            operator: 'equals',
            value: SubscriberStatus.ACTIVE,
          },
        ],
      }

      const mockSampleSubscribers = [
        {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          status: SubscriberStatus.ACTIVE,
          createdAt: new Date(),
        },
      ]

      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(100)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue(mockSampleSubscribers)

      const result = await segmentService.previewSegmentCount(conditions)

      expect(result.count).toBe(100)
      expect(result.sampleSubscribers).toEqual(mockSampleSubscribers)
    })
  })

  describe('refreshSegmentCount', () => {
    it('should refresh and update segment subscriber count', async () => {
      const existingSegment = {
        id: '1',
        name: 'Test Segment',
        conditions: {
          operator: 'AND',
          rules: [
            {
              id: '1',
              field: 'status',
              operator: 'equals',
              value: SubscriberStatus.ACTIVE,
            },
          ],
        },
        subscriberCount: 100,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId,
      }

      const updatedSegment = {
        ...existingSegment,
        subscriberCount: 120,
        lastUpdated: new Date(),
      }

      mockTenantPrisma.prisma.segment.findUnique.mockResolvedValue(existingSegment)
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(120)
      mockTenantPrisma.prisma.segment.update.mockResolvedValue(updatedSegment)

      const result = await segmentService.refreshSegmentCount('1')

      expect(result.subscriberCount).toBe(120)
      expect(mockTenantPrisma.prisma.segment.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          subscriberCount: 120,
          lastUpdated: expect.any(Date),
        },
      })
    })
  })
})