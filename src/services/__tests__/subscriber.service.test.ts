import { SubscriberService } from '../subscriber.service'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus } from '@/types'

// Mock the tenant prisma wrapper
jest.mock('@/lib/tenant/prisma-wrapper')

const mockTenantPrisma = {
  prisma: {
    subscriber: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    listSubscriber: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}

;(createTenantPrisma as jest.Mock).mockReturnValue(mockTenantPrisma)

describe('SubscriberService', () => {
  let subscriberService: SubscriberService
  const tenantId = 'test-tenant-id'

  beforeEach(() => {
    subscriberService = new SubscriberService(tenantId)
    jest.clearAllMocks()
  })

  describe('getSubscribers', () => {
    it('should return paginated subscribers with correct structure', async () => {
      const mockSubscribers = [
        {
          id: 'sub-1',
          email: 'test1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          status: SubscriberStatus.ACTIVE,
          customFields: { company: 'Test Corp' },
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lists: [
            {
              id: 'list-sub-1',
              list: { id: 'list-1', name: 'Newsletter' }
            }
          ],
          _count: { emailEvents: 5 },
        },
        {
          id: 'sub-2',
          email: 'test2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          status: SubscriberStatus.ACTIVE,
          customFields: null,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lists: [],
          _count: { emailEvents: 2 },
        },
      ]

      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(2)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue(mockSubscribers)

      const result = await subscriberService.getSubscribers({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result).toEqual({
        data: mockSubscribers,
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      })

      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledWith({ where: {} })
      expect(mockTenantPrisma.prisma.subscriber.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: {
              emailEvents: true
            }
          }
        }
      })
    })

    it('should handle search filters correctly', async () => {
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(0)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue([])

      await subscriberService.getSubscribers({
        filters: { search: 'john@example.com' },
      })

      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'john@example.com' } },
            { firstName: { contains: 'john@example.com' } },
            { lastName: { contains: 'john@example.com' } },
          ],
        },
      })
    })

    it('should handle status filters correctly', async () => {
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(0)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue([])

      await subscriberService.getSubscribers({
        filters: { status: SubscriberStatus.ACTIVE },
      })

      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledWith({
        where: {
          status: SubscriberStatus.ACTIVE,
        },
      })
    })

    it('should handle list filters correctly', async () => {
      mockTenantPrisma.prisma.subscriber.count.mockResolvedValue(0)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue([])

      await subscriberService.getSubscribers({
        filters: { listId: 'list-1' },
      })

      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledWith({
        where: {
          lists: {
            some: {
              listId: 'list-1'
            }
          }
        },
      })
    })
  })

  describe('getSubscriberById', () => {
    it('should return subscriber with full details', async () => {
      const mockSubscriber = {
        id: 'sub-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: SubscriberStatus.ACTIVE,
        customFields: { company: 'Test Corp' },
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lists: [
          {
            id: 'list-sub-1',
            list: { id: 'list-1', name: 'Newsletter' }
          }
        ],
        emailEvents: [
          {
            id: 'event-1',
            type: 'OPENED',
            createdAt: new Date(),
            campaign: { id: 'camp-1', name: 'Welcome', subject: 'Welcome!' }
          }
        ],
        _count: { emailEvents: 1 },
      }

      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(mockSubscriber)

      const result = await subscriberService.getSubscriberById('sub-1')

      expect(result).toEqual(mockSubscriber)
      expect(mockTenantPrisma.prisma.subscriber.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          },
          emailEvents: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              type: true,
              createdAt: true,
              campaign: {
                select: { id: true, name: true, subject: true }
              }
            }
          },
          _count: {
            select: {
              emailEvents: true
            }
          }
        }
      })
    })

    it('should return null for non-existent subscriber', async () => {
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(null)

      const result = await subscriberService.getSubscriberById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createSubscriber', () => {
    it('should create a new subscriber successfully', async () => {
      const createData = {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        status: SubscriberStatus.ACTIVE,
        customFields: { source: 'website' }
      }

      const mockCreatedSubscriber = {
        id: 'new-sub-id',
        ...createData,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lists: [],
        _count: { emailEvents: 0 },
      }

      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(null) // No existing subscriber
      mockTenantPrisma.prisma.subscriber.create.mockResolvedValue(mockCreatedSubscriber)

      const result = await subscriberService.createSubscriber(createData)

      expect(result).toEqual(mockCreatedSubscriber)
      expect(mockTenantPrisma.prisma.subscriber.findUnique).toHaveBeenCalledWith({
        where: {
          email_tenantId: {
            email: 'new@example.com',
            tenantId,
          }
        },
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: {
              emailEvents: true
            }
          }
        }
      })
      expect(mockTenantPrisma.prisma.subscriber.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          tenant: {
            connect: { id: tenantId }
          }
        },
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: {
              emailEvents: true
            }
          }
        }
      })
    })

    it('should throw error if subscriber already exists', async () => {
      const createData = {
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User'
      }

      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'existing@example.com',
        tenantId,
      })

      await expect(subscriberService.createSubscriber(createData)).rejects.toThrow(
        'Subscriber with this email already exists'
      )
    })
  })

  describe('updateSubscriber', () => {
    it('should update subscriber successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        customFields: { updated: true }
      }

      const existingSubscriber = {
        id: 'sub-1',
        email: 'test@example.com',
        firstName: 'Original',
        lastName: 'Name',
        status: SubscriberStatus.ACTIVE,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lists: [],
        _count: { emailEvents: 0 },
      }

      const updatedSubscriber = {
        ...existingSubscriber,
        ...updateData,
      }

      // Mock getSubscriberById call
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(existingSubscriber)
      // Mock update
      mockTenantPrisma.prisma.subscriber.update.mockResolvedValue(updatedSubscriber)

      const result = await subscriberService.updateSubscriber('sub-1', updateData)

      expect(result).toEqual(updatedSubscriber)
      expect(mockTenantPrisma.prisma.subscriber.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: updateData,
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: {
              emailEvents: true
            }
          }
        }
      })
    })

    it('should throw error if subscriber not found', async () => {
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(null)

      await expect(
        subscriberService.updateSubscriber('non-existent', { firstName: 'New Name' })
      ).rejects.toThrow('Subscriber not found')
    })
  })

  describe('deleteSubscriber', () => {
    it('should delete subscriber successfully', async () => {
      const existingSubscriber = {
        id: 'sub-1',
        email: 'test@example.com',
        tenantId,
        lists: [],
        _count: { emailEvents: 0 },
      }

      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(existingSubscriber)
      mockTenantPrisma.prisma.subscriber.delete.mockResolvedValue(existingSubscriber)

      await subscriberService.deleteSubscriber('sub-1')

      expect(mockTenantPrisma.prisma.subscriber.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      })
    })

    it('should throw error if subscriber not found', async () => {
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(null)

      await expect(subscriberService.deleteSubscriber('non-existent')).rejects.toThrow(
        'Subscriber not found'
      )
    })
  })

  describe('getSubscriberStats', () => {
    it('should return comprehensive subscriber statistics', async () => {
      mockTenantPrisma.prisma.subscriber.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(800)  // active
        .mockResolvedValueOnce(150)  // unsubscribed
        .mockResolvedValueOnce(30)   // bounced
        .mockResolvedValueOnce(15)   // complained
        .mockResolvedValueOnce(5)    // invalid

      const result = await subscriberService.getSubscriberStats()

      expect(result).toEqual({
        total: 1000,
        active: 800,
        unsubscribed: 150,
        bounced: 30,
        complained: 15,
        invalid: 5,
      })

      expect(mockTenantPrisma.prisma.subscriber.count).toHaveBeenCalledTimes(6)
    })
  })

  describe('addToList', () => {
    it('should add subscriber to list successfully', async () => {
      const subscriberId = 'sub-1'
      const listId = 'list-1'

      const mockSubscriber = {
        id: subscriberId,
        email: 'test@example.com',
        lists: [],
        _count: { emailEvents: 0 },
      }

      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(mockSubscriber)
      mockTenantPrisma.prisma.listSubscriber.findUnique.mockResolvedValue(null) // Not already in list
      mockTenantPrisma.prisma.listSubscriber.create.mockResolvedValue({
        id: 'membership-1',
        listId,
        subscriberId,
        createdAt: new Date()
      })

      await subscriberService.addToList(subscriberId, listId)

      expect(mockTenantPrisma.prisma.listSubscriber.create).toHaveBeenCalledWith({
        data: {
          listId,
          subscriberId
        }
      })
    })

    it('should throw error if subscriber not found', async () => {
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(null)

      await expect(
        subscriberService.addToList('non-existent', 'list-1')
      ).rejects.toThrow('Subscriber not found')
    })

    it('should throw error if subscriber already in list', async () => {
      const mockSubscriber = { id: 'sub-1', email: 'test@example.com' }
      mockTenantPrisma.prisma.subscriber.findUnique.mockResolvedValue(mockSubscriber)
      mockTenantPrisma.prisma.listSubscriber.findUnique.mockResolvedValue({
        id: 'existing-membership',
        listId: 'list-1',
        subscriberId: 'sub-1'
      })

      await expect(
        subscriberService.addToList('sub-1', 'list-1')
      ).rejects.toThrow('Subscriber is already in this list')
    })
  })
})