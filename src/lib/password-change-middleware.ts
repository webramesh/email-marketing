import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Middleware to enforce password changes when required
 */
export async function passwordChangeMiddleware(request: NextRequest) {
  const session = await auth();
  
  // Skip middleware for unauthenticated users
  if (!session?.user) {
    return NextResponse.next();
  }

  // Skip middleware for certain paths
  const pathname = request.nextUrl.pathname;
  const skipPaths = [
    '/api/auth',
    '/api/profile',
    '/auth/signin',
    '/auth/signout',
    '/dashboard/profile',
    '/password-change-required',
    '/_next',
    '/favicon.ico',
  ];

  const shouldSkip = skipPaths.some(path => pathname.startsWith(path));
  if (shouldSkip) {
    return NextResponse.next();
  }

  // Check if user requires password change
  if (session.user.requiresPasswordChange) {
    // Redirect to password change page
    const url = new URL('/password-change-required', request.url);
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Check if password change is required for the current user
 */
export async function checkPasswordChangeRequired(): Promise<boolean> {
  try {
    const session = await auth();
    return session?.user?.requiresPasswordChange || false;
  } catch (error) {
    console.error('Error checking password change requirement:', error);
    return false;
  }
}