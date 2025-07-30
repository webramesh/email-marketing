import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FormService } from '@/services/form.service';
import { z } from 'zod';

const updateFormSchema = z.object({
  name: z.string().min(1, 'Form name is required').optional(),
  description: z.string().optional(),
  formType: z.enum(['SUBSCRIPTION', 'POPUP', 'EMBEDDED', 'LANDING_PAGE']).optional(),
  fields: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['email', 'text', 'textarea', 'select', 'checkbox', 'radio', 'hidden']),
        label: z.string(),
        placeholder: z.string().optional(),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
        validation: z
          .object({
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
            pattern: z.string().optional(),
          })
          .optional(),
        defaultValue: z.string().optional(),
        customField: z.string().optional(),
      })
    )
    .optional(),
  styling: z
    .object({
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
    })
    .optional(),
  settings: z
    .object({
      redirectUrl: z.string().optional(),
      showThankYouMessage: z.boolean(),
      thankYouMessage: z.string(),
      enableDoubleOptIn: z.boolean(),
      sendWelcomeEmail: z.boolean(),
      welcomeEmailTemplate: z.string().optional(),
      allowDuplicates: z.boolean(),
      requireEmailConfirmation: z.boolean(),
    })
    .optional(),
  displayRules: z
    .object({
      trigger: z.enum(['immediate', 'exit_intent', 'scroll', 'time_delay']),
      delay: z.number().optional(),
      scrollPercentage: z.number().optional(),
      showOnPages: z.array(z.string()).optional(),
      hideOnPages: z.array(z.string()).optional(),
      frequency: z.enum(['always', 'once_per_session', 'once_per_visitor']),
      deviceTargeting: z.enum(['all', 'desktop', 'mobile', 'tablet']).optional(),
    })
    .optional(),
  targetLists: z.array(z.string()).optional(),
});

/**
 * GET /api/forms/[id] - Get a specific form
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await FormService.getForm(session.user.tenantId, params.id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

/**
 * PUT /api/forms/[id] - Update a form
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateFormSchema.parse(body);

    const form = await FormService.updateForm(session.user.tenantId, params.id, validatedData);

    return NextResponse.json({ form });
  } catch (error) {
    console.error('Error updating form:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id] - Delete a form
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await FormService.deleteForm(session.user.tenantId, params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}
