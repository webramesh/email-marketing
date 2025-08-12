import { createTenantPrisma } from '@/lib/tenant/prisma-wrapper'
import { UserRole, type User, type Tenant, type PackagePurchase } from '@/generated/prisma'
import { Prisma } from '@/generated/prisma'

export interface CreateUserData {
  email: string
  name?: string
  firstName?: string
  lastName?: string
  password: string
  role?: UserRole
  isActive?: boolean
  packageId?: string // For assigning package to customer
}

export interface UpdateUserData {
  email?: string
  name?: string
  firstName?: string
  lastName?: string
  role?: UserRole
  isActive?: boolean
  deactivationReason?: string
  packageId?: string
}

export interface UserFilters {
  search?: string
  role?: UserRole
  isActive?: boolean
  packageId?: string
  hasPackage?: boolean
}

export interface UserQueryOptions {
  page?: number
  limit?: number
  sortBy?: 'email' | 'name' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  filters?: UserFilters
}

export interface UserWithDetails extends User {
  tenant: Tenant
  packagePurchases?: Array<{
    id: string
    status: string
    package: {
      id: string
      name: string
      price: number
      currency: string
    }
    currentPeriodStart: Date
    currentPeriodEnd: Date
  }>
  _count?: {
    assignedTickets: number
    requestedTickets: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export class UserManagementService {
  private tenantId: string
  private currentUserRole: UserRole

  constructor(tenantId: string, currentUserRole: UserRole) {
    this.tenantId = tenantId
    this.currentUserRole = currentUserRole
  }

  /**
   * Get paginated list of users based on role permissions
   */
  async getUsers(options: UserQueryOptions = {}): Promise<PaginatedResponse<UserWithDetails>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = options

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Build where clause based on role permissions
    const where: Prisma.UserWhereInput = this.buildWhereClause(filters)
    
    // Get total count
    const total = await tenantPrisma.prisma.user.count({ where })
    
    // Get users with pagination
    const users = await tenantPrisma.prisma.user.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            customDomain: true
          }
        },
        ...(this.currentUserRole === UserRole.ADMIN && {
          purchasedPackages: {
            where: {
              customerId: this.tenantId // Only show packages purchased from this admin
            },
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  currency: true
                }
              }
            }
          }
        }),
        _count: {
          select: {
            assignedTickets: true,
            requestedTickets: true
          }
        }
      }
    })

    const totalPages = Math.ceil(total / limit)

    return {
      data: users as UserWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    }
  }

  /**
   * Build where clause based on user role and permissions
   */
  private buildWhereClause(filters: UserFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {}

    // Role-based filtering
    switch (this.currentUserRole) {
      case UserRole.SUPERADMIN:
        // SUPERADMIN sees all users across all tenants
        break
      
      case UserRole.ADMIN:
        // ADMIN sees their customers (users who purchased their packages)
        where.OR = [
          // Users in their own tenant
          { tenantId: this.tenantId },
          // Users who purchased packages from this admin
          {
            purchasedPackages: {
              some: {
                package: {
                  creatorId: this.tenantId
                }
              }
            }
          }
        ]
        break
      
      case UserRole.USER:
        // USER only sees their own data
        where.tenantId = this.tenantId
        where.id = this.tenantId // This would need to be the actual user ID
        break
      
      default:
        // Default to tenant isolation
        where.tenantId = this.tenantId
        break
    }

    // Apply additional filters
    if (filters.search) {
      const searchConditions = [
        { email: { contains: filters.search } },
        { name: { contains: filters.search } },
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
      ]

      if (where.OR) {
        // If OR already exists, wrap it with search conditions
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions }
        ]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }
    
    if (filters.role) {
      where.role = filters.role
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters.packageId) {
      where.purchasedPackages = {
        some: {
          packageId: filters.packageId
        }
      }
    }

    if (filters.hasPackage !== undefined) {
      if (filters.hasPackage) {
        where.purchasedPackages = {
          some: {}
        }
      } else {
        where.purchasedPackages = {
          none: {}
        }
      }
    }

    return where
  }

  /**
   * Get a single user by ID (with role-based access control)
   */
  async getUserById(id: string): Promise<UserWithDetails | null> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const where: Prisma.UserWhereInput = { id }

    // Apply role-based access control
    if (this.currentUserRole === UserRole.USER) {
      // Users can only access their own data
      where.tenantId = this.tenantId
    } else if (this.currentUserRole === UserRole.ADMIN) {
      // Admins can access users in their tenant or customers who bought their packages
      where.OR = [
        { tenantId: this.tenantId },
        {
          purchasedPackages: {
            some: {
              package: {
                creatorId: this.tenantId
              }
            }
          }
        }
      ]
    }
    // SUPERADMIN has no restrictions

    const user = await tenantPrisma.prisma.user.findFirst({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            customDomain: true
          }
        },
        ...(this.currentUserRole !== UserRole.USER && {
          purchasedPackages: {
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  currency: true
                }
              }
            }
          }
        }),
        _count: {
          select: {
            assignedTickets: true,
            requestedTickets: true
          }
        }
      }
    })

    return user as UserWithDetails | null
  }

  /**
   * Create a new user (with role-based permissions)
   */
  async createUser(data: CreateUserData): Promise<UserWithDetails> {
    // Only SUPERADMIN and ADMIN can create users
    if (this.currentUserRole === UserRole.USER) {
      throw new Error('Insufficient permissions to create users')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    const bcrypt = require('bcryptjs')
    
    // Check if user already exists
    const existingUser = await tenantPrisma.prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: data.email,
          tenantId: this.tenantId
        }
      }
    })

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(data.password, 12)

    // Determine target tenant for user creation
    let targetTenantId = this.tenantId

    // If ADMIN is creating a customer, create in customer's own tenant
    if (this.currentUserRole === UserRole.ADMIN && data.role === UserRole.USER && data.packageId) {
      // For now, create in the same tenant. In a full implementation,
      // you might create a new tenant for the customer
      targetTenantId = this.tenantId
    }

    const user = await tenantPrisma.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        role: data.role || UserRole.USER,
        isActive: data.isActive !== undefined ? data.isActive : true,
        tenant: {
          connect: { id: targetTenantId }
        }
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            customDomain: true
          }
        },
        _count: {
          select: {
            assignedTickets: true,
            requestedTickets: true
          }
        }
      }
    })

    // If package is specified, create package purchase
    if (data.packageId && this.currentUserRole === UserRole.ADMIN) {
      await this.assignPackageToUser(user.id, data.packageId)
    }

    return user as UserWithDetails
  }

  /**
   * Update a user (with role-based permissions)
   */
  async updateUser(id: string, data: UpdateUserData): Promise<UserWithDetails> {
    // Check if user has permission to update this user
    const existingUser = await this.getUserById(id)
    if (!existingUser) {
      throw new Error('User not found or insufficient permissions')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Prepare update data
    const updateData: any = { ...data }
    delete updateData.packageId // Handle package assignment separately

    // Handle deactivation
    if (data.isActive === false && existingUser.isActive) {
      updateData.deactivatedAt = new Date()
      updateData.deactivationReason = data.deactivationReason || 'Deactivated by administrator'
    } else if (data.isActive === true && !existingUser.isActive) {
      updateData.reactivatedAt = new Date()
      updateData.deactivatedAt = null
      updateData.deactivationReason = null
    }

    const user = await tenantPrisma.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            customDomain: true
          }
        },
        purchasedPackages: {
          include: {
            package: {
              select: {
                id: true,
                name: true,
                price: true,
                currency: true
              }
            }
          }
        },
        _count: {
          select: {
            assignedTickets: true,
            requestedTickets: true
          }
        }
      }
    })

    // Handle package assignment if specified
    if (data.packageId && this.currentUserRole === UserRole.ADMIN) {
      await this.assignPackageToUser(id, data.packageId)
    }

    return user as UserWithDetails
  }

  /**
   * Delete a user (with role-based permissions)
   */
  async deleteUser(id: string): Promise<void> {
    // Only SUPERADMIN can delete users
    if (this.currentUserRole !== UserRole.SUPERADMIN) {
      throw new Error('Insufficient permissions to delete users')
    }

    // Check if user exists and has permission
    const existingUser = await this.getUserById(id)
    if (!existingUser) {
      throw new Error('User not found or insufficient permissions')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    await tenantPrisma.prisma.user.delete({
      where: { id }
    })
  }

  /**
   * Assign package to user (for admin companies managing customers)
   */
  async assignPackageToUser(userId: string, packageId: string): Promise<void> {
    if (this.currentUserRole !== UserRole.ADMIN) {
      throw new Error('Only admin companies can assign packages to customers')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Verify the package belongs to this admin
    const packageExists = await tenantPrisma.prisma.package.findFirst({
      where: {
        id: packageId,
        creatorId: this.tenantId
      }
    })

    if (!packageExists) {
      throw new Error('Package not found or not owned by this admin')
    }

    // Check if user already has this package
    const existingPurchase = await tenantPrisma.prisma.packagePurchase.findFirst({
      where: {
        packageId,
        customerId: userId
      }
    })

    if (existingPurchase) {
      throw new Error('User already has this package')
    }

    // Create package purchase
    const now = new Date()
    const nextMonth = new Date(now)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    await tenantPrisma.prisma.packagePurchase.create({
      data: {
        packageId,
        customerId: userId,
        purchasePrice: packageExists.price,
        currency: packageExists.currency,
        billingCycle: packageExists.billingCycle,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        quotas: packageExists.quotas,
        usage: {}
      }
    })
  }

  /**
   * Get user statistics based on role
   */
  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    admins: number
    users: number
    customers: number
  }> {
    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    const where = this.buildWhereClause({})

    const [total, active, inactive, admins, users, customers] = await Promise.all([
      tenantPrisma.prisma.user.count({ where }),
      tenantPrisma.prisma.user.count({ where: { ...where, isActive: true } }),
      tenantPrisma.prisma.user.count({ where: { ...where, isActive: false } }),
      tenantPrisma.prisma.user.count({ where: { ...where, role: UserRole.ADMIN } }),
      tenantPrisma.prisma.user.count({ where: { ...where, role: UserRole.USER } }),
      // Customers are users who have purchased packages
      tenantPrisma.prisma.user.count({
        where: {
          ...where,
          purchasedPackages: {
            some: {}
          }
        }
      }),
    ])

    return {
      total,
      active,
      inactive,
      admins,
      users,
      customers,
    }
  }

  /**
   * Bulk operations for users
   */
  async bulkUpdateUsers(userIds: string[], data: Partial<UpdateUserData>): Promise<number> {
    // Only SUPERADMIN and ADMIN can perform bulk operations
    if (this.currentUserRole === UserRole.USER) {
      throw new Error('Insufficient permissions for bulk operations')
    }

    const tenantPrisma = createTenantPrisma(this.tenantId)
    
    // Build where clause to ensure user has permission to update these users
    const where = this.buildWhereClause({})
    where.id = { in: userIds }

    const result = await tenantPrisma.prisma.user.updateMany({
      where,
      data
    })

    return result.count
  }

  /**
   * Search users with advanced filters
   */
  async searchUsers(query: string, filters: UserFilters = {}): Promise<UserWithDetails[]> {
    const searchFilters = {
      ...filters,
      search: query
    }

    const result = await this.getUsers({
      page: 1,
      limit: 50,
      filters: searchFilters
    })

    return result.data
  }
}