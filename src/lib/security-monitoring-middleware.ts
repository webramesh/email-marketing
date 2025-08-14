import { NextRequest, NextResponse } from 'next/server';
import { SecurityMonitoringService } from '@/services/security-monitoring.service';
import { getClientIP } from '@/lib/session-management';

const securityMonitoringService = SecurityMonitoringService.getInstance();

/**
 * Security monitoring middleware for login attempts
 */
export async function securityMonitoringMiddleware(request: NextRequest): Promise<NextResponse | null> {
  try {
    const pathname = request.nextUrl.pathname;

    // Only monitor authentication-related endpoints
    if (!isAuthenticationEndpoint(pathname)) {
      return null;
    }

    // For login attempts, we'll handle monitoring in the actual auth handlers
    // This middleware is mainly for additional security checks
    
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Check for suspicious patterns in requests
    await detectSuspiciousRequestPatterns(request, ipAddress, userAgent);

    return null; // Continue with the request
  } catch (error) {
    console.error('Security monitoring middleware error:', error);
    return null; // Don't block requests due to monitoring errors
  }
}

/**
 * Check if the endpoint is authentication-related
 */
function isAuthenticationEndpoint(pathname: string): boolean {
  const authEndpoints = [
    '/api/auth/signin',
    '/api/auth/signup',
    '/api/auth/callback',
    '/auth/signin',
    '/auth/signup',
  ];

  return authEndpoints.some(endpoint => pathname.startsWith(endpoint));
}

/**
 * Detect suspicious request patterns
 */
async function detectSuspiciousRequestPatterns(
  request: NextRequest,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    // Check for automated tools in user agent
    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /postman/i,
    ];

    const isAutomated = suspiciousUserAgents.some(pattern => pattern.test(userAgent));
    
    if (isAutomated) {
      console.warn('Suspicious automated request detected:', {
        ipAddress,
        userAgent,
        pathname: request.nextUrl.pathname,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for missing or suspicious headers
    const hasReferer = request.headers.has('referer');
    const hasAcceptLanguage = request.headers.has('accept-language');
    const hasAccept = request.headers.has('accept');

    if (!hasReferer && !hasAcceptLanguage && !hasAccept) {
      console.warn('Request with missing common headers detected:', {
        ipAddress,
        userAgent,
        pathname: request.nextUrl.pathname,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error detecting suspicious request patterns:', error);
  }
}

/**
 * Enhanced login monitoring wrapper for authentication handlers
 */
export function withSecurityMonitoring<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now();
    let response: NextResponse;

    try {
      // Execute the original handler
      response = await handler(request, ...args);

      // Monitor the response for security insights
      await monitorAuthenticationResponse(request, response, Date.now() - startTime);

      return response;
    } catch (error) {
      // Log authentication errors for security monitoring
      await logAuthenticationError(request, error, Date.now() - startTime);
      throw error;
    }
  };
}

/**
 * Monitor authentication response for security insights
 */
async function monitorAuthenticationResponse(
  request: NextRequest,
  response: NextResponse,
  responseTime: number
): Promise<void> {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const pathname = request.nextUrl.pathname;
    const statusCode = response.status;

    // Log suspicious response patterns
    if (statusCode === 401 || statusCode === 403) {
      console.warn('Authentication failure detected:', {
        ipAddress,
        userAgent,
        pathname,
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Monitor for unusually fast responses (potential automated attacks)
    if (responseTime < 100 && statusCode >= 400) {
      console.warn('Unusually fast authentication failure:', {
        ipAddress,
        userAgent,
        pathname,
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error monitoring authentication response:', error);
  }
}

/**
 * Log authentication errors for security monitoring
 */
async function logAuthenticationError(
  request: NextRequest,
  error: any,
  responseTime: number
): Promise<void> {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const pathname = request.nextUrl.pathname;

    console.error('Authentication error for security monitoring:', {
      ipAddress,
      userAgent,
      pathname,
      error: error.message || 'Unknown error',
      responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (monitoringError) {
    console.error('Error logging authentication error:', monitoringError);
  }
}

/**
 * Rate limiting for authentication endpoints
 */
export class AuthenticationRateLimiter {
  private static attempts = new Map<string, { count: number; resetTime: number }>();
  private static readonly MAX_ATTEMPTS = 10;
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  static async checkRateLimit(ipAddress: string): Promise<{ allowed: boolean; resetTime?: number }> {
    const now = Date.now();
    const key = `auth_${ipAddress}`;
    const current = this.attempts.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.attempts.set(key, { count: 1, resetTime: now + this.WINDOW_MS });
      return { allowed: true };
    }

    if (current.count >= this.MAX_ATTEMPTS) {
      return { allowed: false, resetTime: current.resetTime };
    }

    // Increment count
    current.count++;
    this.attempts.set(key, current);

    return { allowed: true };
  }

  static async recordAttempt(ipAddress: string): Promise<void> {
    await this.checkRateLimit(ipAddress);
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.attempts.entries()) {
      if (now > value.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  AuthenticationRateLimiter.cleanup();
}, 5 * 60 * 1000);