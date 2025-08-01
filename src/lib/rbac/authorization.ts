import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../auth'
import { hasPermission, Resource, Action } from './permissions'
import { UserRole, TenantContext } from '@/types'

// Type declaration for RequestInit duplex option
declare global {
  interface RequestInit {
    duplex?: 'half' | 'full'
  }
}

type RequestDuplex = 'half' | 'full'

// Get tenant context from request headers or session
async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  // In a real implementation, this would extract tenant information from:
  // 1. Request headers (X-Tenant-ID)
  // 2. Subdomain parsing
  // 3. Session data
  
  // For now, we'll use a simple implementation that gets tenant from session
  const session = await auth()
  if (!session?.user?.tenantId) {
    return null
  }
  
  return {
    tenantId: session.user.tenantId,
    tenant: null // In a real implementation, we would fetch the tenant details
  }
}

/**
 * Middleware to enforce role-based access control
 * @param request The Next.js request object
 * @param resource The resource being accessed
 * @param action The action being performed
 * @returns NextResponse or null to continue
 */
export async function enforcePermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<NextResponse | null> {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    const userRole = user.role as UserRole
    
    // Get tenant context
    const tenantContext = await getTenantContext(request)
    
    // Ensure tenant context exists for tenant-specific resources
    if (!tenantContext?.tenantId && resource !== Resource.SYSTEM_SETTINGS) {
      return NextResponse.json(
        { error: 'Tenant context required' },
        { status: 400 }
      )
    }
    
    // Check if user has permission to perform the action on the resource
    if (!hasPermission(userRole, resource, action)) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `You don't have permission to ${action} ${resource}`
        },
        { status: 403 }
      )
    }
    
    return null // Continue with the request
  } catch (error) {
    console.error('Authorization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * API route wrapper that enforces role-based permissions
 * @param handler The API route handler
 * @param resource The resource being accessed
 * @param action The action being performed
 * @returns A wrapped handler function with RBAC enforcement
 */
export function withPermission<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  resource: Resource,
  action: Action
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // In development mode, bypass RBAC if mock headers are present
    if (process.env.NODE_ENV === 'development') {
      const mockUserId = request.headers.get('x-mock-user-id')
      const mockTenantId = request.headers.get('x-mock-tenant-id')
      
      if (mockUserId && mockTenantId) {
        // Add tenant ID to headers for downstream services
        const headers = new Headers(request.headers)
        headers.set('X-Tenant-ID', mockTenantId)
        
        const requestWithTenant = new Request(request.url, {
          method: request.method,
          headers,
          body: request.body,
          signal: request.signal,
          ...(request.body && { duplex: 'half' as RequestDuplex })
        })
        
        return handler(requestWithTenant as NextRequest, ...args)
      }
    }
    
    const permissionResponse = await enforcePermission(request, resource, action)
    if (permissionResponse) {
      return permissionResponse
    }
    
    // Add tenant context to the request for tenant-aware operations
    const tenantContext = await getTenantContext(request)
    if (tenantContext?.tenantId) {
      // Clone the request and add tenant ID header
      const headers = new Headers(request.headers)
      headers.set('X-Tenant-ID', tenantContext.tenantId)
      
      const requestWithTenant = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as RequestDuplex })
      })
      
      // Pass the modified request to the handler
      return handler(requestWithTenant as NextRequest, ...args)
    }
    
    return handler(request, ...args)
  }
}

/**
 * Middleware to enforce admin-only access
 * @param _request The Next.js request object (unused but kept for middleware signature)
 * @returns NextResponse or null to continue
 */
export async function enforceAdmin(_request: NextRequest): Promise<NextResponse | null> {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    const userRole = user.role as UserRole
    
    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'This action requires administrator privileges'
        },
        { status: 403 }
      )
    }
    
    return null // Continue with the request
  } catch (error) {
    console.error('Admin enforcement error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * API route wrapper that enforces admin-only access
 * @param handler The API route handler
 * @returns A wrapped handler function with admin enforcement
 */
export function withAdmin<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const adminResponse = await enforceAdmin(request)
    if (adminResponse) {
      return adminResponse
    }
    
    return handler(request, ...args)
  }
}

/**
 * Middleware to enforce superadmin-only access
 * @param _request The Next.js request object (unused but kept for middleware signature)
 * @returns NextResponse or null to continue
 */
export async function enforceSuperAdmin(_request: NextRequest): Promise<NextResponse | null> {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { user } = session
    const userRole = user.role as UserRole
    
    if (userRole !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'This action requires superadmin privileges'
        },
        { status: 403 }
      )
    }
    
    return null // Continue with the request
  } catch (error) {
    console.error('Superadmin enforcement error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * API route wrapper that enforces superadmin-only access
 * @param handler The API route handler
 * @returns A wrapped handler function with superadmin enforcement
 */
export function withSuperAdmin<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const superAdminResponse = await enforceSuperAdmin(request)
    if (superAdminResponse) {
      return superAdminResponse
    }
    
    return handler(request, ...args)
  }
}

/**
 * Next.js middleware function to enforce role-based access for frontend routes
 * This can be used in middleware.ts to protect frontend routes
 * @param request The Next.js request object
 * @param resourcePathMap Map of paths to resources and actions
 * @returns NextResponse or null to continue
 */
export async function rbacPageMiddleware(
  request: NextRequest,
  resourcePathMap: Record<string, { resource: Resource; action: Action }>
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  
  // Find matching path pattern
  const matchingPath = Object.keys(resourcePathMap).find(path => 
    pathname.startsWith(path) || pathname === path
  )
  
  if (!matchingPath) {
    return null // No RBAC rules for this path
  }
  
  const { resource, action } = resourcePathMap[matchingPath]
  
  try {
    const session = await auth()
    
    if (!session?.user) {
      // Redirect to login page
      const redirectUrl = new URL('/auth/signin', request.url)
      redirectUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    const { user } = session
    const userRole = user.role as UserRole
    
    // Check if user has permission
    if (!hasPermission(userRole, resource, action)) {
      // Redirect to forbidden page
      return NextResponse.redirect(new URL('/forbidden', request.url))
    }
    
    return null // Continue with the request
  } catch (error) {
    console.error('RBAC page middleware error:', error)
    return null // Continue with the request in case of error
  }
}