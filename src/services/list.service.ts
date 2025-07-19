import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus, type List, type ListWithDetails, type ListAnalytics, type PaginatedResponse } from '@/types'
import { Prisma } from '@/generated/prisma'

export interface CreateListData {
  name: string
  description?: string
}

export interface UpdateListData {
  name?: string
  description?: string
}

export interface ListFilters {
  search?: string
}

export interface ListQueryOptions {
  page?: number
  limit?: number
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  filters?: ListFilters
}

export interface BulkSubscriberOperation {
  subscriberIds: string[]
  operation: 'add' | 'remove'
}

export interface ListImportData {
  name: string
  description?: string
  subscribers: Array<{
    email: string
    firstName?: string
    lastName?: string
    customFields?: Record<string, any>
  }>
}

export class ListService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Get paginated list of lists
   */
  async getLists(options: ListQueryOptions = {}): Promise<PaginatedResponse<ListWithDetails>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = options

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Build where clause
    const where: Prisma.ListWhereInput = {}
    
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ]
    }

    // Get total count
    const total = await tenantPrisma.prisma.list.count({ where })
    
    // Get lists with pagination
    const lists = await tenantPrisma.prisma.list.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        subscribers: {
          include: {
            subscriber: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5 // Only get first 5 for preview
        },
        _count: {
          select: {
            subscribers: true
          }
        }
      }
    })

    const totalPages = Math.ceil(total / limit)

    return {
      data: lists as ListWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    }
  }

  /**
   * Get a single list by ID
   */
  async getListById(id: string): Promise<ListWithDetails | null> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const list = await tenantPrisma.prisma.list.findUnique({
      where: { id },
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
                updatedAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            subscribers: true
          }
        }
      }
    })

    return list as ListWithDetails | null
  }

  /**
   * Create a new list
   */
  async createList(data: CreateListData): Promise<ListWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if list with same name already exists
    const existingList = await tenantPrisma.prisma.list.findFirst({
      where: {
        name: data.name,
        tenantId: this.tenantId
      }
    })

    if (existingList) {
      throw new Error('List with this name already exists')
    }

    const list = await tenantPrisma.prisma.list.create({
      data: {
        ...data,
        tenant: {
          connect: { id: this.tenantId }
        }
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
                status: true
              }
            }
          }
        },
        _count: {
          select: {
            subscribers: true
          }
        }
      }
    })

    return list as ListWithDetails
  }

  /**
   * Update a list
   */
  async updateList(id: string, data: UpdateListData): Promise<ListWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if list exists
    const existingList = await this.getListById(id)
    if (!existingList) {
      throw new Error('List not found')
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== existingList.name) {
      const nameExists = await tenantPrisma.prisma.list.findFirst({
        where: {
          name: data.name,
          tenantId: this.tenantId,
          id: { not: id }
        }
      })
      if (nameExists) {
        throw new Error('List with this name already exists')
      }
    }

    const list = await tenantPrisma.prisma.list.update({
      where: { id },
      data,
      include: {
        subscribers: {
          include: {
            subscriber: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true
              }
            }
          }
        },
        _count: {
          select: {
            subscribers: true
          }
        }
      }
    })

    return list as ListWithDetails
  }

  /**
   * Delete a list
   */
  async deleteList(id: string): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if list exists
    const existingList = await this.getListById(id)
    if (!existingList) {
      throw new Error('List not found')
    }

    await tenantPrisma.prisma.list.delete({
      where: { id }
    })
  }

  /**
   * Duplicate a list
   */
  async duplicateList(id: string, newName: string): Promise<ListWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Get original list
    const originalList = await this.getListById(id)
    if (!originalList) {
      throw new Error('List not found')
    }

    // Check if new name already exists
    const nameExists = await tenantPrisma.prisma.list.findFirst({
      where: {
        name: newName,
        tenantId: this.tenantId
      }
    })
    if (nameExists) {
      throw new Error('List with this name already exists')
    }

    // Create new list
    const newList = await tenantPrisma.prisma.list.create({
      data: {
        name: newName,
        description: originalList.description,
        tenant: {
          connect: { id: this.tenantId }
        }
      }
    })

    // Copy all subscribers
    if (originalList.subscribers.length > 0) {
      const subscriberData = originalList.subscribers.map(sub => ({
        listId: newList.id,
        subscriberId: sub.subscriber.id
      }))

      await tenantPrisma.prisma.listSubscriber.createMany({
        data: subscriberData,
        skipDuplicates: true
      })
    }

    return this.getListById(newList.id) as Promise<ListWithDetails>
  }

  /**
   * Add subscribers to list (bulk operation)
   */
  async addSubscribersToList(listId: string, subscriberIds: string[]): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if list exists
    const list = await this.getListById(listId)
    if (!list) {
      throw new Error('List not found')
    }

    // Verify all subscribers exist and belong to tenant
    const subscribers = await tenantPrisma.prisma.subscriber.findMany({
      where: {
        id: { in: subscriberIds },
        tenantId: this.tenantId
      }
    })

    if (subscribers.length !== subscriberIds.length) {
      throw new Error('Some subscribers not found or do not belong to this tenant')
    }

    // Create list memberships
    const membershipData = subscriberIds.map(subscriberId => ({
      listId,
      subscriberId
    }))

    await tenantPrisma.prisma.listSubscriber.createMany({
      data: membershipData,
      skipDuplicates: true
    })
  }

  /**
   * Remove subscribers from list (bulk operation)
   */
  async removeSubscribersFromList(listId: string, subscriberIds: string[]): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    await tenantPrisma.prisma.listSubscriber.deleteMany({
      where: {
        listId,
        subscriberId: { in: subscriberIds }
      }
    })
  }

  /**
   * Get list analytics
   */
  async getListAnalytics(listId: string): Promise<ListAnalytics> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if list exists
    const list = await this.getListById(listId)
    if (!list) {
      throw new Error('List not found')
    }

    // Get subscriber counts by status
    const [
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      bouncedSubscribers,
      complainedSubscribers,
      invalidSubscribers
    ] = await Promise.all([
      tenantPrisma.prisma.listSubscriber.count({
        where: { listId }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          subscriber: { status: SubscriberStatus.ACTIVE }
        }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          subscriber: { status: SubscriberStatus.UNSUBSCRIBED }
        }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          subscriber: { status: SubscriberStatus.BOUNCED }
        }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          subscriber: { status: SubscriberStatus.COMPLAINED }
        }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          subscriber: { status: SubscriberStatus.INVALID }
        }
      })
    ])

    // Calculate growth rate (subscribers added in last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const [recentSubscribers, previousSubscribers] = await Promise.all([
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      tenantPrisma.prisma.listSubscriber.count({
        where: {
          listId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      })
    ])

    const growthRate = previousSubscribers > 0 
      ? ((recentSubscribers - previousSubscribers) / previousSubscribers) * 100 
      : recentSubscribers > 0 ? 100 : 0

    // Calculate engagement rate (based on email events in last 30 days)
    const engagementEvents = await tenantPrisma.prisma.emailEvent.count({
      where: {
        subscriberId: {
          in: list.subscribers.map(s => s.subscriber.id)
        },
        type: { in: ['OPENED', 'CLICKED'] },
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    const engagementRate = activeSubscribers > 0 
      ? (engagementEvents / activeSubscribers) * 100 
      : 0

    return {
      id: `analytics_${listId}`,
      listId,
      totalSubscribers,
      activeSubscribers,
      unsubscribedSubscribers,
      bouncedSubscribers,
      complainedSubscribers,
      invalidSubscribers,
      growthRate: Math.round(growthRate * 100) / 100,
      engagementRate: Math.round(engagementRate * 100) / 100,
      lastUpdated: new Date()
    }
  }

  /**
   * Import list from data
   */
  async importList(data: ListImportData): Promise<ListWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Create the list first
    const list = await this.createList({
      name: data.name,
      description: data.description
    })

    if (data.subscribers.length > 0) {
      // Process subscribers in batches to avoid memory issues
      const batchSize = 1000
      const batches = []
      
      for (let i = 0; i < data.subscribers.length; i += batchSize) {
        batches.push(data.subscribers.slice(i, i + batchSize))
      }

      for (const batch of batches) {
        // Create or update subscribers
        const subscriberPromises = batch.map(async (subData) => {
          // Try to find existing subscriber
          let subscriber = await tenantPrisma.prisma.subscriber.findUnique({
            where: {
              email_tenantId: {
                email: subData.email,
                tenantId: this.tenantId
              }
            }
          })

          // Create if doesn't exist
          if (!subscriber) {
            subscriber = await tenantPrisma.prisma.subscriber.create({
              data: {
                email: subData.email,
                firstName: subData.firstName,
                lastName: subData.lastName,
                customFields: subData.customFields,
                status: SubscriberStatus.ACTIVE,
                tenant: {
                  connect: { id: this.tenantId }
                }
              }
            })
          }

          return subscriber.id
        })

        const subscriberIds = await Promise.all(subscriberPromises)
        
        // Add to list
        await this.addSubscribersToList(list.id, subscriberIds)
      }
    }

    return this.getListById(list.id) as Promise<ListWithDetails>
  }

  /**
   * Export list data
   */
  async exportList(listId: string): Promise<{
    list: ListWithDetails
    subscribers: Array<{
      email: string
      firstName?: string | null
      lastName?: string | null
      status: SubscriberStatus
      customFields?: Record<string, any> | null
      addedToListAt: Date
    }>
  }> {
    const list = await this.getListById(listId)
    if (!list) {
      throw new Error('List not found')
    }

    const subscribers = list.subscribers.map(sub => ({
      email: sub.subscriber.email,
      firstName: sub.subscriber.firstName,
      lastName: sub.subscriber.lastName,
      status: sub.subscriber.status,
      customFields: (sub.subscriber as any).customFields || null,
      addedToListAt: sub.createdAt
    }))

    return {
      list,
      subscribers
    }
  }

  /**
   * Get list statistics
   */
  async getListStats(): Promise<{
    totalLists: number
    totalSubscribers: number
    averageListSize: number
    largestList: { name: string; size: number } | null
  }> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const [totalLists, totalSubscribers, listSizes] = await Promise.all([
      tenantPrisma.prisma.list.count(),
      tenantPrisma.prisma.listSubscriber.count(),
      tenantPrisma.prisma.list.findMany({
        select: {
          name: true,
          _count: {
            select: {
              subscribers: true
            }
          }
        },
        orderBy: {
          subscribers: {
            _count: 'desc'
          }
        },
        take: 1
      })
    ])

    const averageListSize = totalLists > 0 ? Math.round(totalSubscribers / totalLists) : 0
    const largestList = listSizes.length > 0 
      ? { name: listSizes[0].name, size: listSizes[0]._count.subscribers }
      : null

    return {
      totalLists,
      totalSubscribers,
      averageListSize,
      largestList
    }
  }
}