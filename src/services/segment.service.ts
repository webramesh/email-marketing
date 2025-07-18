import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { SubscriberStatus, PaginatedResponse } from '@/types'

export interface SegmentCondition {
  id: string
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'between' | 'not_between'
  value?: any
  secondValue?: any // For between operations
}

export interface SegmentConditionGroup {
  id: string
  operator: 'AND' | 'OR'
  conditions: SegmentCondition[]
  groups?: SegmentConditionGroup[]
}

export interface SegmentConditions {
  operator: 'AND' | 'OR'
  rules: SegmentCondition[]
  groups?: SegmentConditionGroup[]
}

export interface CreateSegmentData {
  name: string
  description?: string
  conditions: SegmentConditions
}

export interface UpdateSegmentData {
  name?: string
  description?: string
  conditions?: SegmentConditions
}

export interface Segment {
  id: string
  name: string
  description?: string | null
  conditions: any
  subscriberCount: number
  lastUpdated: Date
  createdAt: Date
  updatedAt: Date
  tenantId: string
}

export interface SegmentPerformance {
  segmentId: string
  totalSubscribers: number
  activeSubscribers: number
  engagementRate: number
  openRate: number
  clickRate: number
  unsubscribeRate: number
  bounceRate: number
  lastCalculated: Date
}

export interface SegmentAnalytics {
  segment: Segment
  performance: SegmentPerformance
  subscriberGrowth: Array<{
    date: Date
    count: number
  }>
  engagementTrends: Array<{
    date: Date
    opens: number
    clicks: number
    unsubscribes: number
  }>
}

export interface SegmentField {
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum'
  options?: Array<{ value: any; label: string }>
  operators: string[]
}

