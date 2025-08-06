import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { OAuthService } from '@/services/oauth.service';
import { z } from 'zod';

const unlinkOAuthSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft-entra-id']),
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
    const validatedData = unlinkOAuthSchema.parse(body);

    // Check if account exists
    const existingAccount = await OAuthService.getOAuthAccount(
      session.user.id,
      validatedData.provider
    );

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'OAuth account not found' },
        { status: 404 }
      );
    }

    // Unlink OAuth account
    const success = await OAuthService.unlinkOAuthAccount(
      session.user.id,
      validatedData.provider
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to unlink OAuth account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${validatedData.provider} account unlinked successfully`,
    });
  } catch (error) {
    console.error('Error unlinking OAuth account:', error);
    
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