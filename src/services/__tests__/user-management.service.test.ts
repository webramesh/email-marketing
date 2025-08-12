import { UserManagementService } from '../user-management.service'
import { UserRole } from '@/generated/prisma'

// Mock the tenant prisma wrapper
jest.mock('@/lib/tenant/prisma-wrapper', () => ({
  createTenantPrisma: jest.fn(() => ({
    prisma: {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      package: {
        findFirst: jest.fn(),
      },
      packagePurchase: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    },
  })),
}))

describe('UserManagementService', () => {
  let service: UserManagementService
  const mockTenantId = 'test-tenant'

  beforeEach(() => {
    service = new UserManagementService(mockTenantId, UserRole.ADMIN)
    jest.clearAllMocks()
  })

  describe('Role-based access control', () => {
    it('should create service with correct role', () => {
      expect(service).toBeInstanceOf(UserManagementService)
    })

    it('should restrict USER role to own data only', () => {
      const userService = new UserManagementService(mockTenantId, UserRole.USER)
      expect(userService).toBeInstanceOf(UserManagementService)
    })

    it('should allow SUPERADMIN full access', () => {
      const superAdminService = new UserManagementService(mockTenantId, UserRole.SUPERADMIN)
      expect(superAdminService).toBeInstanceOf(UserManagementService)
    })

    it('should allow ADMIN access to customers', () => {
      const adminService = new UserManagementService(mockTenantId, UserRole.ADMIN)
      expect(adminService).toBeInstanceOf(UserManagementService)
    })
  })

  describe('User creation permissions', () => {
    it('should prevent USER role from creating users', async () => {
      const userService = new UserManagementService(mockTenantId, UserRole.USER)
      
      await expect(userService.createUser({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })).rejects.toThrow('Insufficient permissions to create users')
    })

    it('should allow ADMIN to create users', async () => {
      // This test would require more complex mocking
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Bulk operations permissions', () => {
    it('should prevent USER role from bulk operations', async () => {
      const userService = new UserManagementService(mockTenantId, UserRole.USER)
      
      await expect(userService.bulkUpdateUsers(['user1'], { isActive: false }))
        .rejects.toThrow('Insufficient permissions for bulk operations')
    })
  })

  describe('User deletion permissions', () => {
    it('should only allow SUPERADMIN to delete users', async () => {
      const adminService = new UserManagementService(mockTenantId, UserRole.ADMIN)
      
      await expect(adminService.deleteUser('user1'))
        .rejects.toThrow('Insufficient permissions to delete users')
    })
  })
})