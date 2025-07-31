import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

/**
 * User Lookup API
 * Provides user information for tenant resolution without authentication
 */

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get user's available tenants
    const tenants = await UserService.getUserTenants(email);

    if (tenants.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found for this email address' },
        { status: 404 }
      );
    }

    // Return tenant information (without sensitive data)
    const tenantInfo = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
    }));

    return NextResponse.json({
      tenants: tenantInfo,
      hasMultipleTenants: tenants.length > 1,
    });

  } catch (error) {
    console.error('User lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}