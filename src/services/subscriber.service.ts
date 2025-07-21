import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { triggerService } from './trigger.service'
import { SubscriberStatus, type Subscriber, type PaginatedResponse } from '@/types'
import { Prisma } from '@/generated/prisma'

export interface CreateSubscriberData {
  email: string
  firstName?: string
  lastName?: string
  status?: SubscriberStatus
  customFields?: Record<string, any>
}

export interface UpdateSubscriberData {
  email?: string
  firstName?: string
  lastName?: string
  status?: SubscriberStatus
  customFields?: Record<string, any>
}

export interface SubscriberFilters {
  search?: string
  status?: SubscriberStatus
  listId?: string
  segmentId?: string
}

export interface SubscriberQueryOptions {
  page?: number
  limit?: number
  sortBy?: 'email' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  filters?: SubscriberFilters
}

export interface SubscriberWithDetails extends Subscriber {
  lists: Array<{
    id: string
    list: {
      id: string
      name: string
    }
  }>
  emailEvents?: Array<{
    id: string
    type: string
    createdAt: Date
    campaign?: {
      id: string
      name: string
      subject: string
    }
  }>
  _count?: {
    emailEvents: number
  }
}

export class SubscriberService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Get paginated list of subscribers
   */
  async getSubscribers(options: SubscriberQueryOptions = {}): Promise<PaginatedResponse<SubscriberWithDetails>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = options

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Build where clause
    const where: Prisma.SubscriberWhereInput = {}
    
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search } },
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
      ]
    }
    
    if (filters.status) {
      where.status = filters.status
    }

    if (filters.listId) {
      where.lists = {
        some: {
          listId: filters.listId
        }
      }
    }

    // Get total count
    const total = await tenantPrisma.prisma.subscriber.count({ where })
    
    // Get subscribers with pagination
    const subscribers = await tenantPrisma.prisma.subscriber.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
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

    const totalPages = Math.ceil(total / limit)

    return {
      data: subscribers as SubscriberWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    }
  }

  /**
   * Get a single subscriber by ID
   */
  async getSubscriberById(id: string): Promise<SubscriberWithDetails | null> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const subscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: { id },
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

    return subscriber as SubscriberWithDetails | null
  }

  /**
   * Get a subscriber by email
   */
  async getSubscriberByEmail(email: string): Promise<SubscriberWithDetails | null> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const subscriber = await tenantPrisma.prisma.subscriber.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId: this.tenantId
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

    return subscriber as SubscriberWithDetails | null
  }

  /**
   * Create a new subscriber
   */
  async createSubscriber(data: CreateSubscriberData): Promise<SubscriberWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if subscriber already exists
    const existingSubscriber = await this.getSubscriberByEmail(data.email)
    if (existingSubscriber) {
      throw new Error('Subscriber with this email already exists')
    }

    const subscriber = await tenantPrisma.prisma.subscriber.create({
      data: {
        ...data,
        status: data.status || SubscriberStatus.ACTIVE,
        tenant: {
          connect: { id: this.tenantId }
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

    // Trigger subscription automation
    try {
      await triggerService.handleSubscriptionTrigger(
        this.tenantId,
        subscriber.id,
        'general' // Default list for new subscribers
      )
    } catch (error) {
      console.error('Error triggering subscription automation:', error)
      // Don't fail subscriber creation if trigger fails
    }

    return subscriber as SubscriberWithDetails
  }

  /**
   * Update a subscriber
   */
  async updateSubscriber(id: string, data: UpdateSubscriberData): Promise<SubscriberWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if subscriber exists
    const existingSubscriber = await this.getSubscriberById(id)
    if (!existingSubscriber) {
      throw new Error('Subscriber not found')
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== existingSubscriber.email) {
      const emailExists = await this.getSubscriberByEmail(data.email)
      if (emailExists) {
        throw new Error('Subscriber with this email already exists')
      }
    }

    // Track custom field changes for triggers
    const customFieldChanges: Array<{
      fieldName: string;
      oldValue: any;
      newValue: any;
    }> = [];

    if (data.customFields && existingSubscriber.customFields) {
      const oldFields = existingSubscriber.customFields as Record<string, any>;
      const newFields = data.customFields;

      for (const [fieldName, newValue] of Object.entries(newFields)) {
        const oldValue = oldFields[fieldName];
        if (oldValue !== newValue) {
          customFieldChanges.push({ fieldName, oldValue, newValue });
        }
      }
    }

    const subscriber = await tenantPrisma.prisma.subscriber.update({
      where: { id },
      data,
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

    // Trigger custom field change automations
    try {
      for (const change of customFieldChanges) {
        await triggerService.handleCustomFieldChangedTrigger(
          this.tenantId,
          id,
          change.fieldName,
          change.oldValue,
          change.newValue
        );
      }
    } catch (error) {
      console.error('Error triggering custom field change automation:', error);
      // Don't fail subscriber update if trigger fails
    }

    return subscriber as SubscriberWithDetails
  }

  /**
   * Delete a subscriber
   */
  async deleteSubscriber(id: string): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if subscriber exists
    const existingSubscriber = await this.getSubscriberById(id)
    if (!existingSubscriber) {
      throw new Error('Subscriber not found')
    }

    await tenantPrisma.prisma.subscriber.delete({
      where: { id }
    })
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats(): Promise<{
    total: number
    active: number
    unsubscribed: number
    bounced: number
    complained: number
    invalid: number
  }> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const [total, active, unsubscribed, bounced, complained, invalid] = await Promise.all([
      tenantPrisma.prisma.subscriber.count(),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.ACTIVE } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.UNSUBSCRIBED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.BOUNCED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.COMPLAINED } }),
      tenantPrisma.prisma.subscriber.count({ where: { status: SubscriberStatus.INVALID } }),
    ])

    return {
      total,
      active,
      unsubscribed,
      bounced,
      complained,
      invalid,
    }
  }

  /**
   * Add subscriber to list
   */
  async addToList(subscriberId: string, listId: string): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if subscriber exists
    const subscriber = await this.getSubscriberById(subscriberId)
    if (!subscriber) {
      throw new Error('Subscriber not found')
    }

    // Check if already in list
    const existingMembership = await tenantPrisma.prisma.listSubscriber.findUnique({
      where: {
        listId_subscriberId: {
          listId,
          subscriberId
        }
      }
    })

    if (existingMembership) {
      throw new Error('Subscriber is already in this list')
    }

    await tenantPrisma.prisma.listSubscriber.create({
      data: {
        listId,
        subscriberId
      }
    })

    // Trigger list joined automation
    try {
      await triggerService.handleListJoinedTrigger(
        this.tenantId,
        subscriberId,
        listId
      );
    } catch (error) {
      console.error('Error triggering list joined automation:', error);
      // Don't fail list addition if trigger fails
    }
  }

  /**
   * Remove subscriber from list
   */
  async removeFromList(subscriberId: string, listId: string): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    await tenantPrisma.prisma.listSubscriber.deleteMany({
      where: {
        listId,
        subscriberId
      }
    })
  }

  /**
   * Update subscriber custom fields
   */
  async updateCustomFields(id: string, customFields: Record<string, any>): Promise<SubscriberWithDetails> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const subscriber = await tenantPrisma.prisma.subscriber.update({
      where: { id },
      data: { customFields },
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

    return subscriber as SubscriberWithDetails
  }
}