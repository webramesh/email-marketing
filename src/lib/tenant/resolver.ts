import { prisma } from '../prisma';
import { Tenant } from '../../generated/prisma';

/**
 * Tenant Resolution Service
 * Handles subdomain and custom domain identification for multi-tenant architecture
 */

export interface TenantContext {
  tenant: Tenant;
  subdomain: string;
  customDomain?: string;
}

export class TenantResolver {
  private static cache = new Map<string, Tenant>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolve tenant from request headers
   */
  static async resolveTenant(
    host: string,
    headers?: Record<string, string>
  ): Promise<TenantContext | null> {
    try {
      // Extract subdomain or custom domain from host
      const { subdomain, customDomain } = this.parseHost(host);
      
      // Try to get tenant from cache first
      const cacheKey = subdomain || customDomain || '';
      const cachedTenant = this.getCachedTenant(cacheKey);
      
      if (cachedTenant) {
        return {
          tenant: cachedTenant,
          subdomain: subdomain || '',
          customDomain,
        };
      }

      // Query database for tenant
      let tenant: Tenant | null = null;

      if (customDomain) {
        tenant = await prisma.tenant.findUnique({
          where: { customDomain },
          include: {
            subscriptionPlan: true,
          },
        });
      } else if (subdomain) {
        tenant = await prisma.tenant.findUnique({
          where: { subdomain },
          include: {
            subscriptionPlan: true,
          },
        });
      }

      if (!tenant) {
        return null;
      }

      // Cache the tenant
      this.setCachedTenant(cacheKey, tenant);

      return {
        tenant,
        subdomain: subdomain || '',
        customDomain,
      };
    } catch (error) {
      console.error('Error resolving tenant:', error);
      return null;
    }
  }

  /**
   * Parse host to extract subdomain and custom domain
   */
  private static parseHost(host: string): {
    subdomain?: string;
    customDomain?: string;
  } {
    // Remove port if present
    const cleanHost = host.split(':')[0];
    
    // Check if it's a localhost or IP address (development)
    if (cleanHost === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
      return { subdomain: 'demo' }; // Default to demo tenant in development
    }

    // Check if it's a custom domain (no subdomain pattern)
    const parts = cleanHost.split('.');
    
    // If it's a direct domain (e.g., example.com), treat as custom domain
    if (parts.length === 2) {
      return { customDomain: cleanHost };
    }
    
    // If it has subdomain pattern (e.g., tenant.example.com)
    if (parts.length >= 3) {
      const subdomain = parts[0];
      const baseDomain = parts.slice(1).join('.');
      
      // Check if it's our main domain with subdomain
      const mainDomains = ['localhost', 'example.com', 'yourdomain.com'];
      
      if (mainDomains.some(domain => baseDomain.includes(domain))) {
        return { subdomain };
      } else {
        // It's a custom domain
        return { customDomain: cleanHost };
      }
    }

    return {};
  }

  /**
   * Get tenant from cache
   */
  private static getCachedTenant(key: string): Tenant | null {
    const tenant = this.cache.get(key);
    const expiry = this.cacheExpiry.get(key);

    if (tenant && expiry && Date.now() < expiry) {
      return tenant;
    }

    // Clean up expired cache
    if (tenant) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    }

    return null;
  }

  /**
   * Set tenant in cache
   */
  private static setCachedTenant(key: string, tenant: Tenant): void {
    this.cache.set(key, tenant);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Clear tenant cache
   */
  static clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Validate tenant access for user
   */
  static async validateTenantAccess(
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId: tenantId,
        },
      });

      return !!user;
    } catch (error) {
      console.error('Error validating tenant access:', error);
      return false;
    }
  }

  /**
   * Get tenant by ID with caching
   */
  static async getTenantById(tenantId: string): Promise<Tenant | null> {
    try {
      const cachedTenant = this.getCachedTenant(`id:${tenantId}`);
      
      if (cachedTenant) {
        return cachedTenant;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptionPlan: true,
        },
      });

      if (tenant) {
        this.setCachedTenant(`id:${tenantId}`, tenant);
      }

      return tenant;
    } catch (error) {
      console.error('Error getting tenant by ID:', error);
      return null;
    }
  }
}

/**
 * Utility functions for tenant operations
 */
export const tenantUtils = {
  /**
   * Generate tenant-specific cache key
   */
  getCacheKey: (tenantId: string, key: string): string => {
    return `tenant:${tenantId}:${key}`;
  },

  /**
   * Generate tenant-specific file path
   */
  getFilePath: (tenantId: string, ...pathSegments: string[]): string => {
    return ['tenants', tenantId, ...pathSegments].join('/');
  },

  /**
   * Validate tenant ID format
   */
  isValidTenantId: (tenantId: string): boolean => {
    return /^[a-zA-Z0-9_-]+$/.test(tenantId) && tenantId.length > 0;
  },

  /**
   * Generate subdomain from tenant name
   */
  generateSubdomain: (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  /**
   * Create tenant-specific upload directory
   */
  getUploadPath: (tenantId: string, type: 'images' | 'documents' | 'exports'): string => {
    return `uploads/${tenantId}/${type}`;
  },

  /**
   * Generate tenant-specific session key
   */
  getSessionKey: (tenantId: string, sessionId: string): string => {
    return `session:${tenantId}:${sessionId}`;
  },

  /**
   * Create tenant-specific Redis key patterns
   */
  redis: {
    // Cache keys
    cache: (tenantId: string, key: string) => `cache:${tenantId}:${key}`,
    
    // Session keys
    session: (tenantId: string, sessionId: string) => `session:${tenantId}:${sessionId}`,
    
    // Queue keys
    queue: (tenantId: string, queueName: string) => `queue:${tenantId}:${queueName}`,
    
    // Lock keys
    lock: (tenantId: string, resource: string) => `lock:${tenantId}:${resource}`,
    
    // Analytics keys
    analytics: (tenantId: string, metric: string, date: string) => 
      `analytics:${tenantId}:${metric}:${date}`,
  },

  /**
   * File organization utilities
   */
  files: {
    // Email templates
    templates: (tenantId: string, templateId: string) => 
      `tenants/${tenantId}/templates/${templateId}`,
    
    // Campaign assets
    campaigns: (tenantId: string, campaignId: string, asset: string) => 
      `tenants/${tenantId}/campaigns/${campaignId}/${asset}`,
    
    // Subscriber exports
    exports: (tenantId: string, exportId: string) => 
      `tenants/${tenantId}/exports/${exportId}`,
    
    // Form assets
    forms: (tenantId: string, formId: string) => 
      `tenants/${tenantId}/forms/${formId}`,
    
    // Backup files
    backups: (tenantId: string, backupId: string) => 
      `tenants/${tenantId}/backups/${backupId}`,
  },
};