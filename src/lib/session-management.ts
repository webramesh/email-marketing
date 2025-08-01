import { PrismaClient } from '@/generated/prisma';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';

const prisma = new PrismaClient();

// Session configuration
const DEFAULT_SESSION_TIMEOUT = 24 * 60 * 60; // 24 hours in seconds
const REMEMBER_ME_TIMEOUT = 30 * 24 * 60 * 60; // 30 days in seconds
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const SUSPICIOUS_ACTIVITY_THRESHOLD = 10;

export interface SessionInfo {
  id: string;
  sessionToken: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  ipAddress: string;
  location?: any;
  userAgent?: string;
  isActive: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  userAgent?: string;
}

export interface SecurityAnalysis {
  riskScore: number;
  isBlocked: boolean;
  blockReason?: string;
  factors: string[];
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure remember me token
 */
export function generateRememberToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Hash a remember me token for secure storage
 */
export function hashRememberToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate device fingerprint from request
 */
export function generateDeviceFingerprint(request: NextRequest): string {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    getClientIP(request),
  ];

  return crypto.createHash('md5').update(components.join('|')).digest('hex');
}

/**
 * Parse device information from user agent
 */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    deviceType: result.device.type || 'desktop',
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    osVersion: result.os.version,
    userAgent,
  };
}

/**
 * Get IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();

  return '127.0.0.1';
}

/**
 * Analyze session security and calculate risk score
 */
