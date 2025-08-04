'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { signOut } from 'next-auth/react';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

export default function PasswordChangeRequiredPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [passwordValid, setPasswordValid] = useState(false);

  const form = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
  });

  const handlePasswordChange = async (data: PasswordChangeForm) => {
    if (!passwordValid) {
      setError('Please ensure your password meets all security requirements');
      return;
    }

    setLoading(true);
    setError('');
    setWarnings([]);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.warnings) {
          setWarnings(result.warnings);
        }
        
        // Redirect to the return URL after successful password change
        setTimeout(() => {
          router.push(returnUrl);
        }, 2000);
      } else {
        setError(result.error || 'Failed to change password');
        if (result.warnings) {
          setWarnings(result.warnings);
        }
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Password Change Required
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your password has expired or needs to be changed for security reasons.
            Please set a new password to continue.
          </p>
        </div>

        <div className="mt-8">
          <Card className="py-8 px-4 sm:px-10">
            <form onSubmit={form.handleSubmit(handlePasswordChange)} className="space-y-6">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...form.register('currentPassword')}
                  error={form.formState.errors.currentPassword?.message}
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  {...form.register('newPassword')}
                  error={form.formState.errors.newPassword?.message}
                  placeholder="Enter your new password"
                />
                
                <PasswordStrengthIndicator
                  password={form.watch('newPassword') || ''}
                  onValidationChange={(isValid) => setPasswordValid(isValid)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...form.register('confirmPassword')}
                  error={form.formState.errors.confirmPassword?.message}
                  placeholder="Confirm your new password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-600 font-medium">Warnings:</p>
                  <ul className="mt-1 text-sm text-yellow-600">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={loading || !passwordValid}
                  className="w-full"
                >
                  {loading ? 'Changing Password...' : 'Change Password'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full"
                >
                  Sign Out Instead
                </Button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Security Requirements</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• At least 12 characters long</li>
                <li>• Include uppercase and lowercase letters</li>
                <li>• Include numbers and special characters</li>
                <li>• Avoid common passwords and personal information</li>
                <li>• Cannot reuse recent passwords</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}