'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

const passwordResetRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  method: z.enum(['EMAIL', 'SMS', 'SECURITY_QUESTIONS', 'BACKUP_EMAIL']),
  tenantId: z.string().optional(),
});

const passwordResetVerifySchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(1, 'New password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordResetRequestForm = z.infer<typeof passwordResetRequestSchema>;
type PasswordResetVerifyForm = z.infer<typeof passwordResetVerifySchema>;

interface PasswordResetFormProps {
  mode?: 'request' | 'verify';
  token?: string;
  onSuccess?: () => void;
}

export function PasswordResetForm({ 
  mode = 'request', 
  token: initialToken,
  onSuccess 
}: PasswordResetFormProps) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resetToken, setResetToken] = useState(initialToken || '');
  const [passwordValid, setPasswordValid] = useState(false);

  // Request form
  const requestForm = useForm<PasswordResetRequestForm>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: {
      method: 'EMAIL',
    },
  });

  // Verify form
  const verifyForm = useForm<PasswordResetVerifyForm>({
    resolver: zodResolver(passwordResetVerifySchema),
    defaultValues: {
      token: initialToken || '',
    },
  });

  const handlePasswordResetRequest = async (data: PasswordResetRequestForm) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        
        // In development, auto-fill the token
        if (result.token) {
          setResetToken(result.token);
          verifyForm.setValue('token', result.token);
          setCurrentMode('verify');
        }
      } else {
        setError(result.error || 'Failed to send reset instructions');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (data: PasswordResetVerifyForm) => {
    if (!passwordValid) {
      setError('Please ensure your password meets all security requirements');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setWarnings([]);

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: data.token,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        if (result.warnings) {
          setWarnings(result.warnings);
        }
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to reset password');
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

  if (currentMode === 'request') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-gray-600">
            Enter your email address and we'll send you instructions to reset your password.
          </p>
        </div>

        <form onSubmit={requestForm.handleSubmit(handlePasswordResetRequest)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              {...requestForm.register('email')}
              error={requestForm.formState.errors.email?.message}
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <label htmlFor="method" className="block text-sm font-medium text-gray-700">
              Reset Method
            </label>
            <select
              id="method"
              {...requestForm.register('method')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS (if configured)</option>
              <option value="BACKUP_EMAIL">Backup Email</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </Button>
        </form>

        {resetToken && (
          <div className="text-center">
            <button
              onClick={() => setCurrentMode('verify')}
              className="text-blue-600 hover:text-blue-500 text-sm font-medium"
            >
              I have a reset token
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
        <p className="mt-2 text-gray-600">
          Enter your reset token and choose a new secure password.
        </p>
      </div>

      <form onSubmit={verifyForm.handleSubmit(handlePasswordReset)} className="space-y-4">
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700">
            Reset Token
          </label>
          <Input
            id="token"
            type="text"
            {...verifyForm.register('token')}
            error={verifyForm.formState.errors.token?.message}
            placeholder="Enter your reset token"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <Input
            id="newPassword"
            type="password"
            {...verifyForm.register('newPassword')}
            error={verifyForm.formState.errors.newPassword?.message}
            placeholder="Enter your new password"
          />
          
          <PasswordStrengthIndicator
            password={verifyForm.watch('newPassword') || ''}
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
            {...verifyForm.register('confirmPassword')}
            error={verifyForm.formState.errors.confirmPassword?.message}
            placeholder="Confirm your new password"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{message}</p>
            {warnings.length > 0 && (
              <ul className="mt-2 text-sm text-yellow-600">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !passwordValid}
          className="w-full"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>

      <div className="text-center">
        <button
          onClick={() => setCurrentMode('request')}
          className="text-blue-600 hover:text-blue-500 text-sm font-medium"
        >
          Back to reset request
        </button>
      </div>
    </div>
  );
}