export class SegmentService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Get all segments
   */
  async getSegments(): Promise<Segment[]> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const segments = await tenantPrisma.prisma.segment.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return segments as Segment[]
  }

  /**
   * Get a segment by ID
   */
  async getSegmentById(id: string): Promise<Segment | null> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const segment = await tenantPrisma.prisma.segment.findUnique({
      where: { id }
    })

    return segment as Segment | null
  }

  /**
   * Create a new segment
   */
  async createSegment(data: CreateSegmentData): Promise<Segment> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Calculate initial subscriber count
    const subscriberCount = await this.calculateSegmentCount(data.conditions)

    const segment = await tenantPrisma.prisma.segment.create({
      data: {
        name: data.name,
        description: data.description,
        conditions: data.conditions as any,
        subscriberCount,
        tenant: {
          connect: { id: this.tenantId }
        }
      }
    })

    return segment as Segment
  }

  /**
   * Update a segment
   */
  async updateSegment(id: string, data: UpdateSegmentData): Promise<Segment> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if segment exists
    const existingSegment = await this.getSegmentById(id)
    if (!existingSegment) {
      throw new Error('Segment not found')
    }

    // Calculate new subscriber count if conditions changed
    let subscriberCount = existingSegment.subscriberCount
    if (data.conditions) {
      subscriberCount = await this.calculateSegmentCount(data.conditions)
    }

    const updateData: any = {
      subscriberCount,
      lastUpdated: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.conditions !== undefined) updateData.conditions = data.conditions

    const segment = await tenantPrisma.prisma.segment.update({
      where: { id },
      data: updateData
    })

    return segment as Segment
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string): Promise<void> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Check if segment exists
    const existingSegment = await this.getSegmentById(id)
    if (!existingSegment) {
      throw new Error('Segment not found')
    }

    await tenantPrisma.prisma.segment.delete({
      where: { id }
    })
  }

  /**
   * Get subscribers that match a segment
   */
  async getSegmentSubscribers(id: string, options: {
    page?: number
    limit?: number
  } = {}): Promise<{
    subscribers: any[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const segment = await this.getSegmentById(id)
    if (!segment) {
      throw new Error('Segment not found')
    }

    const { page = 1, limit = 20 } = options
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const where = this.buildSegmentWhereClause(segment.conditions)
    
    const [subscribers, total] = await Promise.all([
      tenantPrisma.prisma.subscriber.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lists: {
            include: {
              list: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }),
      tenantPrisma.prisma.subscriber.count({ where })
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      subscribers,
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * Calculate subscriber count for a segment
   */
  async calculateSegmentCount(conditions: SegmentConditions): Promise<number> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    try {
      const where = this.buildSegmentWhereClause(conditions)
      const count = await tenantPrisma.prisma.subscriber.count({ where })
      return count
    } catch (error) {
      console.error('Error calculating segment count:', error)
      return 0
    }
  }

  /**
   * Refresh subscriber counts for all segments
   */
  async refreshAllSegmentCounts(): Promise<void> {
    const segments = await this.getSegments()
    const tenantPrisma = createTenantPrisma(this.tenantId)

    for (const segment of segments) {
      try {
        const count = await this.calculateSegmentCount(segment.conditions)
        await tenantPrisma.prisma.segment.update({
          where: { id: segment.id },
          data: {
            subscriberCount: count,
            lastUpdated: new Date(),
          }
        })
      } catch (error) {
        console.error(`Error refreshing count for segment ${segment.id}:`, error)
      }
    }
  }

  /**
   * Get segment analytics with performance metrics
   */
  async getSegmentAnalytics(id: string): Promise<SegmentAnalytics> {
    const segment = await this.getSegmentById(id)
    if (!segment) {
      throw new Error('Segment not found')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    const where = this.buildSegmentWhereClause(segment.conditions)

    // Get performance metrics
    const [
      totalSubscribers,
      activeSubscribers,
      emailEvents,
      subscriberGrowth
    ] = await Promise.all([
      tenantPrisma.prisma.subscriber.count({ where }),
      tenantPrisma.prisma.subscriber.count({ 
        where: { ...where, status: SubscriberStatus.ACTIVE } 
      }),
      tenantPrisma.prisma.emailEvent.findMany({
        where: {
          subscriber: { ...where },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        },
        select: {
          type: true,
          createdAt: true
        }
      }),
      this.getSubscriberGrowthData(where)
    ])

    // Calculate engagement metrics
    const opens = emailEvents.filter(e => e.type === 'OPENED').length
    const clicks = emailEvents.filter(e => e.type === 'CLICKED').length
    const unsubscribes = emailEvents.filter(e => e.type === 'UNSUBSCRIBED').length
    const bounces = emailEvents.filter(e => e.type === 'BOUNCED').length
    const sent = emailEvents.filter(e => e.type === 'SENT').length

    const openRate = sent > 0 ? (opens / sent) * 100 : 0
    const clickRate = sent > 0 ? (clicks / sent) * 100 : 0
    const unsubscribeRate = sent > 0 ? (unsubscribes / sent) * 100 : 0
    const bounceRate = sent > 0 ? (bounces / sent) * 100 : 0
    const engagementRate = sent > 0 ? ((opens + clicks) / sent) * 100 : 0

    const performance: SegmentPerformance = {
      segmentId: id,
      totalSubscribers,
      activeSubscribers,
      engagementRate,
      openRate,
      clickRate,
      unsubscribeRate,
      bounceRate,
      lastCalculated: new Date()
    }

    const engagementTrends = this.calculateEngagementTrends(emailEvents)

    return {
      segment,
      performance,
      subscriberGrowth,
      engagementTrends
    }
  }

  /**
   * Get available fields for segment building
   */
  async getAvailableFields(): Promise<SegmentField[]> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Get custom fields from existing subscribers
    const customFieldsData = await tenantPrisma.prisma.subscriber.findMany({
      select: { customFields: true },
      take: 100 // Sample to get field structure
    })

    const customFields = new Set<string>()
    customFieldsData.forEach(subscriber => {
      if (subscriber.customFields && typeof subscriber.customFields === 'object') {
        Object.keys(subscriber.customFields).forEach(key => customFields.add(key))
      }
    })

    const baseFields: SegmentField[] = [
      {
        key: 'email',
        label: 'Email',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        key: 'firstName',
        label: 'First Name',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        key: 'lastName',
        label: 'Last Name',
        type: 'string',
        operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
      },
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        options: [
          { value: SubscriberStatus.ACTIVE, label: 'Active' },
          { value: SubscriberStatus.UNSUBSCRIBED, label: 'Unsubscribed' },
          { value: SubscriberStatus.BOUNCED, label: 'Bounced' },
          { value: SubscriberStatus.COMPLAINED, label: 'Complained' },
          { value: SubscriberStatus.INVALID, label: 'Invalid' }
        ],
        operators: ['equals', 'not_equals', 'in', 'not_in']
      },
      {
        key: 'createdAt',
        label: 'Created Date',
        type: 'date',
        operators: ['equals', 'greater_than', 'less_than', 'between']
      },
      {
        key: 'updatedAt',
        label: 'Updated Date',
        type: 'date',
        operators: ['equals', 'greater_than', 'less_than', 'between']
      }
    ]

    // Add custom fields
    const customFieldsList: SegmentField[] = Array.from(customFields).map(field => ({
      key: `custom_${field}`,
      label: `Custom: ${field}`,
      type: 'string', // Default to string, could be enhanced to detect type
      operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']
    }))

    return [...baseFields, ...customFieldsList]
  }

  /**
   * Preview segment count without saving
   */
  async previewSegmentCount(conditions: SegmentConditions): Promise<{
    count: number
    sampleSubscribers: any[]
  }> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    const where = this.buildSegmentWhereClause(conditions)

    const [count, sampleSubscribers] = await Promise.all([
      tenantPrisma.prisma.subscriber.count({ where }),
      tenantPrisma.prisma.subscriber.findMany({
        where,
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true
        }
      })
    ])

    return { count, sampleSubscribers }
  }

  /**
   * Get segments with pagination
   */
  async getSegmentsPaginated(options: {
    page?: number
    limit?: number
    search?: string
  } = {}): Promise<PaginatedResponse<Segment>> {
    const { page = 1, limit = 20, search } = options
    const tenantPrisma = createTenantPrisma(this.tenantId)

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ]
    }

    const [segments, total] = await Promise.all([
      tenantPrisma.prisma.segment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      tenantPrisma.prisma.segment.count({ where })
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      data: segments as Segment[],
      meta: {
        total,
        page,
        limit,
        totalPages
      }
    }
  }

  /**
   * Real-time segment update - refresh count for specific segment
   */
  async refreshSegmentCount(id: string): Promise<Segment> {
    const segment = await this.getSegmentById(id)
    if (!segment) {
      throw new Error('Segment not found')
    }

    const newCount = await this.calculateSegmentCount(segment.conditions)
    const tenantPrisma = createTenantPrisma(this.tenantId)

    const updatedSegment = await tenantPrisma.prisma.segment.update({
      where: { id },
      data: {
        subscriberCount: newCount,
        lastUpdated: new Date()
      }
    })

    return updatedSegment as Segment
  }

  /**
   * Get subscriber growth data for analytics
   */
  private async getSubscriberGrowthData(where: any): Promise<Array<{ date: Date; count: number }>> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Get daily subscriber counts for the last 30 days
    const growthData: Array<{ date: Date; count: number }> = []
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      date.setHours(23, 59, 59, 999)
      
      const count = await tenantPrisma.prisma.subscriber.count({
        where: {
          ...where,
          createdAt: { lte: date }
        }
      })
      
      growthData.push({ date, count })
    }

    return growthData
  }

  /**
   * Calculate engagement trends from email events
   */
  private calculateEngagementTrends(emailEvents: Array<{ type: string; createdAt: Date }>): Array<{
    date: Date
    opens: number
    clicks: number
    unsubscribes: number
  }> {
    const trends: Map<string, { opens: number; clicks: number; unsubscribes: number }> = new Map()

    emailEvents.forEach(event => {
      const dateKey = event.createdAt.toISOString().split('T')[0]
      const existing = trends.get(dateKey) || { opens: 0, clicks: 0, unsubscribes: 0 }

      switch (event.type) {
        case 'OPENED':
          existing.opens++
          break
        case 'CLICKED':
          existing.clicks++
          break
        case 'UNSUBSCRIBED':
          existing.unsubscribes++
          break
      }

      trends.set(dateKey, existing)
    })

    return Array.from(trends.entries()).map(([dateStr, data]) => ({
      date: new Date(dateStr),
      ...data
    })).sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  /**
   * Build Prisma where clause from segment conditions
   */
  private buildSegmentWhereClause(conditions: SegmentConditions): any {
    if (!conditions || !conditions.rules || conditions.rules.length === 0) {
      return {}
    }

    const rules = conditions.rules.map((rule) => {
      const { field, operator, value, secondValue } = rule

      switch (field) {
        case 'email':
          return this.buildStringCondition('email', operator, value, secondValue)
        case 'firstName':
          return this.buildStringCondition('firstName', operator, value, secondValue)
        case 'lastName':
          return this.buildStringCondition('lastName', operator, value, secondValue)
        case 'status':
          return this.buildEnumCondition('status', operator, value)
        case 'createdAt':
          return this.buildDateCondition('createdAt', operator, value, secondValue)
        case 'updatedAt':
          return this.buildDateCondition('updatedAt', operator, value, secondValue)
        default:
          // Handle custom fields
          if (field.startsWith('custom_')) {
            const customFieldName = field.replace('custom_', '')
            return this.buildCustomFieldCondition(customFieldName, operator, value, secondValue)
          }
          return {}
      }
    })

    // Handle nested groups
    const groupRules = conditions.groups?.map(group => {
      // Convert SegmentConditionGroup to SegmentConditions format
      const groupConditions: SegmentConditions = {
        operator: group.operator,
        rules: group.conditions,
        groups: group.groups
      }
      return this.buildSegmentWhereClause(groupConditions)
    }) || []

    // Filter out empty rules
    const validRules = [...rules, ...groupRules].filter(rule => 
      rule && Object.keys(rule).length > 0
    )

    if (validRules.length === 0) {
      return {}
    }

    if (conditions.operator === 'OR') {
      return { OR: validRules }
    } else {
      return { AND: validRules }
    }
  }

  private buildStringCondition(field: string, operator: string, value: any, secondValue?: any): any {
    if (!value && operator !== 'is_empty' && operator !== 'is_not_empty') {
      return {}
    }

    switch (operator) {
      case 'equals':
        return { [field]: value }
      case 'not_equals':
        return { [field]: { not: value } }
      case 'contains':
        return { [field]: { contains: value } }
      case 'not_contains':
        return { [field]: { not: { contains: value } } }
      case 'starts_with':
        return { [field]: { startsWith: value } }
      case 'ends_with':
        return { [field]: { endsWith: value } }
      case 'is_empty':
        return { OR: [{ [field]: null }, { [field]: '' }] }
      case 'is_not_empty':
        return { AND: [{ [field]: { not: null } }, { [field]: { not: '' } }] }
      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } }
      case 'not_in':
        return { [field]: { notIn: Array.isArray(value) ? value : [value] } }
      case 'between':
        if (secondValue) {
          return { [field]: { gte: value, lte: secondValue } }
        }
        return {}
      case 'not_between':
        if (secondValue) {
          return { OR: [{ [field]: { lt: value } }, { [field]: { gt: secondValue } }] }
        }
        return {}
      default:
        return {}
    }
  }

  private buildEnumCondition(field: string, operator: string, value: any): any {
    switch (operator) {
      case 'equals':
        return { [field]: value }
      case 'not_equals':
        return { [field]: { not: value } }
      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } }
      case 'not_in':
        return { [field]: { notIn: Array.isArray(value) ? value : [value] } }
      default:
        return {}
    }
  }

  private buildDateCondition(field: string, operator: string, value: any, secondValue?: any): any {
    if (!value) return {}

    const date = new Date(value)
    if (isNaN(date.getTime())) return {}

    switch (operator) {
      case 'equals':
        // For date equality, we need to match the entire day
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)
        return { [field]: { gte: startOfDay, lte: endOfDay } }
      case 'greater_than':
        return { [field]: { gt: date } }
      case 'less_than':
        return { [field]: { lt: date } }
      case 'between':
        if (secondValue) {
          const secondDate = new Date(secondValue)
          if (!isNaN(secondDate.getTime())) {
            return { [field]: { gte: date, lte: secondDate } }
          }
        }
        return {}
      case 'not_between':
        if (secondValue) {
          const secondDate = new Date(secondValue)
          if (!isNaN(secondDate.getTime())) {
            return { OR: [{ [field]: { lt: date } }, { [field]: { gt: secondDate } }] }
          }
        }
        return {}
      default:
        return {}
    }
  }

  private buildCustomFieldCondition(fieldName: string, operator: string, value: any, secondValue?: any): any {
    // For custom fields, we need to query the JSON field
    switch (operator) {
      case 'equals':
        return { customFields: { path: [fieldName], equals: value } }
      case 'not_equals':
        return { customFields: { path: [fieldName], not: value } }
      case 'contains':
        return { customFields: { path: [fieldName], string_contains: value } }
      case 'not_contains':
        return { NOT: { customFields: { path: [fieldName], string_contains: value } } }
      case 'is_empty':
        return { OR: [
          { customFields: { path: [fieldName], equals: null } },
          { customFields: { path: [fieldName], equals: '' } }
        ] }
      case 'is_not_empty':
        return { AND: [
          { customFields: { path: [fieldName], not: null } },
          { customFields: { path: [fieldName], not: '' } }
        ] }
      case 'in':
        const inValues = Array.isArray(value) ? value : [value]
        return { OR: inValues.map(v => ({ customFields: { path: [fieldName], equals: v } })) }
      case 'not_in':
        const notInValues = Array.isArray(value) ? value : [value]
        return { AND: notInValues.map(v => ({ customFields: { path: [fieldName], not: v } })) }
      default:
        return {}
    }
  }
}