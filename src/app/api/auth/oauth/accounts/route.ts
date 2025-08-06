import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { OAuthService } from '@/services/oauth.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's OAuth accounts
    const oauthAccounts = await OAuthService.getUserOAuthAccounts(session.user.id);

    // Format response to exclude sensitive data
    const formattedAccounts = oauthAccounts.map(account => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      name: account.name,
      image: account.image,
      linkedAt: account.linkedAt,
      lastUsedAt: account.lastUsedAt,
      isActive: account.isActive,
    }));

    return NextResponse.json({
      accounts: formattedAccounts,
      providers: formattedAccounts.map(account => account.provider),
    });
  } catch (error) {
    console.error('Error getting OAuth accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}