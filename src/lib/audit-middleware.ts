import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  SecurityAuditService,
  AuditAction,
  SecurityRiskLevel,
} from '@/services/security-audit.service';

export interface AuditContext {
  tenantId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  correlationId?: string;
}

export class AuditMiddleware {
  private static auditService = SecurityAuditService.getInstance();

  /**
   * Middleware to automatically log API requests
   */
  static async logApiRequest(
    request: NextRequest,
    response: NextResponse,
    context: AuditContext
  ): Promise<void> {
    try {
      const method = request.method;
      const url = request.url;
      const pathname = new URL(url).pathname;
      const statusCode = response.status;

      // Determine audit action based on HTTP method and status
      let action: AuditAction;
      let riskLevel: SecurityRiskLevel = SecurityRiskLevel.LOW;

      if (statusCode >= 400) {
        if (statusCode === 401) {
          action = AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT;
          riskLevel = SecurityRiskLevel.MEDIUM;
        } else if (statusCode === 403) {
          action = AuditAction.PERMISSION_DENIED;
          riskLevel = SecurityRiskLevel.MEDIUM;
        } else if (statusCode === 429) {
          action = AuditAction.RATE_LIMIT_EXCEEDED;
          riskLevel = SecurityRiskLevel.HIGH;
        } else {
          action = AuditAction.API_REQUEST;
          riskLevel = SecurityRiskLevel.LOW;
        }
      } else {
        switch (method) {
          case 'POST':
            action = AuditAction.DATA_CREATED;
            break;
          case 'PUT':
          case 'PATCH':
            action = AuditAction.DATA_UPDATED;
            break;
          case 'DELETE':
            action = AuditAction.DATA_DELETED;
            riskLevel = SecurityRiskLevel.MEDIUM;
            break;
          default:
            action = AuditAction.DATA_ACCESSED;
        }
      }

      await this.auditService.logAuditEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resource: 'api_endpoint',
        resourceId: pathname,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          method,
          url: pathname,
          statusCode,
          responseTime: response.headers.get('x-response-time'),
          requestSize: request.headers.get('content-length'),
          responseSize: response.headers.get('content-length'),
        },
        riskLevel,
        sessionId: context.sessionId,
        correlationId: context.correlationId,
      });
    } catch (error) {
      console.error('Failed to log API request:', error);
    }
  }

  /**
   * Log authentication events
   */
  static async logAuthEvent(
    action: AuditAction,
    context: AuditContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      let riskLevel: SecurityRiskLevel = SecurityRiskLevel.LOW;

      // Determine risk level based on action
      switch (action) {
        case AuditAction.LOGIN_FAILED:
        case AuditAction.MFA_FAILED:
          riskLevel = SecurityRiskLevel.MEDIUM;
          break;
        case AuditAction.PASSWORD_RESET_REQUESTED:
        case AuditAction.MFA_DISABLED:
          riskLevel = SecurityRiskLevel.MEDIUM;
          break;
        case AuditAction.USER_ROLE_CHANGED:
        case AuditAction.USER_DELETED:
          riskLevel = SecurityRiskLevel.HIGH;
          break;
        default:
          riskLevel = SecurityRiskLevel.LOW;
      }

      await this.auditService.logAuditEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resource: 'authentication',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata,
        riskLevel,
        sessionId: context.sessionId,
        correlationId: context.correlationId,
      });
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  /**
   * Log data access events
   */
  static async logDataAccess(
    action: AuditAction,
    resource: string,
    resourceId: string,
    context: AuditContext,
    changes?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      let riskLevel: SecurityRiskLevel = SecurityRiskLevel.LOW;

      // Determine risk level based on action and resource
      switch (action) {
        case AuditAction.DATA_DELETED:
        case AuditAction.BULK_OPERATION:
          riskLevel = SecurityRiskLevel.MEDIUM;
          break;
        case AuditAction.DATA_EXPORTED:
          riskLevel = SecurityRiskLevel.MEDIUM;
          break;
        case AuditAction.GDPR_DATA_DELETION:
        case AuditAction.GDPR_DATA_EXPORT:
          riskLevel = SecurityRiskLevel.HIGH;
          break;
        default:
          riskLevel = SecurityRiskLevel.LOW;
      }

      // Increase risk level for sensitive resources
      const sensitiveResources = ['user', 'payment', 'subscription', 'api_key'];
      if (sensitiveResources.includes(resource.toLowerCase())) {
        riskLevel =
          riskLevel === SecurityRiskLevel.LOW ? SecurityRiskLevel.MEDIUM : SecurityRiskLevel.HIGH;
      }

      await this.auditService.logAuditEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resource,
        resourceId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        changes,
        metadata,
        riskLevel,
        sessionId: context.sessionId,
        correlationId: context.correlationId,
      });
    } catch (error) {
      console.error('Failed to log data access:', error);
    }
  }

  /**
   * Log system events
   */
  static async logSystemEvent(
    action: AuditAction,
    context: AuditContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      let riskLevel: SecurityRiskLevel = SecurityRiskLevel.MEDIUM;

      // System events are generally medium to high risk
      switch (action) {
        case AuditAction.SYSTEM_CONFIG_CHANGED:
        case AuditAction.BACKUP_RESTORED:
          riskLevel = SecurityRiskLevel.HIGH;
          break;
        case AuditAction.MAINTENANCE_MODE_ENABLED:
        case AuditAction.MAINTENANCE_MODE_DISABLED:
          riskLevel = SecurityRiskLevel.HIGH;
          break;
        default:
          riskLevel = SecurityRiskLevel.MEDIUM;
      }

      await this.auditService.logAuditEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resource: 'system',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata,
        riskLevel,
        sessionId: context.sessionId,
        correlationId: context.correlationId,
      });
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }

  /**
   * Extract audit context from request
   */
  static async extractAuditContext(request: NextRequest): Promise<AuditContext> {
    try {
      // Get session information
      const session = await auth();

      // Extract tenant ID from subdomain or custom domain
      const host = request.headers.get('host') || '';
      const tenantId = await this.extractTenantId(host);

      // Extract IP address
      const ipAddress = this.extractIpAddress(request);

      // Extract user agent
      const userAgent = request.headers.get('user-agent') || undefined;

      // Generate correlation ID for request tracing
      const correlationId = this.generateCorrelationId();

      return {
        tenantId,
        userId: session?.user?.id,
        ipAddress,
        userAgent,
        sessionId: session?.user?.id ? `session_${session.user.id}` : undefined,
        correlationId,
      };
    } catch (error) {
      console.error('Failed to extract audit context:', error);
      return {
        tenantId: 'unknown',
        correlationId: this.generateCorrelationId(),
      };
    }
  }

  /**
   * Extract tenant ID from host
   */
  private static async extractTenantId(host: string): Promise<string> {
    try {
      // Check if it's a subdomain (e.g., tenant.example.com)
      const parts = host.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0];
        if (subdomain !== 'www' && subdomain !== 'api') {
          return subdomain;
        }
      }

      // Check if it's a custom domain
      // This would require a database lookup in production
      // For now, return a default tenant ID
      return 'default';
    } catch (error) {
      console.error('Failed to extract tenant ID:', error);
      return 'unknown';
    }
  }

  /**
   * Extract IP address from request
   */
  private static extractIpAddress(request: NextRequest): string | undefined {
    // Check various headers for the real IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Check for other common IP headers
    const xForwarded = request.headers.get('x-forwarded');
    if (xForwarded) {
      return xForwarded.split(',')[0].trim();
    }

    const forwardedProto = request.headers.get('forwarded');
    if (forwardedProto) {
      const match = forwardedProto.match(/for=([^;,\s]+)/);
      if (match) {
        return match[1].replace(/"/g, '');
      }
    }

    // If no IP can be determined, return undefined
    return undefined;
  }

  /**
   * Generate correlation ID for request tracing
   */
  private static generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `corr_${timestamp}_${random}`;
  }

  /**
   * Create audit middleware for Next.js API routes
   */
  static createApiMiddleware() {
    return async (request: NextRequest) => {
      const startTime = Date.now();

      // Extract audit context
      const context = await this.extractAuditContext(request);

      // Add correlation ID to request headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-correlation-id', context.correlationId!);

      // Create new request with correlation ID
      const modifiedRequest = new NextRequest(request, {
        headers: requestHeaders,
      });

      // Continue with the request
      const response = NextResponse.next({
        request: modifiedRequest,
      });

      // Add response time header
      const responseTime = Date.now() - startTime;
      response.headers.set('x-response-time', `${responseTime}ms`);
      response.headers.set('x-correlation-id', context.correlationId!);

      // Log the API request
      await this.logApiRequest(modifiedRequest, response, context);

      return response;
    };
  }
}