export async function analyzeSessionSecurity(
  userId: string,
  ipAddress: string,
  userAgent: string,
  location?: any
): Promise<SecurityAnalysis> {
  let riskScore = 0;
  const factors: string[] = [];
  let isBlocked = false;
  let blockReason: string | undefined;

  try {
    // Check for recent failed login attempts
    const recentFailures = await prisma.sessionActivity.count({
      where: {
        userId,
        action: 'failed_login',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentFailures >= MAX_FAILED_ATTEMPTS) {
      riskScore += 50;
      factors.push('Multiple failed login attempts');
      isBlocked = true;
      blockReason = 'Too many failed login attempts';
    }

    // Check for unusual location
    const recentSessions = await prisma.userSession.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        location: true,
        ipAddress: true,
      },
    });

    if (location && recentSessions.length > 0) {
      const knownLocations = recentSessions.filter(s => s.location).map(s => s.location as any);

      const isNewLocation = !knownLocations.some(
        loc => loc?.country === location.country && loc?.city === location.city
      );

      if (isNewLocation) {
        riskScore += 20;
        factors.push('Login from new location');
      }
    }

    // Check for concurrent sessions
    const activeSessions = await prisma.userSession.count({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { maxConcurrentSessions: true },
    });

    if (user && activeSessions >= user.maxConcurrentSessions) {
      riskScore += 30;
      factors.push('Maximum concurrent sessions reached');
    }

    // Check for suspicious activity patterns
    const suspiciousActivities = await prisma.sessionActivity.count({
      where: {
        userId,
        riskScore: {
          gte: 50,
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (suspiciousActivities >= SUSPICIOUS_ACTIVITY_THRESHOLD) {
      riskScore += 40;
      factors.push('Pattern of suspicious activities');
    }

    // Check for rapid IP changes
    const recentIPs = await prisma.sessionActivity.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      select: {
        ipAddress: true,
      },
      distinct: ['ipAddress'],
    });

    if (recentIPs.length > 3) {
      riskScore += 25;
      factors.push('Multiple IP addresses in short time');
    }

    return {
      riskScore: Math.min(riskScore, 100),
      isBlocked,
      blockReason,
      factors,
    };
  } catch (error) {
    console.error('Error analyzing session security:', error);
    return {
      riskScore: 0,
      isBlocked: false,
      factors: [],
    };
  }
}

/**
 * Create a new user session
 */
export async function createUserSession(
  userId: string,
  request: NextRequest,
  rememberMe: boolean = false,
  location?: any
): Promise<{ sessionToken: string; rememberToken?: string }> {
  const sessionToken = generateSessionToken();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const deviceInfo = parseDeviceInfo(userAgent);
  const deviceFingerprint = generateDeviceFingerprint(request);

  // Analyze security
  const security = await analyzeSessionSecurity(userId, ipAddress, userAgent, location);

  if (security.isBlocked) {
    // Log security event
    await logSecurityEvent(
      userId,
      'SUSPICIOUS_LOGIN',
      'HIGH',
      security.blockReason || 'Blocked login attempt',
      {
        ipAddress,
        userAgent,
        location,
        riskScore: security.riskScore,
        factors: security.factors,
      }
    );

    throw new Error(security.blockReason || 'Login blocked due to security concerns');
  }

  // Get user session preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sessionTimeout: true,
      maxConcurrentSessions: true,
      rememberMeEnabled: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check concurrent session limit
  const activeSessions = await prisma.userSession.count({
    where: {
      userId,
      isActive: true,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (activeSessions >= user.maxConcurrentSessions) {
    // Deactivate oldest session
    const oldestSession = await prisma.userSession.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        lastActivityAt: 'asc',
      },
    });

    if (oldestSession) {
      await prisma.userSession.update({
        where: { id: oldestSession.id },
        data: { isActive: false },
      });

      await logSecurityEvent(
        userId,
        'CONCURRENT_SESSION_LIMIT',
        'MEDIUM',
        'Session terminated due to concurrent limit'
      );
    }
  }

  // Calculate session expiration
  const sessionTimeout = user.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
  const expiresAt = new Date(Date.now() + sessionTimeout * 1000);

  // Create session
  const session = await prisma.userSession.create({
    data: {
      userId,
      sessionToken,
      deviceId: deviceFingerprint,
      deviceName: `${deviceInfo.browser} on ${deviceInfo.os}`,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      os: deviceInfo.os,
      osVersion: deviceInfo.osVersion,
      ipAddress,
      location,
      userAgent,
      expiresAt,
    },
  });

  // Log session activity
  await logSessionActivity(userId, 'login', session.id, undefined, ipAddress, userAgent, location, {
    deviceInfo,
    riskScore: security.riskScore,
  });

  // Update user last login
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  let rememberToken: string | undefined;

  // Create remember me token if requested and enabled
  if (rememberMe && user.rememberMeEnabled) {
    rememberToken = generateRememberToken();
    const tokenHash = hashRememberToken(rememberToken);
    const rememberExpiresAt = new Date(Date.now() + REMEMBER_ME_TIMEOUT * 1000);

    await prisma.rememberToken.create({
      data: {
        userId,
        tokenHash,
        deviceId: deviceFingerprint,
        deviceFingerprint,
        ipAddress,
        userAgent,
        expiresAt: rememberExpiresAt,
      },
    });
  }

  return { sessionToken, rememberToken };
}

/**
 * Validate and refresh a session
 */
export async function validateSession(
  sessionToken: string,
  request: NextRequest
): Promise<SessionInfo | null> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            sessionTimeout: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return null;
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      return null;
    }

    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Check for session hijacking
    if (session.ipAddress !== ipAddress || session.userAgent !== userAgent) {
      // Log potential session hijacking
      await logSecurityEvent(
        session.userId,
        'SESSION_HIJACK_ATTEMPT',
        'HIGH',
        'Session IP or User-Agent mismatch',
        {
          originalIP: session.ipAddress,
          currentIP: ipAddress,
          originalUA: session.userAgent,
          currentUA: userAgent,
        }
      );

      // Invalidate session
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });

      return null;
    }

    // Update session activity
    const now = new Date();
    const sessionTimeout = session.user.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    const newExpiresAt = new Date(now.getTime() + sessionTimeout * 1000);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        expiresAt: newExpiresAt,
      },
    });

    // Update user last activity
    await prisma.user.update({
      where: { id: session.userId },
      data: { lastActivityAt: now },
    });

    return {
      id: session.id,
      sessionToken: session.sessionToken,
      deviceId: session.deviceId || undefined,
      deviceName: session.deviceName || undefined,
      deviceType: session.deviceType || undefined,
      browser: session.browser || undefined,
      browserVersion: session.browserVersion || undefined,
      os: session.os || undefined,
      osVersion: session.osVersion || undefined,
      ipAddress: session.ipAddress,
      location: session.location,
      userAgent: session.userAgent || undefined,
      isActive: session.isActive,
      lastActivityAt: session.lastActivityAt,
      expiresAt: newExpiresAt,
      createdAt: session.createdAt,
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionToken: string): Promise<boolean> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return false;
    }

    await prisma.userSession.update({
      where: { sessionToken },
      data: { isActive: false },
    });

    // Log session activity
    await logSessionActivity(session.userId, 'logout', session.id);

    return true;
  } catch (error) {
    console.error('Error invalidating session:', error);
    return false;
  }
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  try {
    const whereClause: any = {
      userId,
      isActive: true,
    };

    if (exceptSessionId) {
      whereClause.id = {
        not: exceptSessionId,
      };
    }

    const result = await prisma.userSession.updateMany({
      where: whereClause,
      data: { isActive: false },
    });

    // Log security event
    await logSecurityEvent(userId, 'ACCOUNT_LOCKOUT', 'MEDIUM', 'All sessions invalidated');

    return result.count;
  } catch (error) {
    console.error('Error invalidating all user sessions:', error);
    return 0;
  }
}

