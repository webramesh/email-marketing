import { NextRequest, NextResponse } from 'next/server';
import { tenantMiddleware, middlewareConfigs } from './src/lib/tenant/middleware';

/**
 * Next.js Middleware for tenant isolation and routing
 * This runs on every request to enforce tenant context
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  try {
    // Apply tenant middleware based on route type
    let response: NextResponse | null = null;

    if (pathname.startsWith('/api/')) {
      // API routes require tenant context
      response = await tenantMiddleware(request, middlewareConfigs.api);
    } else if (pathname.startsWith('/admin/')) {
      // Admin routes require tenant and admin role
      response = await tenantMiddleware(request, middlewareConfigs.admin);
    } else {
      // Public routes may or may not require tenant
      response = await tenantMiddleware(request, middlewareConfigs.public);
    }

    // Return the response from tenant middleware if it exists
    if (response) {
      return response;
    }

    // Continue with the request
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    
    // Return error response
    return new NextResponse(
      JSON.stringify({
        error: 'Middleware error',
        message: 'Failed to process request',
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
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};