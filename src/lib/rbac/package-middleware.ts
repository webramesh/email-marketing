/**
 * Package-based Permission Middleware
 * Middleware for enforcing package-based permissions in API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnhancedAuthorizationService } from './enhanced-authorization';
import { Resource, Action } from './permissions';

const authService = new EnhancedAuthorizationService();

/**
 * Middleware factory for package-based permission checking
 */
export function withPackagePermission<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  resource: Resource,
  action: Action,
  options?: {
    quotaCheck?: string; // Quota type to check before action
    quotaIncrement?: number; // How much to increment quota usage
    updateUsageAfter?: boolean; // Whether to update usage after successful action
  }
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Check enhanced permissions (role + package)
      const permissionResult = await authService.checkEnhancedPermission(
        request,
        resource,
        action
      );

      if (!permissionResult.allowed || !permissionResult.context) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: permissionResult.reason || 'Access denied',
            details: permissionResult.context ? {
              hasRolePermission: permissionResult.context.hasRolePermission,
              hasPackagePermission: permissionResult.context.hasPackagePermission,
              restrictions: permissionResult.context.restrictions,
              quotaStatus: permissionResult.context.quotaStatus
            } : undefined
          },
          { status: 403 }
        );
      }

      // Check quota if specified
      if (options?.quotaCheck) {
        const quotaResult = await authService.checkQuotaBeforeAction(
          permissionResult.context.user.id,
          permissionResult.context.user.tenantId,
          options.quotaCheck,
          options.quotaIncrement || 1
        );

        if (!quotaResult.allowed) {
          return NextResponse.json(
            {
              error: 'Quota Exceeded',
              message: quotaResult.reason,
              usage: quotaResult.usage
            },
            { status: 429 }
          );
        }
      }

      // Add enhanced context to request headers
      const headers = new Headers(request.headers);
      headers.set('X-User-ID', permissionResult.context.user.id);
      headers.set('X-Tenant-ID', permissionResult.context.user.tenantId);
      headers.set('X-User-Role', permissionResult.context.user.role);
      
      const highestTier = permissionResult.context.packages.packages[0]?.tier || 'NONE';
      headers.set('X-Package-Tier', highestTier);

      const enhancedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as const })
      });

      // Execute the handler
      const response = await handler(enhancedRequest as NextRequest, ...args);

      // Update usage after successful action if specified
      if (options?.updateUsageAfter && 
          options?.quotaCheck && 
          response.status >= 200 && 
          response.status < 300) {
        
        // Update usage asynchronously (don't wait for it)
        authService.updateUsage(
          permissionResult.context.user.id,
          permissionResult.context.user.tenantId,
          options.quotaCheck,
          options.quotaIncrement || 1
        ).catch(error => {
          console.error('Failed to update usage:', error);
        });
      }

      return response;

    } catch (error) {
      console.error('Package permission middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware for checking feature availability
 */
export function withFeatureCheck<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  featureKey: string,
  resource: Resource = Resource.SYSTEM_SETTINGS,
  action: Action = Action.READ
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // First check basic permissions
      const permissionResult = await authService.checkEnhancedPermission(
        request,
        resource,
        action
      );

      if (!permissionResult.allowed || !permissionResult.context) {
        return NextResponse.json(
          { error: 'Forbidden', message: permissionResult.reason },
          { status: 403 }
        );
      }

      // Check if user has the required feature
      const hasFeature = permissionResult.context.packages.packages.some(
        pkg => pkg.status === 'active' && pkg.features[featureKey] === true
      );

      if (!hasFeature) {
        return NextResponse.json(
          {
            error: 'Feature Not Available',
            message: `Feature '${featureKey}' is not available in your current package`,
            featureKey,
            availableFeatures: Object.keys(
              permissionResult.context.packages.packages
                .filter(pkg => pkg.status === 'active')
                .reduce((acc, pkg) => ({ ...acc, ...pkg.features }), {})
            ).filter(key => 
              permissionResult.context!.packages.packages.some(
                pkg => pkg.features[key] === true
              )
            )
          },
          { status: 403 }
        );
      }

      // Add context to request headers
      const headers = new Headers(request.headers);
      headers.set('X-User-ID', permissionResult.context.user.id);
      headers.set('X-Tenant-ID', permissionResult.context.user.tenantId);
      headers.set('X-Feature-Checked', featureKey);

      const enhancedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as const })
      });

      return handler(enhancedRequest as NextRequest, ...args);

    } catch (error) {
      console.error('Feature check middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware for quota-only checking (without permission check)
 */
export function withQuotaCheck<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  quotaType: string,
  increment: number = 1,
  updateAfter: boolean = true
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Get basic user context
      const permissionResult = await authService.checkEnhancedPermission(
        request,
        Resource.ANALYTICS, // Use basic resource for auth
        Action.READ
      );

      if (!permissionResult.context) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check quota
      const quotaResult = await authService.checkQuotaBeforeAction(
        permissionResult.context.user.id,
        permissionResult.context.user.tenantId,
        quotaType,
        increment
      );

      if (!quotaResult.allowed) {
        return NextResponse.json(
          {
            error: 'Quota Exceeded',
            message: quotaResult.reason,
            usage: quotaResult.usage,
            quotaType
          },
          { status: 429 }
        );
      }

      // Add context to request headers
      const headers = new Headers(request.headers);
      headers.set('X-User-ID', permissionResult.context.user.id);
      headers.set('X-Tenant-ID', permissionResult.context.user.tenantId);
      headers.set('X-Quota-Type', quotaType);
      headers.set('X-Quota-Increment', increment.toString());

      const enhancedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as const })
      });

      // Execute handler
      const response = await handler(enhancedRequest as NextRequest, ...args);

      // Update usage after successful action
      if (updateAfter && response.status >= 200 && response.status < 300) {
        authService.updateUsage(
          permissionResult.context.user.id,
          permissionResult.context.user.tenantId,
          quotaType,
          increment
        ).catch(error => {
          console.error('Failed to update quota usage:', error);
        });
      }

      return response;

    } catch (error) {
      console.error('Quota check middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Combined middleware for permission, feature, and quota checking
 */
export function withAdvancedPermission<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  config: {
    resource: Resource;
    action: Action;
    feature?: string;
    quota?: {
      type: string;
      increment?: number;
      updateAfter?: boolean;
    };
  }
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Check enhanced permissions
      const permissionResult = await authService.checkEnhancedPermission(
        request,
        config.resource,
        config.action
      );

      if (!permissionResult.allowed || !permissionResult.context) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: permissionResult.reason,
            details: permissionResult.context ? {
              hasRolePermission: permissionResult.context.hasRolePermission,
              hasPackagePermission: permissionResult.context.hasPackagePermission,
              restrictions: permissionResult.context.restrictions
            } : undefined
          },
          { status: 403 }
        );
      }

      // Check feature if specified
      if (config.feature) {
        const hasFeature = permissionResult.context.packages.packages.some(
          pkg => pkg.status === 'active' && pkg.features[config.feature!] === true
        );

        if (!hasFeature) {
          return NextResponse.json(
            {
              error: 'Feature Not Available',
              message: `Feature '${config.feature}' is not available in your current package`,
              featureKey: config.feature
            },
            { status: 403 }
          );
        }
      }

      // Check quota if specified
      if (config.quota) {
        const quotaResult = await authService.checkQuotaBeforeAction(
          permissionResult.context.user.id,
          permissionResult.context.user.tenantId,
          config.quota.type,
          config.quota.increment || 1
        );

        if (!quotaResult.allowed) {
          return NextResponse.json(
            {
              error: 'Quota Exceeded',
              message: quotaResult.reason,
              usage: quotaResult.usage,
              quotaType: config.quota.type
            },
            { status: 429 }
          );
        }
      }

      // Add comprehensive context to request headers
      const headers = new Headers(request.headers);
      headers.set('X-User-ID', permissionResult.context.user.id);
      headers.set('X-Tenant-ID', permissionResult.context.user.tenantId);
      headers.set('X-User-Role', permissionResult.context.user.role);
      headers.set('X-Resource', config.resource);
      headers.set('X-Action', config.action);
      
      if (config.feature) {
        headers.set('X-Feature-Required', config.feature);
      }
      
      if (config.quota) {
        headers.set('X-Quota-Type', config.quota.type);
        headers.set('X-Quota-Increment', (config.quota.increment || 1).toString());
      }

      const enhancedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
        ...(request.body && { duplex: 'half' as const })
      });

      // Execute handler
      const response = await handler(enhancedRequest as NextRequest, ...args);

      // Update quota usage after successful action
      if (config.quota?.updateAfter !== false && 
          config.quota && 
          response.status >= 200 && 
          response.status < 300) {
        
        authService.updateUsage(
          permissionResult.context.user.id,
          permissionResult.context.user.tenantId,
          config.quota.type,
          config.quota.increment || 1
        ).catch(error => {
          console.error('Failed to update quota usage:', error);
        });
      }

      return response;

    } catch (error) {
      console.error('Advanced permission middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}