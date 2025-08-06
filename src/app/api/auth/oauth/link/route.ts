import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { OAuthService } from '@/services/oauth.service';
import { z } from 'zod';

const linkOAuthSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft-entra-id']),
  providerAccountId: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  tokenType: z.string().optional(),
  scope: z.string().optional(),
  idToken: z.string().optional(),
  sessionState: z.string().optional(),
  profile: z.object({
    email: z.string().email(),
    name: z.string().optional(),
    image: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = linkOAuthSchema.parse(body);

    // Get client IP and user agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if account is already linked
    const existingAccount = await OAuthService.getOAuthAccount(
      session.user.id,
      validatedData.provider
    );

    if (existingAccount) {
      return NextResponse.json(
        { error: 'OAuth account already linked' },
        { status: 400 }
      );
    }

    // Link OAuth account
    const linkedAccount = await OAuthService.linkOAuthAccount(
      session.user.id,
      {
        type: 'oauth',
        provider: validatedData.provider,
        providerAccountId: validatedData.providerAccountId,
        access_token: validatedData.accessToken,
        refresh_token: validatedData.refreshToken,
        expires_at: validatedData.expiresAt,
        token_type: validatedData.tokenType,
        scope: validatedData.scope,
        id_token: validatedData.idToken,
        session_state: validatedData.sessionState,
      },
      {
        id: validatedData.providerAccountId,
        email: validatedData.profile.email,
        name: validatedData.profile.name,
        image: validatedData.profile.image,
        provider: validatedData.provider,
      },
      {
        ipAddress,
        userAgent,
      }
    );

    if (!linkedAccount) {
      return NextResponse.json(
        { error: 'Failed to link OAuth account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        id: linkedAccount.id,
        provider: linkedAccount.provider,
        email: linkedAccount.email,
        name: linkedAccount.name,
        image: linkedAccount.image,
        linkedAt: linkedAccount.linkedAt,
      },
    });
  } catch (error) {
    console.error('Error linking OAuth account:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}