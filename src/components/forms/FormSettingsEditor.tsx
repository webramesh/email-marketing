'use client';

import React from 'react';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormSettings } from '@/services/form.service';

interface FormSettingsEditorProps {
  settings: FormSettings;
  onUpdate: (settings: FormSettings) => void;
}

export function FormSettingsEditor({ settings, onUpdate }: FormSettingsEditorProps) {
  const handleChange = (key: keyof FormSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Submission Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Redirect URL (Optional)"
            value={settings.redirectUrl || ''}
            onChange={(e) => handleChange('redirectUrl', e.target.value)}
            placeholder="https://example.com/thank-you"
            helperText="Redirect users to this URL after successful submission"
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showThankYouMessage"
              checked={settings.showThankYouMessage}
              onChange={(e) => handleChange('showThankYouMessage', e.target.checked)}
              className="rounded border-secondary-300 text-primary focus:ring-primary"
            />
            <label htmlFor="showThankYouMessage" className="text-sm font-medium text-secondary-700">
              Show thank you message
            </label>
          </div>

          {settings.showThankYouMessage && (
            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Thank You Message
              </label>
              <textarea
                value={settings.thankYouMessage}
                onChange={(e) => handleChange('thankYouMessage', e.target.value)}
                placeholder="Thank you for subscribing!"
                className="w-full h-20 px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="allowDuplicates"
              checked={settings.allowDuplicates}
              onChange={(e) => handleChange('allowDuplicates', e.target.checked)}
              className="rounded border-secondary-300 text-primary focus:ring-primary"
            />
            <label htmlFor="allowDuplicates" className="text-sm font-medium text-secondary-700">
              Allow duplicate submissions
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Email Confirmation */}
      <Card>
        <CardHeader>
          <CardTitle>Email Confirmation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enableDoubleOptIn"
              checked={settings.enableDoubleOptIn}
              onChange={(e) => handleChange('enableDoubleOptIn', e.target.checked)}
              className="rounded border-secondary-300 text-primary focus:ring-primary"
            />
            <label htmlFor="enableDoubleOptIn" className="text-sm font-medium text-secondary-700">
              Enable double opt-in
            </label>
          </div>
          <p className="text-xs text-secondary-500">
            Subscribers will receive a confirmation email before being added to your list
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requireEmailConfirmation"
              checked={settings.requireEmailConfirmation}
              onChange={(e) => handleChange('requireEmailConfirmation', e.target.checked)}
              className="rounded border-secondary-300 text-primary focus:ring-primary"
            />
            <label htmlFor="requireEmailConfirmation" className="text-sm font-medium text-secondary-700">
              Require email confirmation
            </label>
          </div>
          <p className="text-xs text-secondary-500">
            Users must confirm their email address before submission is processed
          </p>
        </CardContent>
      </Card>

      {/* Welcome Email */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sendWelcomeEmail"
              checked={settings.sendWelcomeEmail}
              onChange={(e) => handleChange('sendWelcomeEmail', e.target.checked)}
              className="rounded border-secondary-300 text-primary focus:ring-primary"
            />
            <label htmlFor="sendWelcomeEmail" className="text-sm font-medium text-secondary-700">
              Send welcome email
            </label>
          </div>

          {settings.sendWelcomeEmail && (
            <Input
              label="Welcome Email Template"
              value={settings.welcomeEmailTemplate || ''}
              onChange={(e) => handleChange('welcomeEmailTemplate', e.target.value)}
              placeholder="Select template..."
              helperText="Choose an email template to send to new subscribers"
            />
          )}
        </CardContent>
      </Card>

      {/* GDPR Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>GDPR & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Privacy Compliance</h4>
            <p className="text-sm text-blue-700">
              All forms automatically include privacy compliance features:
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Consent tracking for GDPR compliance</li>
              <li>• IP address and timestamp logging</li>
              <li>• Right to deletion support</li>
              <li>• Data portability features</li>
            </ul>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg">
            <h4 className="text-sm font-medium text-amber-900 mb-2">Recommended Settings</h4>
            <p className="text-sm text-amber-700">
              For GDPR compliance, we recommend:
            </p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>• Enable double opt-in for explicit consent</li>
              <li>• Add a consent checkbox to your form</li>
              <li>• Include links to your privacy policy</li>
              <li>• Clearly state how data will be used</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-secondary-50 rounded-lg">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Form Analytics</h4>
            <p className="text-sm text-secondary-600">
              Form analytics are automatically enabled and include:
            </p>
            <ul className="text-sm text-secondary-600 mt-2 space-y-1">
              <li>• View and submission tracking</li>
              <li>• Conversion rate monitoring</li>
              <li>• Geographic analytics</li>
              <li>• Device and browser insights</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-900 mb-2">Security Features</h4>
            <p className="text-sm text-green-700">
              Built-in security features include:
            </p>
            <ul className="text-sm text-green-700 mt-2 space-y-1">
              <li>• CSRF protection</li>
              <li>• Rate limiting</li>
              <li>• Spam detection</li>
              <li>• Input sanitization</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}