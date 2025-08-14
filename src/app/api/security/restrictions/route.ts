import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SecurityMonitoringService } from '@/services/security-monitoring.service';
import { z } from 'zod';

const securityMonitoringService = SecurityMonitoringService.getInstance();

// IP address validation regex (supports both IPv4 and IPv6)
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

// Schema for IP restrictions
const ipRestrictionSchema = z.object({
  ipAddress: z.string().refine(
    (ip) => ipv4Regex.test(ip) || ipv6Regex.test(ip),
    { message: 'Invalid IP address format' }
  ),
  type: z.enum(['ALLOW', 'BLOCK']),
  reason: z.string().min(1, 'Reason is required'),
  expiresAt: z.string().optional().transform(str => str ? new Date(str) : undefined),
});

// Schema for geolocation restrictions
const geoRestrictionSchema = z.object({
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
  type: z.enum(['ALLOW', 'BLOCK']),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * POST /api/security/restrictions
 * Add IP or geolocation restrictions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow ADMIN and SUPERADMIN roles to manage restrictions
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { restrictionType } = body;

    if (restrictionType === 'ip') {
      const validation = ipRestrictionSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid IP restriction data', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { ipAddress, type, reason, expiresAt } = validation.data;

      // SUPERADMIN can create global restrictions, ADMIN can only create tenant-specific
      const tenantId = session.user.role === 'SUPERADMIN' && body.global ? null : session.user.tenantId;

      await securityMonitoringService.addIPRestriction(
        ipAddress,
        type,
        tenantId,
        reason,
        session.user.id,
        expiresAt
      );

      return NextResponse.json({
        success: true,
        message: 'IP restriction added successfully',
      });
    } else if (restrictionType === 'geolocation') {
      const validation = geoRestrictionSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid geolocation restriction data', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { countryCode, type, reason } = validation.data;

      await securityMonitoringService.addGeolocationRestriction(
        countryCode,
        type,
        session.user.tenantId,
        reason,
        session.user.id
      );

      return NextResponse.json({
        success: true,
        message: 'Geolocation restriction added successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid restriction type. Must be "ip" or "geolocation"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Security restrictions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}