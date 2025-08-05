'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const passwordPolicySchema = z.object({
  minLength: z.number().min(8).max(128),
  maxLength: z.number().min(8).max(256),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSpecialChars: z.boolean(),
  preventCommonPasswords: z.boolean(),
  preventPersonalInfo: z.boolean(),
  historyCount: z.number().min(0).max(50),
  expirationDays: z.number().min(0).max(365).optional(),
  maxFailedAttempts: z.number().min(1).max(20),
  lockoutDurationMinutes: z.number().min(1).max(1440),
});

type PasswordPolicyForm = z.infer<typeof passwordPolicySchema>;

interface PasswordPolicyConfigurationProps {
  userRole: string;
  tenantId?: string;
}

export function PasswordPolicyConfiguration({ userRole, tenantId }: PasswordPolicyConfigurationProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const form = useForm<PasswordPolicyForm>({
    resolver: zodResolver(passwordPolicySchema),
    defaultValues: {
      minLength: 12,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventPersonalInfo: true,
      historyCount: 12,
      expirationDays: 90,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
    },
  });

  useEffect(() => {
    loadCurrentPolicy();
  }, []);

  const loadCurrentPolicy = async () => {
    setLoading(true);
    try {
      // This would be a new API endpoint to get password policy
      const response = await fetch(`/api/auth/password-policy${tenantId ? `?tenantId=${tenantId}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        if (data.policy) {
          form.reset(data.policy);
        }
      }
    } catch (error) {
      console.error('Failed to load password policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PasswordPolicyForm) => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/password-policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          tenantId,
        }),
      });

      if (response.ok) {
        setMessage('Password policy updated successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update password policy');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    form.reset({
      minLength: 12,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventPersonalInfo: true,
      historyCount: 12,
      expirationDays: 90,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
    });
  };

  if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">
          <p>You don't have permission to configure password policies.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Password Policy Configuration</h2>
          <Button
            type="button"
            variant="outline"
            onClick={resetToDefaults}
            className="text-sm"
          >
            Reset to Defaults
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading current policy...</p>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Password Length Requirements */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Length Requirements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Length
                  </label>
                  <Input
                    type="number"
                    min="8"
                    max="128"
                    {...form.register('minLength', { valueAsNumber: true })}
                    error={form.formState.errors.minLength?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Length
                  </label>
                  <Input
                    type="number"
                    min="8"
                    max="256"
                    {...form.register('maxLength', { valueAsNumber: true })}
                    error={form.formState.errors.maxLength?.message}
                  />
                </div>
              </div>
            </div>

            {/* Character Requirements */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Character Requirements</h3>
              <div className="space-y-3">
                {[
                  { key: 'requireUppercase', label: 'Require uppercase letters (A-Z)' },
                  { key: 'requireLowercase', label: 'Require lowercase letters (a-z)' },
                  { key: 'requireNumbers', label: 'Require numbers (0-9)' },
                  { key: 'requireSpecialChars', label: 'Require special characters (!@#$...)' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={key}
                      {...form.register(key as keyof PasswordPolicyForm)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={key} className="ml-2 text-sm text-gray-700">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Features */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Security Features</h3>
              <div className="space-y-3">
                {[
                  { key: 'preventCommonPasswords', label: 'Prevent common passwords' },
                  { key: 'preventPersonalInfo', label: 'Prevent passwords containing personal information' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={key}
                      {...form.register(key as keyof PasswordPolicyForm)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={key} className="ml-2 text-sm text-gray-700">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Password History and Expiration */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">History and Expiration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password History Count
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    {...form.register('historyCount', { valueAsNumber: true })}
                    error={form.formState.errors.historyCount?.message}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of previous passwords to remember (0 to disable)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password Expiration (days)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    {...form.register('expirationDays', { valueAsNumber: true })}
                    error={form.formState.errors.expirationDays?.message}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Days until password expires (0 to disable)
                  </p>
                </div>
              </div>
            </div>

            {/* Account Lockout */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Account Lockout</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Failed Attempts
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    {...form.register('maxFailedAttempts', { valueAsNumber: true })}
                    error={form.formState.errors.maxFailedAttempts?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lockout Duration (minutes)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="1440"
                    {...form.register('lockoutDurationMinutes', { valueAsNumber: true })}
                    error={form.formState.errors.lockoutDurationMinutes?.message}
                  />
                </div>
              </div>
            </div>

            {/* Messages */}
            {message && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">{message}</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={loadCurrentPolicy}
                disabled={saving}
              >
                Reload
              </Button>
              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Policy'}
              </Button>
            </div>
          </form>
        )}

        {/* Policy Preview */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Policy Preview</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Passwords must be {form.watch('minLength')}-{form.watch('maxLength')} characters long</p>
            {form.watch('requireUppercase') && <p>• Must contain uppercase letters</p>}
            {form.watch('requireLowercase') && <p>• Must contain lowercase letters</p>}
            {form.watch('requireNumbers') && <p>• Must contain numbers</p>}
            {form.watch('requireSpecialChars') && <p>• Must contain special characters</p>}
            {form.watch('historyCount') > 0 && <p>• Cannot reuse last {form.watch('historyCount')} passwords</p>}
            {form.watch('expirationDays') && form.watch('expirationDays')! > 0 && (
              <p>• Passwords expire after {form.watch('expirationDays')} days</p>
            )}
            <p>• Account locks after {form.watch('maxFailedAttempts')} failed attempts for {form.watch('lockoutDurationMinutes')} minutes</p>
          </div>
        </div>
      </div>
    </Card>
  );
}