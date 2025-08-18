'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const acceptInvitationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

export default function AcceptInvitationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<{
    email?: string;
    role?: string;
    companyName?: string;
  }>({});
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      name: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Extract invitation info from URL parameters if available
    const email = searchParams.get('email');
    const role = searchParams.get('role');
    const company = searchParams.get('company');
    
    if (email || role || company) {
      setInvitationInfo({
        email: email || undefined,
        role: role || undefined,
        companyName: company || undefined,
      });
    }
  }, [searchParams]);

  const onSubmit = async (data: AcceptInvitationFormData) => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('Invalid invitation link. Please check your email for the correct link.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      // Redirect to onboarding or dashboard
      if (result.packageId) {
        router.push('/onboarding?flow=customer-package');
      } else {
        router.push('/onboarding?flow=user-registration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accept Your Invitation
          </h2>
          {invitationInfo.email && (
            <p className="mt-2 text-center text-sm text-gray-600">
              You've been invited to join as <strong>{invitationInfo.role}</strong>
            </p>
          )}
          {invitationInfo.companyName && (
            <p className="mt-1 text-center text-sm text-gray-600">
              Company: <strong>{invitationInfo.companyName}</strong>
            </p>
          )}
        </div>

        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            {invitationInfo.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
                  {invitationInfo.email}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                {...form.register('name')}
                type="text"
                autoComplete="name"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your full name"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  {...form.register('firstName')}
                  type="text"
                  autoComplete="given-name"
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="First name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  {...form.register('lastName')}
                  type="text"
                  autoComplete="family-name"
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                {...form.register('password')}
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Create a password"
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <input
                {...form.register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm your password"
              />
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Accepting Invitation...' : 'Accept Invitation'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-600">
              By accepting this invitation, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
                Privacy Policy
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}