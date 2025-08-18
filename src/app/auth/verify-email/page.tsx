'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [userInfo, setUserInfo] = useState<{ email?: string; verificationType?: string }>({});
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const tenantId = searchParams.get('tenantId');

    if (!token || !tenantId) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    verifyEmail(token, tenantId);
  }, [searchParams]);

  const verifyEmail = async (token: string, tenantId: string) => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tenantId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setUserInfo({
          email: data.email,
          verificationType: data.verificationType,
        });
        setMessage('Your email has been verified successfully!');

        // Redirect to appropriate page after verification
        setTimeout(() => {
          if (data.verificationType === 'REGISTRATION') {
            router.push('/auth/signin?verified=true');
          } else if (data.verificationType === 'INVITATION') {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Email verification failed. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred during verification. Please try again.');
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        );
      case 'success':
        return (
          <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying Your Email';
      case 'success':
        return 'Email Verified Successfully';
      case 'error':
        return 'Verification Failed';
    }
  };

  const getActions = () => {
    switch (status) {
      case 'success':
        return (
          <div className="space-y-4">
            {userInfo.verificationType === 'REGISTRATION' && (
              <p className="text-sm text-gray-600">
                Redirecting you to sign in...
              </p>
            )}
            <div className="flex flex-col space-y-2">
              <Link
                href="/auth/signin"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Continue to Sign In
              </Link>
              {userInfo.verificationType === 'INVITATION' && (
                <Link
                  href="/onboarding"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Start Onboarding
                </Link>
              )}
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Link
                href="/auth/register"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Registration Again
              </Link>
              <Link
                href="/auth/signin"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {getTitle()}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {message}
          </p>
          {userInfo.email && (
            <p className="mt-2 text-sm text-gray-500">
              Email: <strong>{userInfo.email}</strong>
            </p>
          )}
        </div>
        
        <div className="mt-8">
          {getActions()}
        </div>

        {status === 'error' && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact our{' '}
              <Link href="/support" className="text-blue-600 hover:text-blue-500">
                support team
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}