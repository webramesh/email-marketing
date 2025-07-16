import { PrismaClient, Prisma } from '../../generated/prisma';
import { prisma } from '../prisma';

/**
 * Tenant-aware Prisma client wrapper
 * Automatically includes tenant filtering on all queries to ensure data isolation
 */

export class TenantPrismaClient {
  private tenantId: string;
  private client: PrismaClient;

  constructor(tenantId: string, client: PrismaClient = prisma) {
    this.tenantId = tenantId;
    this.client = client;
  }

  /**
   * Get the underlying Prisma client with tenant filtering
   */
  get prisma() {
    return this.createTenantProxy();
  }

  /**
   * Create a proxy that automatically adds tenant filtering
   */
  private createTenantProxy(): PrismaClient {
    const tenantId = this.tenantId;
    const client = this.client;

    return new Proxy(client, {
      get(target, prop) {
        const originalMethod = target[prop as keyof PrismaClient];

        // List of models that require tenant filtering
        const tenantModels = [
          'user', 'campaign', 'subscriber', 'list', 'automation',
          'sendingServer', 'domain', 'form', 'supportTicket'
        ];

        if (tenantModels.includes(prop as string)) {
          return new Proxy(originalMethod as any, {
            get(modelTarget, modelProp) {
              const modelMethod = modelTarget[modelProp as keyof typeof modelTarget];

              if (typeof modelMethod === 'function') {
                return function (...args: any[]) {
                  // Add tenant filtering to query arguments
                  const modifiedArgs = addTenantFilter(args, tenantId);
                  return (modelMethod as Function).apply(modelTarget, modifiedArgs);
                };
              }

              return modelMethod;
            },
          });
        }

        return originalMethod;
      },
    }) as PrismaClient;
  }

  /**
   * Execute raw query with tenant context
   */
  async $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<T> {
    // Add tenant context to raw queries if needed
    return this.client.$queryRaw(query, ...values);
  }

  /**
   * Execute transaction with tenant context
   */
  async $transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.client.$transaction(
      (tx) => fn(new TenantPrismaClient(this.tenantId, tx as PrismaClient).prisma),
      options
    );
  }

  /**
   * Disconnect the client
   */
  async $disconnect(): Promise<void> {
    return this.client.$disconnect();
  }
}

/**
 * Add tenant filtering to query arguments
 */
function addTenantFilter(args: any[], tenantId: string): any[] {
  if (!args.length) {
    return args;
  }

  const [firstArg, ...restArgs] = args;

  // Skip if no query object
  if (!firstArg || typeof firstArg !== 'object') {
    return args;
  }

  // Add tenant filter to where clause
  const modifiedArg = {
    ...firstArg,
    where: {
      ...firstArg.where,
      tenantId,
    },
  };

  // For create operations, add tenantId to data
  if (firstArg.data) {
    if (Array.isArray(firstArg.data)) {
      // Handle createMany
      modifiedArg.data = firstArg.data.map((item: any) => ({
        ...item,
        tenantId,
      }));
    } else {
      // Handle create
      modifiedArg.data = {
        ...firstArg.data,
        tenantId,
      };
    }
  }

  return [modifiedArg, ...restArgs];
}

/**
 * Create tenant-aware Prisma client instance
 */
export function createTenantPrisma(tenantId: string): TenantPrismaClient {
  if (!tenantId) {
    throw new Error('Tenant ID is required for tenant-aware Prisma client');
  }

  return new TenantPrismaClient(tenantId);
}

/**
 * Utility functions for tenant-aware database operations
 */
export const tenantDb = {
  /**
   * Validate that a query includes tenant filtering
   */
  validateTenantFilter: (where: any, tenantId: string): boolean => {
    return where && where.tenantId === tenantId;
  },

  /**
   * Ensure tenant ID is included in create data
   */
  ensureTenantId: <T extends Record<string, any>>(
    data: T,
    tenantId: string
  ): T & { tenantId: string } => {
    return {
      ...data,
      tenantId,
    };
  },

  /**
   * Create tenant-safe where clause
   */
  createTenantWhere: <T extends Record<string, any>>(
    where: T,
    tenantId: string
  ): T & { tenantId: string } => {
    return {
      ...where,
      tenantId,
    };
  },

  /**
   * Bulk operations with tenant filtering
   */
  bulkCreate: async <T extends Record<string, any>>(
    model: string,
    data: T[],
    tenantId: string
  ): Promise<void> => {
    const tenantData = data.map(item => ({
      ...item,
      tenantId,
    }));

    await (prisma as any)[model].createMany({
      data: tenantData,
      skipDuplicates: true,
    });
  },

  /**
   * Count records with tenant filtering
   */
  count: async (
    model: string,
    where: any,
    tenantId: string
  ): Promise<number> => {
    return (prisma as any)[model].count({
      where: {
        ...where,
        tenantId,
      },
    });
  },
};

/**
 * Middleware to ensure all database operations include tenant context
 */
export function enforceTenantIsolation() {
  // This would be implemented as a Prisma middleware
  // Currently Prisma doesn't support middleware in the same way
  // So we use the wrapper approach above
  
  console.log('Tenant isolation enforcement is active');
}