/**
 * API utilities and middleware for the email marketing platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { auth } from '@/lib/auth';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  tenantId: string;
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Standard API response helper
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: string,
  meta?: any
): ApiResponse<T> {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(error && { error }),
    ...(meta && { meta }),
  };
}

// Error response helper
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(createApiResponse(false, undefined, undefined, error, details), {
    status,
  });
}

// Success response helper
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status: number = 200,
  meta?: any
): NextResponse {
  return NextResponse.json(createApiResponse(true, data, message, undefined, meta), { status });
}

// Validation middleware
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, validatedData: T) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const body = await request.json();
      const validatedData = schema.parse(body);
      return await handler(request, validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Validation failed', 400, error.issues);
      }
      console.error('Validation middleware error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  };
}

// Query parameter validation
export function validateQueryParams<T>(request: NextRequest, schema: z.ZodSchema<T>): T {
  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());
  return schema.parse(queryParams);
}

// Pagination helpers
export interface PaginationParams {
  page: number;
  limit: number;
}

export const paginationSchema = z
  .object({
    page: z.string().transform(Number).optional().default(1),
    limit: z.string().transform(Number).optional().default(10),
  })
  .transform(data => ({
    page: Math.max(1, data.page),
    limit: Math.min(Math.max(1, data.limit), 100), // Max 100 per page
  }));

export function createPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };
}

// Tenant context helper
export function getTenantId(request: NextRequest): string | null {
  return request.headers.get('X-Tenant-ID') || request.headers.get('x-mock-tenant-id'); // For development
}

export function requireTenantId(request: NextRequest): string {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  return tenantId;
}

// User context helper
export function getUserId(request: NextRequest): string | null {
  return request.headers.get('X-User-ID') || request.headers.get('x-mock-user-id'); // For development
}

// API Key authentication
export async function validateApiKey(apiKey: string): Promise<ApiKey | null> {
  // This would typically query the database for the API key
  // For now, we'll implement a basic structure
  try {
    // Decode the API key (assuming it's a JWT for this implementation)
    const decoded = jwt.verify(apiKey, process.env.API_KEY_SECRET || 'default-secret') as any;

    // Return mock API key data - in production this would query the database
    return {
      id: decoded.keyId,
      name: decoded.name,
      key: apiKey,
      tenantId: decoded.tenantId,
      permissions: decoded.permissions || [],
      isActive: true,
      createdAt: new Date(decoded.iat * 1000),
      updatedAt: new Date(),
    };
  } catch (error) {
    return null;
  }
}

// API authentication middleware
export function withApiAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check for API key in header
      const apiKey =
        request.headers.get('X-API-Key') ||
        request.headers.get('Authorization')?.replace('Bearer ', '');

      if (apiKey) {
        // Validate API key
        const validApiKey = await validateApiKey(apiKey);
        if (!validApiKey || !validApiKey.isActive) {
          return createErrorResponse('Invalid or inactive API key', 401);
        }

        // Add API key context to headers
        const headers = new Headers(request.headers);
        headers.set('X-Tenant-ID', validApiKey.tenantId);
        headers.set('X-API-Key-ID', validApiKey.id);

        // Create new request with updated headers
        const newRequest = new NextRequest(request.url, {
          method: request.method,
          headers,
          body: request.body,
        });

        return await handler(newRequest);
      }

      // Check for session-based authentication
      const session = await auth();
      if (!session?.user) {
        return createErrorResponse('Authentication required', 401);
      }

      return await handler(request);
    } catch (error) {
      console.error('API authentication error:', error);
      return createErrorResponse('Authentication failed', 401);
    }
  };
}

// Rate limiting store (in-memory for now, should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
export function withRateLimit(config: RateLimitConfig) {
  return function (handler: (request: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      try {
        // Create rate limit key based on IP and tenant
        const ip =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          request.headers.get('cf-connecting-ip') ||
          'unknown';
        const tenantId = getTenantId(request) || 'no-tenant';
        const key = `${ip}:${tenantId}`;

        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Get current rate limit data
        const current = rateLimitStore.get(key);

        if (!current || current.resetTime <= windowStart) {
          // Reset or initialize rate limit
          rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
        } else if (current.count >= config.maxRequests) {
          // Rate limit exceeded
          return NextResponse.json(
            createApiResponse(false, undefined, undefined, 'Rate limit exceeded'),
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString(),
              },
            }
          );
        } else {
          // Increment counter
          current.count++;
          rateLimitStore.set(key, current);
        }

        // Execute handler
        const response = await handler(request);

        // Add rate limit headers
        const remaining = Math.max(0, config.maxRequests - (current?.count || 1));
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set(
          'X-RateLimit-Reset',
          Math.ceil((current?.resetTime || now + config.windowMs) / 1000).toString()
        );

        return response;
      } catch (error) {
        console.error('Rate limiting error:', error);
        return await handler(request);
      }
    };
  };
}

// Combine multiple middleware
export function withMiddleware(...middlewares: Array<(handler: any) => any>) {
  return function (handler: (request: NextRequest) => Promise<NextResponse>) {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

// Standard API route wrapper
export function createApiRoute(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    auth?: boolean;
    rateLimit?: RateLimitConfig;
    validation?: z.ZodSchema<any>;
  } = {}
) {
  let wrappedHandler = handler;

  // Apply validation if provided
  if (options.validation) {
    wrappedHandler = withValidation(options.validation, async (req, data) => {
      // Add validated data to request context
      (req as any).validatedData = data;
      return handler(req);
    });
  }

  // Apply rate limiting if provided
  if (options.rateLimit) {
    wrappedHandler = withRateLimit(options.rateLimit)(wrappedHandler);
  }

  // Apply authentication if required
  if (options.auth !== false) {
    wrappedHandler = withApiAuth(wrappedHandler);
  }

  return wrappedHandler;
}