/**
 * Get active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
  try {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });

    return sessions.map(session => ({
      id: session.id,
      sessionToken: session.sessionToken,
      deviceId: session.deviceId || undefined,
      deviceName: session.deviceName || undefined,
      deviceType: session.deviceType || undefined,
      browser: session.browser || undefined,
      browserVersion: session.browserVersion || undefined,
      os: session.os || undefined,
      osVersion: session.osVersion || undefined,
      ipAddress: session.ipAddress,
      location: session.location,
      userAgent: session.userAgent || undefined,
      isActive: session.isActive,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
  } catch (error) {
    console.error('Error getting user active sessions:', error);
    return [];
  }
}

/**
 * Validate remember me token
 */
export async function validateRememberToken(token: string): Promise<string | null> {
  try {
    const tokenHash = hashRememberToken(token);

    const rememberToken = await prisma.rememberToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            rememberMeEnabled: true,
          },
        },
      },
    });

    if (!rememberToken || !rememberToken.isActive || !rememberToken.user.rememberMeEnabled) {
      return null;
    }

    // Check if token has expired
    if (rememberToken.expiresAt < new Date()) {
      await prisma.rememberToken.update({
        where: { id: rememberToken.id },
        data: { isActive: false },
      });
      return null;
    }

    // Update last used timestamp
    await prisma.rememberToken.update({
      where: { id: rememberToken.id },
      data: { lastUsedAt: new Date() },
    });

    return rememberToken.userId;
  } catch (error) {
    console.error('Error validating remember token:', error);
    return null;
  }
}

/**
 * Invalidate remember me token
 */
export async function invalidateRememberToken(token: string): Promise<boolean> {
  try {
    const tokenHash = hashRememberToken(token);

    const result = await prisma.rememberToken.updateMany({
      where: { tokenHash },
      data: { isActive: false },
    });

    return result.count > 0;
  } catch (error) {
    console.error('Error invalidating remember token:', error);
    return false;
  }
}

/**
 * Log session activity
 */
export async function logSessionActivity(
  userId: string,
  action: string,
  sessionId?: string,
  resource?: string,
  ipAddress?: string,
  userAgent?: string,
  location?: any,
  metadata?: any
): Promise<void> {
  try {
    // Calculate risk score based on action and context
    let riskScore = 0;

    if (action === 'failed_login') riskScore = 30;
    else if (action === 'login') riskScore = metadata?.riskScore || 0;
    else if (action === 'logout') riskScore = 0;
    else if (action.includes('delete')) riskScore = 20;
    else if (action.includes('admin')) riskScore = 15;
    else riskScore = 5;

    await prisma.sessionActivity.create({
      data: {
        userId,
        sessionId,
        action,
        resource,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent,
        location,
        metadata,
        riskScore,
      },
    });
  } catch (error) {
    console.error('Error logging session activity:', error);
  }
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  userId: string,
  eventType: string,
  severity: string,
  description: string,
  metadata?: any
): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId,
        eventType: eventType as any,
        severity: severity as any,
        description,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        location: metadata?.location,
        metadata,
      },
    });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Clean up expired sessions and tokens
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = new Date();

    // Deactivate expired sessions
    await prisma.userSession.updateMany({
      where: {
        expiresAt: {
          lt: now,
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Deactivate expired remember tokens
    await prisma.rememberToken.updateMany({
      where: {
        expiresAt: {
          lt: now,
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log('Expired sessions and tokens cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Update user session preferences
 */
export async function updateSessionPreferences(
  userId: string,
  preferences: {
    sessionTimeout?: number;
    maxConcurrentSessions?: number;
    rememberMeEnabled?: boolean;
  }
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: preferences,
    });

    return true;
  } catch (error) {
    console.error('Error updating session preferences:', error);
    return false;
  }
}
