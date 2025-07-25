import { FormService, FormField } from '../form.service';
import { prisma } from '@/lib/prisma';
import {
  FormType,
  FormStatus,
  Form,
  FormSubmission,
  Subscriber,
  FormAnalytics,
} from '@/generated/prisma';
import { JsonValue } from '@prisma/client/runtime/library';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    form: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    formSubmission: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    formAnalytics: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscriber: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    listSubscriber: {
      upsert: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

describe('FormService', () => {
  const tenantId = 'tenant-123';
  const formId = 'form-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock form objects
  const createMockForm = (overrides: Partial<Form> = {}): Form => ({
    id: formId,
    tenantId,
    name: 'Test Form',
    description: 'Test Description',
    formType: FormType.SUBSCRIPTION,
    status: FormStatus.DRAFT,
    fields: [] as JsonValue,
    styling: null,
    settings: null,
    displayRules: null,
    targetLists: null,
    totalViews: 0,
    totalSubmissions: 0,
    conversionRate: 0,
    embedCode: null,
    embedDomain: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockSubmission = (overrides: Partial<FormSubmission> = {}): FormSubmission => ({
    id: 'submission-123',
    formId,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    customFields: null,
    ipAddress: null,
    userAgent: null,
    referrer: null,
    location: null,
    subscriberId: null,
    createdAt: new Date(),
    ...overrides,
  });

  const createMockSubscriber = (overrides: Partial<Subscriber> = {}): Subscriber => ({
    id: 'subscriber-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'ACTIVE',
    customFields: null,
    tenantId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockAnalytics = (overrides: Partial<FormAnalytics> = {}): FormAnalytics => ({
    id: 'analytics-123',
    formId,
    date: new Date(),
    views: 10,
    submissions: 1,
    conversionRate: 10.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('createForm', () => {
    it('should create a form with valid data', async () => {
      const formData = {
        name: 'Test Form',
        description: 'Test Description',
        formType: FormType.SUBSCRIPTION,
        fields: [
          {
            id: 'email',
            type: 'email' as const,
            label: 'Email Address',
            placeholder: 'Enter your email',
            required: true,
          },
        ] as FormField[],
      };

      const mockForm = createMockForm({
        name: formData.name,
        description: formData.description,
        formType: formData.formType,
        fields: formData.fields as unknown as JsonValue,
        status: FormStatus.DRAFT,
      });

      mockPrisma.form.create.mockResolvedValue(mockForm);

      const result = await FormService.createForm(tenantId, formData);

      expect(mockPrisma.form.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: formData.name,
          description: formData.description,
          formType: formData.formType,
          fields: formData.fields,
          status: FormStatus.DRAFT,
        }),
      });

      expect(result).toEqual(mockForm);
    });

    it('should throw validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        formType: FormType.SUBSCRIPTION,
        fields: [],
      };

      await expect(FormService.createForm(tenantId, invalidData)).rejects.toThrow();
    });
  });

  describe('updateForm', () => {
    it('should update a form with valid data', async () => {
      const updateData = {
        name: 'Updated Form Name',
        description: 'Updated Description',
      };

      const mockUpdatedForm = createMockForm({
        name: updateData.name,
        description: updateData.description,
        updatedAt: new Date(),
      });

      mockPrisma.form.update.mockResolvedValue(mockUpdatedForm);

      const result = await FormService.updateForm(tenantId, formId, updateData);

      expect(mockPrisma.form.update).toHaveBeenCalledWith({
        where: { id: formId, tenantId },
        data: expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date),
        }),
      });

      expect(result).toEqual(mockUpdatedForm);
    });
  });

  describe('getForm', () => {
    it('should retrieve a form by ID', async () => {
      const mockForm = createMockForm({
        name: 'Test Form',
      });

      const mockFormWithRelations = {
        ...mockForm,
        submissions: [],
        analytics: [],
      };

      mockPrisma.form.findFirst.mockResolvedValue(mockFormWithRelations);

      const result = await FormService.getForm(tenantId, formId);

      expect(mockPrisma.form.findFirst).toHaveBeenCalledWith({
        where: { id: formId, tenantId },
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

      expect(result).toEqual(mockFormWithRelations);
    });
  });

  describe('getForms', () => {
    it('should retrieve all forms for a tenant', async () => {
      const mockForms = [
        createMockForm({ id: 'form-1', name: 'Form 1' }),
        createMockForm({ id: 'form-2', name: 'Form 2' }),
      ];

      const mockFormsWithCount = mockForms.map(form => ({
        ...form,
        _count: { submissions: 5 },
      }));

      mockPrisma.form.findMany.mockResolvedValue(mockFormsWithCount);

      const result = await FormService.getForms(tenantId);

      expect(mockPrisma.form.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result).toEqual(mockFormsWithCount);
    });

    it('should filter forms by type and status', async () => {
      const options = {
        formType: FormType.POPUP,
        status: FormStatus.PUBLISHED,
        limit: 10,
        offset: 5,
      };

      mockPrisma.form.findMany.mockResolvedValue([]);

      await FormService.getForms(tenantId, options);

      expect(mockPrisma.form.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          formType: FormType.POPUP,
          status: FormStatus.PUBLISHED,
        },
        include: {
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('publishForm', () => {
    it('should publish a form', async () => {
      const mockPublishedForm = createMockForm({
        status: FormStatus.PUBLISHED,
        updatedAt: new Date(),
      });

      mockPrisma.form.update.mockResolvedValue(mockPublishedForm);

      const result = await FormService.publishForm(tenantId, formId);

      expect(mockPrisma.form.update).toHaveBeenCalledWith({
        where: { id: formId, tenantId },
        data: {
          status: FormStatus.PUBLISHED,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockPublishedForm);
    });
  });

  describe('submitForm', () => {
    it('should submit a form and create subscriber', async () => {
      const submissionData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        customFields: { company: 'Test Corp' },
      };

      const mockForm = createMockForm({
        status: FormStatus.PUBLISHED,
        fields: [
          {
            id: 'email',
            type: 'email',
            label: 'Email',
            required: true,
          },
        ] as JsonValue,
        settings: {
          allowDuplicates: false,
        } as JsonValue,
        targetLists: ['list-123'] as JsonValue,
      });

      const mockFormWithTenant = {
        ...mockForm,
        tenant: { id: tenantId },
      };

      const mockSubmission = createMockSubmission({
        email: submissionData.email,
        firstName: submissionData.firstName,
        lastName: submissionData.lastName,
        customFields: submissionData.customFields,
      });

      const mockSubscriber = createMockSubscriber({
        email: submissionData.email,
        firstName: submissionData.firstName,
        lastName: submissionData.lastName,
        customFields: submissionData.customFields,
      });

      const mockAnalytics = createMockAnalytics({
        views: 10,
        submissions: 1,
      });

      // First call for form validation
      mockPrisma.form.findUnique.mockResolvedValueOnce(mockFormWithTenant);

      // Second call for updateFormStats
      mockPrisma.form.findUnique.mockResolvedValueOnce({
        ...mockFormWithTenant,
        totalViews: 100,
        _count: { submissions: 10 },
      });

      mockPrisma.formSubmission.create.mockResolvedValue(mockSubmission);
      mockPrisma.subscriber.findFirst.mockResolvedValue(null);
      mockPrisma.subscriber.create.mockResolvedValue(mockSubscriber);
      mockPrisma.formSubmission.update.mockResolvedValue(mockSubmission);
      mockPrisma.listSubscriber.upsert.mockResolvedValue({
        id: 'list-subscriber-123',
        listId: 'list-123',
        subscriberId: mockSubscriber.id,
        createdAt: new Date(),
      });
      (mockPrisma.form.update as jest.Mock).mockResolvedValue(mockForm);
      (mockPrisma.formAnalytics.findUnique as jest.Mock).mockResolvedValue(mockAnalytics);
      (mockPrisma.formAnalytics.update as jest.Mock).mockResolvedValue(mockAnalytics);

      const result = await FormService.submitForm(formId, submissionData);

      expect(mockPrisma.formSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          formId,
          email: submissionData.email,
          firstName: submissionData.firstName,
          lastName: submissionData.lastName,
          customFields: submissionData.customFields,
        }),
      });

      expect(mockPrisma.subscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          email: submissionData.email,
          firstName: submissionData.firstName,
          lastName: submissionData.lastName,
          customFields: submissionData.customFields,
        }),
      });

      expect(result.submission).toEqual(mockSubmission);
      expect(result.subscriber).toEqual(mockSubscriber);
    });

    it('should throw error for unpublished form', async () => {
      const mockDraftForm = createMockForm({
        status: FormStatus.DRAFT,
      });

      mockPrisma.form.findUnique.mockResolvedValue(mockDraftForm);

      await expect(
        FormService.submitForm(formId, {
          email: 'test@example.com',
        })
      ).rejects.toThrow('Form not found or not published');
    });

    it('should throw error for missing required fields', async () => {
      const mockForm = createMockForm({
        status: FormStatus.PUBLISHED,
        fields: [
          {
            id: 'email',
            type: 'email',
            label: 'Email',
            required: true,
          },
        ] as JsonValue,
      });

      mockPrisma.form.findUnique.mockResolvedValue(mockForm);

      await expect(FormService.submitForm(formId, { email: '' })).rejects.toThrow(
        'Email is required'
      );
    });
  });

  describe('trackFormView', () => {
    it('should track form view and update analytics', async () => {
      const mockUpdatedForm = createMockForm({
        totalViews: 1,
      });

      const mockAnalytics = createMockAnalytics({
        views: 1,
        submissions: 0,
        conversionRate: 0,
      });

      mockPrisma.form.update.mockResolvedValue(mockUpdatedForm);
      mockPrisma.formAnalytics.upsert.mockResolvedValue(mockAnalytics);

      await FormService.trackFormView(formId);

      expect(mockPrisma.form.update).toHaveBeenCalledWith({
        where: { id: formId },
        data: { totalViews: { increment: 1 } },
      });

      expect(mockPrisma.formAnalytics.upsert).toHaveBeenCalledWith({
        where: {
          formId_date: {
            formId,
            date: expect.any(Date),
          },
        },
        create: {
          formId,
          date: expect.any(Date),
          views: 1,
          submissions: 0,
          conversionRate: 0,
        },
        update: {
          views: { increment: 1 },
        },
      });
    });
  });

  describe('duplicateForm', () => {
    it('should duplicate a form with new name', async () => {
      const originalForm = createMockForm({
        name: 'Original Form',
        description: 'Original Description',
        formType: FormType.SUBSCRIPTION,
        fields: [] as JsonValue,
        styling: {} as JsonValue,
        settings: {} as JsonValue,
        displayRules: null,
        targetLists: null,
      });

      const duplicatedForm = createMockForm({
        id: 'new-form-123',
        name: 'Duplicated Form',
        status: FormStatus.DRAFT,
      });

      mockPrisma.form.findFirst.mockResolvedValue(originalForm);
      mockPrisma.form.create.mockResolvedValue(duplicatedForm);

      const result = await FormService.duplicateForm(tenantId, formId, 'Duplicated Form');

      expect(mockPrisma.form.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: 'Duplicated Form',
          description: originalForm.description,
          formType: originalForm.formType,
          fields: originalForm.fields,
          styling: originalForm.styling,
          settings: originalForm.settings,
          displayRules: undefined,
          targetLists: undefined,
          status: FormStatus.DRAFT,
          embedCode: expect.any(String),
        }),
      });

      expect(result).toEqual(duplicatedForm);
    });
  });
});
