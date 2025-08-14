import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SecurityMonitoringService } from '@/services/security-monitoring.service';
import { z } from 'zod';

const securityMonitoringService = SecurityMonitoringService.getInstance();

// Schema for resolving threats
const resolveThreatSchema = z.object({
  threatId: z.string(),
  resolution: z.string().min(1, 'Resolution is required'),
});

/**
 * GET /api/security/threats
 * Get active security threats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow ADMIN and SUPERADMIN roles to access security threats
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threats = await securityMonitoringService.getActiveThreats(session.user.tenantId);

    return NextResponse.json({
      success: true,
      data: threats,
    });
  } catch (error) {
    console.error('Security threats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/security/threats
 * Resolve a security threat
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow ADMIN and SUPERADMIN roles to resolve security threats
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = resolveThreatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { threatId, resolution } = validation.data;

    await securityMonitoringService.resolveSecurityThreat(
      threatId,
      session.user.id,
      resolution
    );

    return NextResponse.json({
      success: true,
      message: 'Security threat resolved successfully',
    });
  } catch (error) {
    console.error('Resolve security threat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}