import { NextRequest, NextResponse } from 'next/server';
import { FormService } from '@/services/form.service';

/**
 * GET /api/forms/[id]/public - Get public form data for embedding
 * This endpoint doesn't require authentication as it's used by the embed widget
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const formId = params.id;

    // Get form data without tenant authentication (public endpoint)
    const form = await FormService.getPublicForm(formId);

    if (!form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      );
    }

    if (form.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Form is not published' },
        { status: 404 }
      );
    }

    // Return only necessary data for the widget
    const publicFormData = {
      id: form.id,
      name: form.name,
      formType: form.formType,
      fields: form.fields,
      styling: form.styling,
      settings: {
        showThankYouMessage: form.settings?.showThankYouMessage,
        thankYouMessage: form.settings?.thankYouMessage,
        redirectUrl: form.settings?.redirectUrl,
        enableDoubleOptIn: form.settings?.enableDoubleOptIn,
      },
    };

    // Track form view
    await FormService.trackFormView(formId);

    return NextResponse.json(publicFormData);
  } catch (error) {
    console.error('Error fetching public form:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form' },
      { status: 500 }
    );
  }
}