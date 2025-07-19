'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CampaignWithDetails, CampaignType, CampaignStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';

// Form validation schema
const campaignFormSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(255),
  preheader: z.string().max(255).optional(),
  content: z.string().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  campaignType: z.nativeEnum(CampaignType).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  replyToEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  campaign?: CampaignWithDetails | null;
  onSave?: (campaign: CampaignWithDetails) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function CampaignForm({ campaign, onSave, onCancel, loading = false }: CampaignFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = !!campaign;

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign?.name || '',
      subject: campaign?.subject || '',
      preheader: campaign?.preheader || '',
      content: campaign?.content || '',
      status: campaign?.status || CampaignStatus.DRAFT,
      campaignType: campaign?.campaignType || CampaignType.REGULAR,
      fromName: campaign?.fromName || '',
      fromEmail: campaign?.fromEmail || '',
      replyToEmail: campaign?.replyToEmail || '',
      trackOpens: campaign?.trackOpens ?? true,
      trackClicks: campaign?.trackClicks ?? true,
      notes: campaign?.notes || '',
      scheduledAt: campaign?.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
        : '',
    },
  });

  const onSubmit = async (data: CampaignFormData) => {
    try {
      setSaving(true);
      setError(null);

      const requestData = {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      };

      let response: Response;

      if (isEditing) {
        response = await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
      } else {
        response = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
      }

      if (!response.ok) {
        // Handle HTTP errors
        const errorText = await response.text();
        let errorMessage = 'Failed to save campaign';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use the text as error message
          errorMessage = errorText || errorMessage;
        }

        setError(errorMessage);
        return;
      }

      const responseText = await response.text();
      if (!responseText) {
        setError('Empty response from server');
        return;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        setError('Invalid response from server');
        return;
      }

      if (result.success) {
        onSave?.(result.data);
      } else {
        setError(result.error || 'Failed to save campaign');
      }
    } catch (err) {
      setError('Failed to save campaign');
      console.error('Error saving campaign:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Campaign' : 'Create Campaign'}
          </h1>
          <p className="text-gray-600">
            {isEditing
              ? 'Update your campaign details'
              : 'Create a new email campaign to reach your audience'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
          <Button variant="secondary" size="sm" onClick={() => setError(null)} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Campaign Name"
              {...form.register('name')}
              error={form.formState.errors.name?.message}
              placeholder="Enter campaign name"
              required
            />
            <Dropdown
              label="Campaign Status"
              value={form.watch('status')}
              onChange={value => form.setValue('status', value as CampaignStatus)}
              items={[
                { value: CampaignStatus.DRAFT, label: 'Draft' },
                { value: CampaignStatus.SCHEDULED, label: 'Scheduled' },
                { value: CampaignStatus.PAUSED, label: 'Paused' },
              ]}
            />
            <Dropdown
              label="Campaign Type"
              value={form.watch('campaignType')}
              onChange={value => form.setValue('campaignType', value as CampaignType)}
              items={[
                { value: CampaignType.REGULAR, label: 'Regular Campaign' },
                { value: CampaignType.AB_TEST, label: 'A/B Test Campaign' },
                { value: CampaignType.AUTOMATION, label: 'Automation Campaign' },
                { value: CampaignType.TRANSACTIONAL, label: 'Transactional Campaign' },
              ]}
            />
          </div>
        </Card>

        {/* Email Content */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Content</h2>
          <div className="space-y-4">
            <Input
              label="Subject Line"
              {...form.register('subject')}
              error={form.formState.errors.subject?.message}
              placeholder="Enter email subject"
              required
            />
            <Input
              label="Preheader Text"
              {...form.register('preheader')}
              error={form.formState.errors.preheader?.message}
              placeholder="Preview text that appears after the subject line"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Content</label>
              <textarea
                {...form.register('content')}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email content here..."
              />
              <p className="text-sm text-gray-500 mt-1">
                You can use HTML or plain text. The drag-and-drop email builder will be available in
                the next step.
              </p>
            </div>
          </div>
        </Card>

        {/* Sender Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sender Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="From Name"
              {...form.register('fromName')}
              error={form.formState.errors.fromName?.message}
              placeholder="Your Name or Company"
            />
            <Input
              label="From Email"
              type="email"
              {...form.register('fromEmail')}
              error={form.formState.errors.fromEmail?.message}
              placeholder="sender@yourdomain.com"
            />
            <Input
              label="Reply-To Email"
              type="email"
              {...form.register('replyToEmail')}
              error={form.formState.errors.replyToEmail?.message}
              placeholder="reply@yourdomain.com"
            />
          </div>
        </Card>

        {/* Tracking Settings */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tracking Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="trackOpens"
                {...form.register('trackOpens')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="trackOpens" className="ml-2 block text-sm text-gray-900">
                Track email opens
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="trackClicks"
                {...form.register('trackClicks')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="trackClicks" className="ml-2 block text-sm text-gray-900">
                Track link clicks
              </label>
            </div>
          </div>
        </Card>

        {/* Scheduling */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scheduling</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Schedule Send Time (Optional)"
              type="datetime-local"
              {...form.register('scheduledAt')}
              error={form.formState.errors.scheduledAt?.message}
            />
            <div className="text-sm text-gray-500 pt-6">
              Leave empty to save as draft. You can schedule or send the campaign later.
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            {...form.register('notes')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes or reminders about this campaign..."
          />
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving || loading}>
            {saving ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
