import { NextRequest, NextResponse } from 'next/server';
import { TenantResolver, TenantContext } from './resolver';

/**
 * Tenant Context Middleware
 * Enforces tenant filtering on all requests and provides tenant context
 */

export interface TenantMiddlewareConfig {
  excludePaths?: readonly string[];
  requireTenant?: boolean;
  allowedRoles?: readonly string[];
}

/**
 * Middleware function to resolve and enforce tenant context
 */
export async function tenantMiddleware(
  request: NextRequest,
  config: TenantMiddlewareConfig = {}
): Promise<NextResponse | null> {
  const { excludePaths = [], requireTenant = true } = config;
  
  // Skip middleware for excluded paths
  const pathname = request.nextUrl.pathname;
  if (excludePaths.some(path => pathname.startsWith(path))) {
    return null;
  }

  try {
    // Resolve tenant from request
    const host = request.headers.get('host') || '';
    const tenantContext = await TenantResolver.resolveTenant(host);

    // Handle missing tenant
    if (!tenantContext && requireTenant) {
      return new NextResponse(
        JSON.stringify({
          error: 'Tenant not found',
          message: 'Invalid subdomain or custom domain',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Add tenant context to request headers for downstream use
    if (tenantContext) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', tenantContext.tenant.id);
      requestHeaders.set('x-tenant-subdomain', tenantContext.subdomain);
      
      if (tenantContext.customDomain) {
        requestHeaders.set('x-tenant-custom-domain', tenantContext.customDomain);
      }

      // Create new request with tenant headers
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Add tenant info to response headers for debugging
      if (process.env.NODE_ENV === 'development') {
        response.headers.set('x-debug-tenant-id', tenantContext.tenant.id);
        response.headers.set('x-debug-tenant-name', tenantContext.tenant.name);
      }

      return response;
    }

    return null;
  } catch (error) {
    console.error('Tenant middleware error:', error);
    
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to resolve tenant context',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Extract tenant context from request headers
 */
export function getTenantFromHeaders(headers: Headers): {
  tenantId?: string;
  subdomain?: string;
  customDomain?: string;
} {
  // In development mode, check for mock tenant ID first
  if (process.env.NODE_ENV === 'development') {
    const mockTenantId = headers.get('x-mock-tenant-id');
    if (mockTenantId) {
      return {
        tenantId: mockTenantId,
        subdomain: 'demo',
        customDomain: undefined,
      };
    }
  }
  
  return {
    tenantId: headers.get('x-tenant-id') || undefined,
    subdomain: headers.get('x-tenant-subdomain') || undefined,
    customDomain: headers.get('x-tenant-custom-domain') || undefined,
  };
}

/**
 * Validate tenant access in API routes
 */
export async function validateTenantAccess(
  request: NextRequest,
  userId?: string
): Promise<{
  isValid: boolean;
  tenantId?: string;
  error?: string;
}> {
  try {
    const { tenantId } = getTenantFromHeaders(request.headers);
    
    if (!tenantId) {
      return {
        isValid: false,
        error: 'Tenant context not found',
      };
    }

    // If user ID is provided, validate user belongs to tenant
    if (userId) {
      const hasAccess = await TenantResolver.validateTenantAccess(tenantId, userId);
      
      if (!hasAccess) {
        return {
          isValid: false,
          tenantId,
          error: 'User does not have access to this tenant',
        };
      }
    }

    return {
      isValid: true,
      tenantId,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate tenant access',
    };
  }
}

/**
 * Create tenant-aware response with proper headers
 */
export function createTenantResponse(
  data: any,
  tenantId: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  
  // Add tenant context to response headers
  response.headers.set('x-tenant-id', tenantId);
  
  // Add cache control for tenant-specific data
  response.headers.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  
  return response;
}

/**
 * Middleware configuration for different route types
 */
export const middlewareConfigs = {
  // API routes require tenant context
  api: {
    excludePaths: ['/api/health', '/api/auth'],
    requireTenant: true,
  },
  
  // Public routes don't require tenant
  public: {
    excludePaths: ['/login', '/register', '/forgot-password'],
    requireTenant: false,
  },
  
  // Admin routes require tenant and admin role
  admin: {
    excludePaths: [],
    requireTenant: true,
    allowedRoles: ['ADMIN'],
  },
} as const;