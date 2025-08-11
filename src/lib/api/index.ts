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
export async function validateApiKey(apiKey: string): Promise<import('@/services/api-key.service').ApiKey | null> {
  // Import here to avoid circular dependencies
  const { ApiKeyService } = await import('@/services/api-key.service');
  return ApiKeyService.validateApiKey(apiKey);
}

// API authentication middleware
export function withApiAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check for JWT access token first
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Try to validate as JWT access token
        const { JwtRefreshService } = await import('@/services/jwt-refresh.service');
        const jwtPayload = await JwtRefreshService.validateAccessToken(token);
        
        if (jwtPayload) {
          // Add JWT context to headers
          const headers = new Headers(request.headers);
          headers.set('X-Tenant-ID', jwtPayload.tenantId);
          headers.set('X-API-Key-ID', jwtPayload.sub);
          if (jwtPayload.userId) {
            headers.set('X-User-ID', jwtPayload.userId);
          }

          // Create new request with updated headers
          const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers,
            body: request.body,
          });

          return await handler(newRequest);
        }
      }

      // Check for API key in header
      const apiKey =
        request.headers.get('X-API-Key') ||
        (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

      if (apiKey) {
        // Validate API key
        const validApiKey = await validateApiKey(apiKey);
        if (!validApiKey || !validApiKey.isActive) {
          return createErrorResponse('Invalid or inactive API key', 401);
        }

        // Get client IP for validation and rate limiting
        const clientIp = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        request.headers.get('cf-connecting-ip') || 
                        'unknown';

        // Validate IP restrictions
        const { ApiKeyService } = await import('@/services/api-key.service');
        if (!ApiKeyService.validateIpAddress(validApiKey, clientIp)) {
          return createErrorResponse('Access denied: IP address not allowed', 403);
        }

        // Validate domain restrictions
        const requestDomain = request.headers.get('host') || '';
        if (!ApiKeyService.validateDomain(validApiKey, requestDomain)) {
          return createErrorResponse('Access denied: Domain not allowed', 403);
        }

        // Check rate limits
        const rateLimitResult = await ApiKeyService.checkRateLimit(validApiKey, clientIp);
        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            createApiResponse(false, undefined, undefined, 'Rate limit exceeded'),
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': (validApiKey.rateLimit || 0).toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
              },
            }
          );
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

        // Log API usage
        const startTime = Date.now();
        const response = await handler(newRequest);
        const responseTime = Date.now() - startTime;

        // Log usage asynchronously
        setImmediate(async () => {
          try {
            const requestSize = request.headers.get('content-length') ? 
              parseInt(request.headers.get('content-length')!) : undefined;
            const responseSize = response.headers.get('content-length') ? 
              parseInt(response.headers.get('content-length')!) : undefined;

            await ApiKeyService.logApiKeyUsage(
              validApiKey.id,
              new URL(request.url).pathname,
              request.method,
              response.status,
              responseTime,
              {
                ipAddress: clientIp,
                userAgent: request.headers.get('user-agent') || undefined,
                requestSize,
                responseSize,
              }
            );
          } catch (error) {
            console.error('Failed to log API usage:', error);
          }
        });

        // Add rate limit headers to response
        response.headers.set('X-RateLimit-Limit', (validApiKey.rateLimit || 0).toString());
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
        response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

        return response;
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
