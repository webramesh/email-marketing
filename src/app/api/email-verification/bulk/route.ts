import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { EmailVerificationService } from '@/services/email-verification.service';
import { z } from 'zod';

const prisma = new PrismaClient();
const emailVerificationService = new EmailVerificationService(prisma);

const bulkVerificationSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(10000), // Limit to 10k emails per batch
  listId: z.string().optional(),
  removeInvalid: z.boolean().optional().default(false),
  removeRisky: z.boolean().optional().default(false),
});

/**
 * POST /api/email-verification/bulk
 * Start bulk email verification job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = bulkVerificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { emails, listId, removeInvalid, removeRisky } = validation.data;
    const tenantId = session.user.tenantId;

    // Validate list exists if provided
    if (listId) {
      const list = await prisma.list.findFirst({
        where: {
          id: listId,
          tenantId,
        },
      });

      if (!list) {
        return NextResponse.json(
          { success: false, error: 'List not found' },
          { status: 404 }
        );
      }
    }

    // Start bulk verification job
    const job = await emailVerificationService.startBulkVerification(
      emails,
      tenantId,
      {
        listId,
        removeInvalid,
        removeRisky,
      }
    );

    return NextResponse.json({
      success: true,
      data: job,
    });

  } catch (error) {
    console.error('Bulk verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}