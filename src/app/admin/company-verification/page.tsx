'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const verificationSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().optional(),
  businessAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'ZIP code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  businessDocuments: z.array(z.string()).optional(),
  verificationNotes: z.string().optional(),
});

type VerificationFormData = z.infer<typeof verificationSchema>;

export default function CompanyVerificationPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      companyName: '',
      businessType: '',
      contactEmail: session?.user?.email || '',
      contactPhone: '',
      businessAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
      businessDocuments: [],
      verificationNotes: '',
    },
  });

  const onSubmit = async (data: VerificationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/company-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit verification request');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification request');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Verification Submitted</h3>
            <p className="mt-1 text-sm text-gray-600">
              Your company verification request has been submitted successfully. 
              Our team will review your information and get back to you within 2-3 business days.
            </p>
            <div className="mt-6">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Company Verification</h1>
            <p className="mt-1 text-sm text-gray-600">
              Submit your company information for verification to start selling packages on our platform.
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  {...form.register('companyName')}
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {form.formState.errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">{form.formState.errors.companyName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Business Type *
                </label>
                <select
                  {...form.register('businessType')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select business type</option>
                  <option value="corporation">Corporation</option>
                  <option value="llc">LLC</option>
                  <option value="partnership">Partnership</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="nonprofit">Non-profit</option>
                  <option value="other">Other</option>
                </select>
                {form.formState.errors.businessType && (
                  <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessType.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Email *
                  </label>
                  <input
                    {...form.register('contactEmail')}
                    type="email"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.contactEmail && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.contactEmail.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Phone
                  </label>
                  <input
                    {...form.register('contactPhone')}
                    type="tel"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Street Address *
                    </label>
                    <input
                      {...form.register('businessAddress.street')}
                      type="text"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.businessAddress?.street && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessAddress.street.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        City *
                      </label>
                      <input
                        {...form.register('businessAddress.city')}
                        type="text"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.businessAddress?.city && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessAddress.city.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        State *
                      </label>
                      <input
                        {...form.register('businessAddress.state')}
                        type="text"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.businessAddress?.state && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessAddress.state.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        ZIP Code *
                      </label>
                      <input
                        {...form.register('businessAddress.zipCode')}
                        type="text"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.businessAddress?.zipCode && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessAddress.zipCode.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Country *
                      </label>
                      <select
                        {...form.register('businessAddress.country')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="other">Other</option>
                      </select>
                      {form.formState.errors.businessAddress?.country && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.businessAddress.country.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Additional Notes
                </label>
                <textarea
                  {...form.register('verificationNotes')}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional information you'd like to provide..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}