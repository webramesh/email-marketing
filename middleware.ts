import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { enforceMFA, mfaPageMiddleware } from "@/lib/mfa-middleware"
import { rbacPageMiddleware } from "@/lib/rbac/authorization"
import { Resource, Action } from "@/lib/rbac/permissions"

// Define resource paths for RBAC enforcement
const resourcePathMap = {
  // Admin routes
  '/admin': { resource: Resource.SYSTEM_SETTINGS, action: Action.READ },
  '/admin/users': { resource: Resource.USERS, action: Action.MANAGE },
  '/admin/roles': { resource: Resource.USER_ROLES, action: Action.MANAGE },
  '/admin/settings': { resource: Resource.SYSTEM_SETTINGS, action: Action.MANAGE },
  '/admin/audit-logs': { resource: Resource.AUDIT_LOGS, action: Action.READ },
  '/admin/tenant-settings': { resource: Resource.TENANT_SETTINGS, action: Action.MANAGE },
  
  // Campaign management
  '/campaigns': { resource: Resource.CAMPAIGNS, action: Action.READ },
  '/campaigns/create': { resource: Resource.CAMPAIGNS, action: Action.CREATE },
  '/campaigns/edit': { resource: Resource.CAMPAIGNS, action: Action.UPDATE },
  '/campaigns/delete': { resource: Resource.CAMPAIGNS, action: Action.DELETE },
  
  // Subscriber management
  '/subscribers': { resource: Resource.SUBSCRIBERS, action: Action.READ },
  '/subscribers/import': { resource: Resource.SUBSCRIBERS, action: Action.IMPORT },
  '/subscribers/export': { resource: Resource.SUBSCRIBERS, action: Action.EXPORT },
  
  // Email templates
  '/templates': { resource: Resource.EMAIL_TEMPLATES, action: Action.READ },
  
  // Lists and segments
  '/lists': { resource: Resource.LISTS, action: Action.READ },
  '/segments': { resource: Resource.SEGMENTS, action: Action.READ },
  
  // Automations
  '/automations': { resource: Resource.AUTOMATIONS, action: Action.READ },
  '/workflows': { resource: Resource.WORKFLOWS, action: Action.READ },
  
  // Analytics and reports
  '/analytics': { resource: Resource.ANALYTICS, action: Action.READ },
  '/reports': { resource: Resource.REPORTS, action: Action.READ },
  
  // Email infrastructure
  '/sending-servers': { resource: Resource.SENDING_SERVERS, action: Action.READ },
  '/domains': { resource: Resource.DOMAINS, action: Action.READ },
  '/verification': { resource: Resource.EMAIL_VERIFICATION, action: Action.READ },
  
  // Forms and landing pages
  '/forms': { resource: Resource.FORMS, action: Action.READ },
  '/landing-pages': { resource: Resource.LANDING_PAGES, action: Action.READ },
  
  // Support system
  '/support': { resource: Resource.SUPPORT_TICKETS, action: Action.READ },
  
  // Billing and payments
  '/billing': { resource: Resource.BILLING, action: Action.READ },
  '/payments': { resource: Resource.PAYMENTS, action: Action.READ },
  '/subscription': { resource: Resource.SUBSCRIPTION_PLANS, action: Action.READ },
  
  // API and integrations
  '/api-keys': { resource: Resource.API_KEYS, action: Action.READ },
  '/webhooks': { resource: Resource.WEBHOOKS, action: Action.READ },
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow access to public resources without authentication
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public/")
  ) {
    return NextResponse.next()
  }

  // Allow access to auth pages without authentication
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next()
  }

  // Check authentication
  const session = await auth()
  
  if (!session?.user) {
    // Allow access to API auth routes without session
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next()
    }
    
    // Redirect to login for other routes
    const redirectUrl = new URL("/auth/signin", request.url)
    redirectUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Skip MFA enforcement for MFA-related API routes
  if (pathname.startsWith("/api/auth/mfa/") && 
      !pathname.startsWith("/api/auth/mfa/disable")) {
    return NextResponse.next()
  }
  
  // Enforce MFA for sensitive API operations
  if (pathname.startsWith("/api/")) {
    const mfaResponse = await enforceMFA(request)
    if (mfaResponse) {
      return mfaResponse
    }
  } else {
    // Enforce MFA for sensitive frontend pages
    const mfaPageResponse = await mfaPageMiddleware(request)
    if (mfaPageResponse) {
      return mfaPageResponse
    }
    
    // Enforce RBAC for frontend pages
    const rbacResponse = await rbacPageMiddleware(request, resourcePathMap)
    if (rbacResponse) {
      return rbacResponse
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}