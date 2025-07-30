import { NextRequest, NextResponse } from 'next/server';
import { FormService } from '@/services/form.service';
import { z } from 'zod';

const submitFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  referrer: z.string().optional(),
});

/**
 * POST /api/forms/[id]/submit - Submit a form (public endpoint)
 * This endpoint doesn't require authentication as it's used by the embed widget
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const formId = params.id;
    const body = await request.json();
    
    // Validate the submission data
    const validatedData = submitFormSchema.parse(body);

    // Get client IP if not provided
    let ipAddress = validatedData.ipAddress;
    if (!ipAddress) {
      ipAddress = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';
    }

    // Get user agent if not provided
    let userAgent = validatedData.userAgent;
    if (!userAgent) {
      userAgent = request.headers.get('user-agent') || 'unknown';
    }

    // Submit the form
    const result = await FormService.submitForm(formId, {
      ...validatedData,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      submissionId: result.submission.id,
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          message: error.issues[0]?.message || 'Invalid form data',
          details: error.issues 
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Submission failed', message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit form', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/forms/[id]/submit - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}