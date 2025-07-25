import { prisma } from '@/lib/prisma';
import { FormType, FormStatus } from '@/generated/prisma';
import { z } from 'zod';

// Form field types
export interface FormField {
  id: string;
  type: 'email' | 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'hidden';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select, radio
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  defaultValue?: string;
  customField?: string; // Maps to subscriber custom field
}

// Form styling configuration
export interface FormStyling {
  theme: 'light' | 'dark' | 'custom';
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
  buttonStyle: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    padding: string;
  };
  customCss?: string;
  [key: string]: any; // Index signature for Prisma JSON compatibility
}

// Form settings
export interface FormSettings {
  redirectUrl?: string;
  showThankYouMessage: boolean;
  thankYouMessage: string;
  enableDoubleOptIn: boolean;
  sendWelcomeEmail: boolean;
  welcomeEmailTemplate?: string;
  allowDuplicates: boolean;
  requireEmailConfirmation: boolean;
  [key: string]: any; // Index signature for Prisma JSON compatibility
}

// Display rules for popup forms
export interface DisplayRules {
  trigger: 'immediate' | 'exit_intent' | 'scroll' | 'time_delay';
  delay?: number; // seconds for time_delay
  scrollPercentage?: number; // for scroll trigger
  showOnPages?: string[]; // URL patterns
  hideOnPages?: string[]; // URL patterns
  frequency: 'always' | 'once_per_session' | 'once_per_visitor';
  deviceTargeting?: 'all' | 'desktop' | 'mobile' | 'tablet';
}

// Validation schemas
const formFieldSchema = z.object({
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
});

const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required'),
  description: z.string().optional(),
  formType: z.enum(['EMBEDDED', 'POPUP', 'LANDING_PAGE', 'SUBSCRIPTION']),
  fields: z.array(formFieldSchema),
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

const updateFormSchema = createFormSchema.partial();

export class FormService {
  /**
   * Create a new form
   */
  static async createForm(tenantId: string, data: z.infer<typeof createFormSchema>) {
    const validatedData = createFormSchema.parse(data);

    // Generate embed code
    const embedCode = this.generateEmbedCode(validatedData.formType);

    const form = await prisma.form.create({
      data: {
        tenantId,
        name: validatedData.name,
        description: validatedData.description,
        formType: validatedData.formType,
        fields: validatedData.fields,
        styling: validatedData.styling || this.getDefaultStyling(),
        settings: validatedData.settings || this.getDefaultSettings(),
        displayRules: validatedData.displayRules,
        targetLists: validatedData.targetLists,
        embedCode,
        status: FormStatus.DRAFT,
      },
    });

    return form;
  }

  /**
   * Update an existing form
   */
  static async updateForm(
    tenantId: string,
    formId: string,
    data: z.infer<typeof updateFormSchema>
  ) {
    const validatedData = updateFormSchema.parse(data);

    // Regenerate embed code if form type changed
    let embedCode;
    if (validatedData.formType) {
      embedCode = this.generateEmbedCode(validatedData.formType);
    }

    const form = await prisma.form.update({
      where: {
        id: formId,
        tenantId,
      },
      data: {
        ...validatedData,
        ...(embedCode && { embedCode }),
        updatedAt: new Date(),
      },
    });

    return form;
  }

