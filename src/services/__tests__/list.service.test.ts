import { ListService } from '../list.service'
import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus } from '@/types'

// Mock the tenant prisma wrapper
jest.mock('@/lib/tenant/prisma-wrapper')

const mockTenantPrisma = {
  prisma: {
    list: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscriber: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    listSubscriber: {
      count: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    emailEvent: {
      count: jest.fn(),
    },
  },
}

;(createTenantPrisma as jest.Mock).mockReturnValue(mockTenantPrisma)

describe('ListService', () => {
  let listService: ListService
  const tenantId = 'test-tenant-id'

  beforeEach(() => {
    listService = new ListService(tenantId)
    jest.clearAllMocks()
  })

  describe('getLists', () => {
    it('should return paginated lists with correct structure', async () => {
      const mockLists = [
        {
          id: 'list-1',
          name: 'Test List 1',
          description: 'Test description',
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscribers: [],
          _count: { subscribers: 5 },
        },
        {
          id: 'list-2',
          name: 'Test List 2',
          description: null,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscribers: [],
          _count: { subscribers: 10 },
        },
      ]

      mockTenantPrisma.prisma.list.count.mockResolvedValue(2)
      mockTenantPrisma.prisma.list.findMany.mockResolvedValue(mockLists)

      const result = await listService.getLists({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result).toEqual({
        data: mockLists,
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      })

      expect(mockTenantPrisma.prisma.list.count).toHaveBeenCalledWith({ where: {} })
      expect(mockTenantPrisma.prisma.list.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          subscribers: {
            include: {
              subscriber: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
      })
    })

    it('should handle search filters correctly', async () => {
      mockTenantPrisma.prisma.list.count.mockResolvedValue(0)
      mockTenantPrisma.prisma.list.findMany.mockResolvedValue([])

      await listService.getLists({
        filters: { search: 'test search' },
      })

      expect(mockTenantPrisma.prisma.list.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'test search' } },
            { description: { contains: 'test search' } },
          ],
        },
      })
    })
  })

  describe('getListById', () => {
    it('should return list with full details', async () => {
      const mockList = {
        id: 'list-1',
        name: 'Test List',
        description: 'Test description',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscribers: [
          {
            id: 'sub-1',
            subscriber: {
              id: 'subscriber-1',
              email: 'test@example.com',
              firstName: 'John',
              lastName: 'Doe',
              status: SubscriberStatus.ACTIVE,
              customFields: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
          },
        ],
        _count: { subscribers: 1 },
      }

      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(mockList)

      const result = await listService.getListById('list-1')

      expect(result).toEqual(mockList)
      expect(mockTenantPrisma.prisma.list.findUnique).toHaveBeenCalledWith({
        where: { id: 'list-1' },
        include: {
          subscribers: {
            include: {
              subscriber: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                  customFields: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
      })
    })

    it('should return null for non-existent list', async () => {
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(null)

      const result = await listService.getListById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createList', () => {
    it('should create a new list successfully', async () => {
      const createData = {
        name: 'New List',
        description: 'New description',
      }

      const mockCreatedList = {
        id: 'new-list-id',
        ...createData,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscribers: [],
        _count: { subscribers: 0 },
      }

      mockTenantPrisma.prisma.list.findFirst.mockResolvedValue(null) // No existing list
      mockTenantPrisma.prisma.list.create.mockResolvedValue(mockCreatedList)

      const result = await listService.createList(createData)

      expect(result).toEqual(mockCreatedList)
      expect(mockTenantPrisma.prisma.list.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'New List',
          tenantId,
        },
      })
      expect(mockTenantPrisma.prisma.list.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          tenant: {
            connect: { id: tenantId },
          },
        },
        include: {
          subscribers: {
            include: {
              subscriber: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
      })
    })

    it('should throw error if list name already exists', async () => {
      const createData = {
        name: 'Existing List',
        description: 'Description',
      }

      mockTenantPrisma.prisma.list.findFirst.mockResolvedValue({
        id: 'existing-id',
        name: 'Existing List',
        tenantId,
      })

      await expect(listService.createList(createData)).rejects.toThrow(
        'List with this name already exists'
      )
    })
  })

  describe('updateList', () => {
    it('should update list successfully', async () => {
      const updateData = {
        name: 'Updated List',
        description: 'Updated description',
      }

      const existingList = {
        id: 'list-1',
        name: 'Original List',
        description: 'Original description',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscribers: [],
        _count: { subscribers: 0 },
      }

      const updatedList = {
        ...existingList,
        ...updateData,
      }

      // Mock getListById call
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(existingList)
      // Mock name check
      mockTenantPrisma.prisma.list.findFirst.mockResolvedValue(null)
      // Mock update
      mockTenantPrisma.prisma.list.update.mockResolvedValue(updatedList)

      const result = await listService.updateList('list-1', updateData)

      expect(result).toEqual(updatedList)
      expect(mockTenantPrisma.prisma.list.update).toHaveBeenCalledWith({
        where: { id: 'list-1' },
        data: updateData,
        include: {
          subscribers: {
            include: {
              subscriber: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
      })
    })

    it('should throw error if list not found', async () => {
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(null)

      await expect(
        listService.updateList('non-existent', { name: 'New Name' })
      ).rejects.toThrow('List not found')
    })
  })

  describe('deleteList', () => {
    it('should delete list successfully', async () => {
      const existingList = {
        id: 'list-1',
        name: 'Test List',
        tenantId,
        subscribers: [],
        _count: { subscribers: 0 },
      }

      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(existingList)
      mockTenantPrisma.prisma.list.delete.mockResolvedValue(existingList)

      await listService.deleteList('list-1')

      expect(mockTenantPrisma.prisma.list.delete).toHaveBeenCalledWith({
        where: { id: 'list-1' },
      })
    })

    it('should throw error if list not found', async () => {
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(null)

      await expect(listService.deleteList('non-existent')).rejects.toThrow(
        'List not found'
      )
    })
  })

  describe('addSubscribersToList', () => {
    it('should add subscribers to list successfully', async () => {
      const listId = 'list-1'
      const subscriberIds = ['sub-1', 'sub-2']

      const mockList = {
        id: listId,
        name: 'Test List',
        subscribers: [],
        _count: { subscribers: 0 },
      }

      const mockSubscribers = [
        { id: 'sub-1', email: 'test1@example.com', tenantId },
        { id: 'sub-2', email: 'test2@example.com', tenantId },
      ]

      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(mockList)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue(mockSubscribers)
      mockTenantPrisma.prisma.listSubscriber.createMany.mockResolvedValue({ count: 2 })

      await listService.addSubscribersToList(listId, subscriberIds)

      expect(mockTenantPrisma.prisma.subscriber.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: subscriberIds },
          tenantId,
        },
      })
      expect(mockTenantPrisma.prisma.listSubscriber.createMany).toHaveBeenCalledWith({
        data: [
          { listId, subscriberId: 'sub-1' },
          { listId, subscriberId: 'sub-2' },
        ],
        skipDuplicates: true,
      })
    })

    it('should throw error if list not found', async () => {
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(null)

      await expect(
        listService.addSubscribersToList('non-existent', ['sub-1'])
      ).rejects.toThrow('List not found')
    })

    it('should throw error if some subscribers not found', async () => {
      const mockList = { id: 'list-1', name: 'Test List' }
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(mockList)
      mockTenantPrisma.prisma.subscriber.findMany.mockResolvedValue([
        { id: 'sub-1', tenantId },
      ]) // Only 1 subscriber found, but 2 requested

      await expect(
        listService.addSubscribersToList('list-1', ['sub-1', 'sub-2'])
      ).rejects.toThrow('Some subscribers not found or do not belong to this tenant')
    })
  })

  describe('getListAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const listId = 'list-1'
      const mockList = {
        id: listId,
        name: 'Test List',
        subscribers: [
          { subscriber: { id: 'sub-1' } },
          { subscriber: { id: 'sub-2' } },
        ],
      }

      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(mockList)

      // Mock all the count queries
      mockTenantPrisma.prisma.listSubscriber.count
        .mockResolvedValueOnce(100) // totalSubscribers
        .mockResolvedValueOnce(80) // activeSubscribers
        .mockResolvedValueOnce(10) // unsubscribedSubscribers
        .mockResolvedValueOnce(5) // bouncedSubscribers
        .mockResolvedValueOnce(3) // complainedSubscribers
        .mockResolvedValueOnce(2) // invalidSubscribers
        .mockResolvedValueOnce(15) // recentSubscribers (last 30 days)
        .mockResolvedValueOnce(10) // previousSubscribers (30-60 days ago)

      mockTenantPrisma.prisma.emailEvent.count.mockResolvedValue(40) // engagement events

      const result = await listService.getListAnalytics(listId)

      expect(result).toEqual({
        id: `analytics_${listId}`,
        listId,
        totalSubscribers: 100,
        activeSubscribers: 80,
        unsubscribedSubscribers: 10,
        bouncedSubscribers: 5,
        complainedSubscribers: 3,
        invalidSubscribers: 2,
        growthRate: 50, // (15-10)/10 * 100
        engagementRate: 50, // 40/80 * 100
        lastUpdated: expect.any(Date),
      })
    })

    it('should throw error if list not found', async () => {
      mockTenantPrisma.prisma.list.findUnique.mockResolvedValue(null)

      await expect(listService.getListAnalytics('non-existent')).rejects.toThrow(
        'List not found'
      )
    })
  })
})