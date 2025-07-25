import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormService } from '@/services/form.service';
import { z } from 'zod';

const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required'),
  description: z.string().optional(),
  formType: z.enum(['SUBSCRIPTION', 'POPUP', 'EMBEDDED', 'LANDING_PAGE']),
  fields: z.array(z.object({
    id: z.string(),
    type: z.enum(['email', 'text', 'textarea', 'select', 'checkbox', 'radio', 'hidden']),
    label: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    validation: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
    defaultValue: z.string().optional(),
    customField: z.string().optional(),
  })),
  styling: z.object({
    theme: z.enum(['light', 'dark', 'custom']),
    primaryColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
    borderColor: z.string(),
    borderRadius: z.number(),
    fontSize: z.number(),
    fontFamily: z.string(),
    buttonStyle: z.object({
      backgroundColor: z.string(),
      textColor: z.string(),
      borderRadius: z.number(),
      padding: z.string(),
    }),
    customCss: z.string().optional(),
  }).optional(),
  settings: z.object({
    redirectUrl: z.string().optional(),
    showThankYouMessage: z.boolean(),
    thankYouMessage: z.string(),
    enableDoubleOptIn: z.boolean(),
    sendWelcomeEmail: z.boolean(),
    welcomeEmailTemplate: z.string().optional(),
    allowDuplicates: z.boolean(),
    requireEmailConfirmation: z.boolean(),
  }).optional(),
  displayRules: z.object({
    trigger: z.enum(['immediate', 'exit_intent', 'scroll', 'time_delay']),
    delay: z.number().optional(),
    scrollPercentage: z.number().optional(),
    showOnPages: z.array(z.string()).optional(),
    hideOnPages: z.array(z.string()).optional(),
    frequency: z.enum(['always', 'once_per_session', 'once_per_visitor']),
    deviceTargeting: z.enum(['all', 'desktop', 'mobile', 'tablet']).optional(),
  }).optional(),
  targetLists: z.array(z.string()).optional(),
});

/**
 * GET /api/forms - Get all forms for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get('formType') as any;
    const status = searchParams.get('status') as any;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const forms = await FormService.getForms(session.user.tenantId, {
      formType,
      status,
      limit,
      offset,
    });

    return NextResponse.json({ forms });
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forms' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms - Create a new form
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createFormSchema.parse(body);

    const form = await FormService.createForm(session.user.tenantId, validatedData);

    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create form' },
      { status: 500 }
    );
  }
}