  /**
   * Get form by ID
   */
  static async getForm(tenantId: string, formId: string) {
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        tenantId,
      },
      include: {
        submissions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        analytics: {
          take: 30,
          orderBy: { date: 'desc' },
        },
      },
    });

    return form;
  }

  /**
   * Get all forms for a tenant
   */
  static async getForms(
    tenantId: string,
    options: {
      formType?: FormType;
      status?: FormStatus;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { formType, status, limit = 50, offset = 0 } = options;

    const forms = await prisma.form.findMany({
      where: {
        tenantId,
        ...(formType && { formType }),
        ...(status && { status }),
      },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return forms;
  }

  /**
   * Delete a form
   */
  static async deleteForm(tenantId: string, formId: string) {
    await prisma.form.delete({
      where: {
        id: formId,
        tenantId,
      },
    });
  }

  /**
   * Publish a form
   */
  static async publishForm(tenantId: string, formId: string) {
    const form = await prisma.form.update({
      where: {
        id: formId,
        tenantId,
      },
      data: {
        status: FormStatus.PUBLISHED,
        updatedAt: new Date(),
      },
    });

    return form;
  }

  /**
   * Pause a form
   */
  static async pauseForm(tenantId: string, formId: string) {
    const form = await prisma.form.update({
      where: {
        id: formId,
        tenantId,
      },
      data: {
        status: FormStatus.PAUSED,
        updatedAt: new Date(),
      },
    });

    return form;
  }

  /**
   * Submit a form
   */
  static async submitForm(
    formId: string,
    data: {
      email: string;
      firstName?: string;
      lastName?: string;
      customFields?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    }
  ) {
    // Get form configuration
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: { tenant: true },
    });

    if (!form || form.status !== FormStatus.PUBLISHED) {
      throw new Error('Form not found or not published');
    }

    // Validate required fields
    const fields = form.fields as unknown as FormField[];
    const requiredFields = fields.filter(field => field.required);

    for (const field of requiredFields) {
      if (field.type === 'email' && !data.email) {
        throw new Error('Email is required');
      }
      if (field.type === 'text' && field.customField && !data.customFields?.[field.customField]) {
        throw new Error(`${field.label} is required`);
      }
    }

    // Create form submission
    const submission = await prisma.formSubmission.create({
      data: {
        formId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        customFields: data.customFields,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        referrer: data.referrer,
      },
    });

    // Create or update subscriber
    let subscriber;
    const settings = form.settings as FormSettings;

    if (!settings?.allowDuplicates) {
      // Check if subscriber already exists
      subscriber = await prisma.subscriber.findFirst({
        where: {
          email: data.email,
          tenantId: form.tenantId,
        },
      });
    }

    if (!subscriber) {
      subscriber = await prisma.subscriber.create({
        data: {
          tenantId: form.tenantId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          customFields: data.customFields,
        },
      });

      // Update submission with subscriber ID
      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: { subscriberId: subscriber.id },
      });
    }

    // Add subscriber to target lists
    const targetLists = form.targetLists as string[];
    if (targetLists && targetLists.length > 0) {
      for (const listId of targetLists) {
        await prisma.listSubscriber.upsert({
          where: {
            listId_subscriberId: {
              listId,
              subscriberId: subscriber.id,
            },
          },
          create: {
            listId,
            subscriberId: subscriber.id,
          },
          update: {},
        });
      }
    }

    // Update form statistics
    await this.updateFormStats(formId);

    return { submission, subscriber };
  }

  /**
   * Track form view
   */
  static async trackFormView(formId: string) {
    await prisma.form.update({
      where: { id: formId },
      data: {
        totalViews: { increment: 1 },
      },
    });

    // Update daily analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.formAnalytics.upsert({
      where: {
        formId_date: {
          formId,
          date: today,
        },
      },
      create: {
        formId,
        date: today,
        views: 1,
        submissions: 0,
        conversionRate: 0,
      },
      update: {
        views: { increment: 1 },
      },
    });
  }

  /**
   * Get form analytics
   */
  static async getFormAnalytics(tenantId: string, formId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await prisma.formAnalytics.findMany({
      where: {
        formId,
        date: { gte: startDate },
        form: { tenantId },
      },
      orderBy: { date: 'asc' },
    });

    return analytics;
  }

  /**
   * Get form submissions
   */
  static async getFormSubmissions(
    tenantId: string,
    formId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    const submissions = await prisma.formSubmission.findMany({
      where: {
        formId,
        form: { tenantId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return submissions;
  }

  /**
   * Duplicate a form
   */
  static async duplicateForm(tenantId: string, formId: string, newName: string) {
    const originalForm = await prisma.form.findFirst({
      where: {
        id: formId,
        tenantId,
      },
    });

    if (!originalForm) {
      throw new Error('Form not found');
    }

    const duplicatedForm = await prisma.form.create({
      data: {
        tenantId,
        name: newName,
        description: originalForm.description,
        formType: originalForm.formType,
        fields: originalForm.fields || [],
        styling: originalForm.styling || this.getDefaultStyling(),
        settings: originalForm.settings || this.getDefaultSettings(),
        displayRules: originalForm.displayRules || undefined,
        targetLists: originalForm.targetLists || undefined,
        embedCode: this.generateEmbedCode(originalForm.formType),
        status: FormStatus.DRAFT,
      },
    });

    return duplicatedForm;
  }

  /**
   * Generate embed code for different form types
   */
  private static generateEmbedCode(formType: FormType): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';

    switch (formType) {
      case FormType.EMBEDDED:
        return `<script src="${baseUrl}/embed/form.js"></script>
<div id="jetmail-form-{{FORM_ID}}" data-form-id="{{FORM_ID}}"></div>`;

      case FormType.POPUP:
        return `<script>
(function() {
  var script = document.createElement('script');
  script.src = '${baseUrl}/embed/popup.js';
  script.setAttribute('data-form-id', '{{FORM_ID}}');
  document.head.appendChild(script);
})();
</script>`;

      case FormType.LANDING_PAGE:
        return `${baseUrl}/forms/{{FORM_ID}}`;

      default:
        return `<iframe src="${baseUrl}/forms/{{FORM_ID}}" width="100%" height="400" frameborder="0"></iframe>`;
    }
  }

  /**
   * Get default form styling
   */
  private static getDefaultStyling(): FormStyling {
    return {
      theme: 'light',
      primaryColor: '#1E40AF',
      backgroundColor: '#FFFFFF',
      textColor: '#374151',
      borderColor: '#D1D5DB',
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      buttonStyle: {
        backgroundColor: '#1E40AF',
        textColor: '#FFFFFF',
        borderRadius: 6,
        padding: '12px 24px',
      },
    };
  }

  /**
   * Get default form settings
   */
  private static getDefaultSettings(): FormSettings {
    return {
      showThankYouMessage: true,
      thankYouMessage: 'Thank you for subscribing!',
      enableDoubleOptIn: false,
      sendWelcomeEmail: false,
      allowDuplicates: false,
      requireEmailConfirmation: false,
    };
  }

  /**
   * Update form statistics
   */
  private static async updateFormStats(formId: string) {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (form) {
      const conversionRate =
        form.totalViews > 0 ? (form._count.submissions / form.totalViews) * 100 : 0;

      await prisma.form.update({
        where: { id: formId },
        data: {
          totalSubmissions: form._count.submissions,
          conversionRate,
        },
      });

      // Update daily analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const analytics = await prisma.formAnalytics.findUnique({
        where: {
          formId_date: {
            formId,
            date: today,
          },
        },
      });

      if (analytics) {
        const dailyConversionRate =
          analytics.views > 0 ? (analytics.submissions / analytics.views) * 100 : 0;

        await prisma.formAnalytics.update({
          where: {
            formId_date: {
              formId,
              date: today,
            },
          },
          data: {
            submissions: { increment: 1 },
            conversionRate: dailyConversionRate,
          },
        });
      }
    }
  }
}
