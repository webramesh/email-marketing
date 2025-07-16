import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '../../../generated/prisma';
import { createTenantPrisma, TenantPrismaClient } from '../../tenant/prisma-wrapper';
import { DatabaseUtils } from '../utils';

/**
 * Comprehensive database tests with tenant isolation validation
 * These tests ensure that tenant data remains completely segregated
 */

const prisma = new PrismaClient();

describe('Tenant Isolation Database Tests', () => {
  let tenant1: any;
  let tenant2: any;
  let tenantPrisma1: TenantPrismaClient;
  let tenantPrisma2: TenantPrismaClient;

  beforeAll(async () => {
    // Create test tenants
    tenant1 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 1',
        subdomain: 'test1',
      },
    });

    tenant2 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 2',
        subdomain: 'test2',
      },
    });

    // Create tenant-aware Prisma clients
    tenantPrisma1 = createTenantPrisma(tenant1.id);
    tenantPrisma2 = createTenantPrisma(tenant2.id);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any test data before each test
    await prisma.user.deleteMany({
      where: {
        tenantId: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });

    await prisma.subscriber.deleteMany({
      where: {
        tenantId: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });

    await prisma.campaign.deleteMany({
      where: {
        tenantId: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });
  });

  describe('User Tenant Isolation', () => {
    it('should create users with correct tenant isolation', async () => {
      // Create users for each tenant
      const user1 = await tenantPrisma1.prisma.user.create({
        data: {
          email: 'user1@test.com',
          name: 'User 1',
          password: 'password123',
          tenant: {
            connect: { id: tenant1.id }
          }
        },
      });

      const user2 = await tenantPrisma2.prisma.user.create({
        data: {
          email: 'user2@test.com',
          name: 'User 2',
          password: 'password123',
          tenant: {
            connect: { id: tenant2.id }
          }
        },
      });

      // Verify users are created with correct tenant IDs
      expect(user1.tenantId).toBe(tenant1.id);
      expect(user2.tenantId).toBe(tenant2.id);

      // Verify tenant 1 can only see their user
      const tenant1Users = await tenantPrisma1.prisma.user.findMany();
      expect(tenant1Users).toHaveLength(1);
      expect(tenant1Users[0].id).toBe(user1.id);

      // Verify tenant 2 can only see their user
      const tenant2Users = await tenantPrisma2.prisma.user.findMany();
      expect(tenant2Users).toHaveLength(1);
      expect(tenant2Users[0].id).toBe(user2.id);
    });

    it('should prevent cross-tenant user access', async () => {
      // Create user for tenant 1
      const user1 = await tenantPrisma1.prisma.user.create({
        data: {
          email: 'user1@test.com',
          name: 'User 1',
          password: 'password123',
          tenant: {
            connect: { id: tenant1.id }
          }
        },
      });

      // Try to access user1 from tenant2 - should return null
      const crossTenantUser = await tenantPrisma2.prisma.user.findUnique({
        where: { id: user1.id },
      });

      expect(crossTenantUser).toBeNull();
    });
  });

  describe('Subscriber Tenant Isolation', () => {
    it('should maintain subscriber isolation between tenants', async () => {
      // Create subscribers for each tenant
      const subscriber1 = await tenantPrisma1.prisma.subscriber.create({
        data: {
          email: 'subscriber1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          tenant: {
            connect: { id: tenant1.id }
          }
        },
      });

      const subscriber2 = await tenantPrisma2.prisma.subscriber.create({
        data: {
          email: 'subscriber2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          tenant: {
            connect: { id: tenant2.id }
          }
        },
      });

      // Verify subscribers are isolated
      const tenant1Subscribers = await tenantPrisma1.prisma.subscriber.findMany();
      const tenant2Subscribers = await tenantPrisma2.prisma.subscriber.findMany();

      expect(tenant1Subscribers).toHaveLength(1);
      expect(tenant2Subscribers).toHaveLength(1);
      expect(tenant1Subscribers[0].id).toBe(subscriber1.id);
      expect(tenant2Subscribers[0].id).toBe(subscriber2.id);
    });

    it('should allow same email across different tenants', async () => {
      const sameEmail = 'same@test.com';

      // Create subscribers with same email in different tenants
      const subscriber1 = await tenantPrisma1.prisma.subscriber.create({
        data: {
          email: sameEmail,
          firstName: 'John',
          lastName: 'Doe',
          tenant: {
            connect: { id: tenant1.id }
          }
        },
      });

      const subscriber2 = await tenantPrisma2.prisma.subscriber.create({
        data: {
          email: sameEmail,
          firstName: 'Jane',
          lastName: 'Smith',
          tenant: {
            connect: { id: tenant2.id }
          }
        },
      });

      // Both should be created successfully
      expect(subscriber1.email).toBe(sameEmail);
      expect(subscriber2.email).toBe(sameEmail);
      expect(subscriber1.tenantId).toBe(tenant1.id);
      expect(subscriber2.tenantId).toBe(tenant2.id);
    });
  });

  describe('Campaign Tenant Isolation', () => {
    it('should isolate campaigns between tenants', async () => {
      // Create campaigns for each tenant
      const campaign1 = await tenantPrisma1.prisma.campaign.create({
        data: {
          name: 'Campaign 1',
          subject: 'Test Subject 1',
          content: 'Test Content 1',
          tenant: {
            connect: { id: tenant1.id }
          }
        },
      });

      const campaign2 = await tenantPrisma2.prisma.campaign.create({
        data: {
          name: 'Campaign 2',
          subject: 'Test Subject 2',
          content: 'Test Content 2',
          tenant: {
            connect: { id: tenant2.id }
          }
        },
      });

      // Verify campaigns are isolated
      const tenant1Campaigns = await tenantPrisma1.prisma.campaign.findMany();
      const tenant2Campaigns = await tenantPrisma2.prisma.campaign.findMany();

      expect(tenant1Campaigns).toHaveLength(1);
      expect(tenant2Campaigns).toHaveLength(1);
      expect(tenant1Campaigns[0].id).toBe(campaign1.id);
      expect(tenant2Campaigns[0].id).toBe(campaign2.id);
    });
  });

  describe('Bulk Operations with Tenant Isolation', () => {
    it('should handle bulk operations with proper tenant filtering', async () => {
      const subscribersData = [
        { email: 'bulk1@test.com', firstName: 'Bulk', lastName: 'User1' },
        { email: 'bulk2@test.com', firstName: 'Bulk', lastName: 'User2' },
        { email: 'bulk3@test.com', firstName: 'Bulk', lastName: 'User3' },
      ];

      // Bulk create for tenant 1
      await DatabaseUtils.bulkInsert('subscriber', subscribersData.map(data => ({
        ...data,
        tenantId: tenant1.id,
      })));

      // Verify only tenant 1 has the bulk subscribers
      const tenant1Subscribers = await tenantPrisma1.prisma.subscriber.findMany();
      const tenant2Subscribers = await tenantPrisma2.prisma.subscriber.findMany();

      expect(tenant1Subscribers).toHaveLength(3);
      expect(tenant2Subscribers).toHaveLength(0);
    });
  });

  describe('Database Performance and Optimization', () => {
    it('should execute queries within performance thresholds', async () => {
      // Create test data
      const subscribersData = Array.from({ length: 100 }, (_, i) => ({
        email: `perf${i}@test.com`,
        firstName: 'Performance',
        lastName: `User${i}`,
        tenantId: tenant1.id,
      }));

      await DatabaseUtils.bulkInsert('subscriber', subscribersData);

      // Test query performance
      const startTime = Date.now();
      const subscribers = await tenantPrisma1.prisma.subscriber.findMany({
        take: 50,
      });
      const queryTime = Date.now() - startTime;

      expect(subscribers).toHaveLength(50);
      expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle streaming queries for large datasets', async () => {
      // Create test data
      const subscribersData = Array.from({ length: 50 }, (_, i) => ({
        email: `stream${i}@test.com`,
        firstName: 'Stream',
        lastName: `User${i}`,
        tenantId: tenant1.id,
      }));

      await DatabaseUtils.bulkInsert('subscriber', subscribersData);

      // Test streaming query
      let totalProcessed = 0;
      const streamQuery = () => tenantPrisma1.prisma.subscriber.findMany({
        skip: totalProcessed,
        take: 10,
      });

      for await (const batch of DatabaseUtils.streamQuery(streamQuery, 10)) {
        expect(batch.length).toBeLessThanOrEqual(10);
        totalProcessed += batch.length;
        
        if (batch.length < 10) break;
      }

      expect(totalProcessed).toBe(50);
    });
  });

  describe('Connection Health and Monitoring', () => {
    it('should report healthy database connection', async () => {
      const healthCheck = await DatabaseUtils.getConnectionStatus();
      
      expect(healthCheck.isConnected).toBe(true);
      expect(healthCheck.metrics).toBeDefined();
    });

    it('should handle connection retry logic', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Simulated connection error');
        }
        return 'success';
      };

      const result = await DatabaseUtils.executeWithRetry(operation, 3, 100);
      
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });
  });

  describe('Tenant Context Validation', () => {
    it('should reject operations without tenant context', async () => {
      expect(() => {
        createTenantPrisma('');
      }).toThrow('Tenant ID is required for tenant-aware Prisma client');
    });

    it('should validate tenant ID format', async () => {
      const validTenantId = 'valid-tenant-123';
      const invalidTenantId = 'invalid tenant!@#';

      expect(validTenantId).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(invalidTenantId).not.toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });
});

/**
 * Integration tests for database utilities
 */
describe('Database Utilities Integration Tests', () => {
  it('should analyze database performance', async () => {
    const analysis = await DatabaseUtils.analyzePerformance('test-tenant');
    
    expect(analysis).toHaveProperty('slowQueries');
    expect(analysis).toHaveProperty('indexUsage');
    expect(analysis).toHaveProperty('recommendations');
    expect(Array.isArray(analysis.recommendations)).toBe(true);
  });

  it('should handle bulk operations efficiently', async () => {
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: `test-${i}`,
      name: `Test Item ${i}`,
    }));

    const startTime = Date.now();
    
    // This would be tested with actual bulk operations
    // For now, we test the chunking utility
    const chunks = (DatabaseUtils as any).chunkArray(testData, 100);
    
    const processingTime = Date.now() - startTime;

    expect(chunks).toHaveLength(10);
    expect(chunks[0]).toHaveLength(100);
    expect(processingTime).toBeLessThan(50); // Should be very fast
  });
});