/**
 * Utility function to create audit context for server-side operations
 */
export async function createAuditContext(
  tenantId: string,
  userId?: string,
  additionalContext?: Partial<AuditContext>
): Promise<AuditContext> {
  return {
    tenantId,
    userId,
    correlationId: `server_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .substring(2, 8)}`,
    ...additionalContext,
  };
}

/**
 * Decorator for automatic audit logging of service methods
 */
export function auditLog(
  action: AuditAction,
  resource: string,
  options?: {
    riskLevel?: SecurityRiskLevel;
    includeArgs?: boolean;
    includeResult?: boolean;
  }
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const auditService = SecurityAuditService.getInstance();
      const startTime = Date.now();

      try {
        // Execute the original method
        const result = await method.apply(this, args);

        // Log successful operation
        const context = await createAuditContext(args[0]?.tenantId || 'unknown', args[0]?.userId);

        await auditService.logAuditEvent({
          ...context,
          action,
          resource,
          metadata: {
            method: propertyName,
            duration: Date.now() - startTime,
            success: true,
            ...(options?.includeArgs && { arguments: args }),
            ...(options?.includeResult && { result }),
          },
          riskLevel: options?.riskLevel || SecurityRiskLevel.LOW,
        });

        return result;
      } catch (error) {
        // Log failed operation
        const context = await createAuditContext(args[0]?.tenantId || 'unknown', args[0]?.userId);

        await auditService.logAuditEvent({
          ...context,
          action,
          resource,
          metadata: {
            method: propertyName,
            duration: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            ...(options?.includeArgs && { arguments: args }),
          },
          riskLevel: SecurityRiskLevel.MEDIUM,
        });

        throw error;
      }
    };

    return descriptor;
  };
}
