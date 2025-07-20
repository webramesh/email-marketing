import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmailValidationResult, EmailVerification, VerificationStatus, PaginatedResponse, BulkVerificationJob, BulkVerificationRequest } from '@/types';

interface UseEmailVerificationOptions {
  page?: number;
  limit?: number;
  status?: VerificationStatus;
}

/**
 * Hook for email verification operations
 */
export function useEmailVerification(options: UseEmailVerificationOptions = {}) {
  const queryClient = useQueryClient();
  const { page = 1, limit = 50, status } = options;

  // Get verification results with pagination
  const {
    data: verificationResults,
    isLoading: isLoadingResults,
    error: resultsError,
    refetch: refetchResults,
  } = useQuery({
    queryKey: ['email-verification-results', page, limit, status],
    queryFn: async (): Promise<PaginatedResponse<EmailVerification>> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
      });

      const response = await fetch(`/api/email-verification/results?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch verification results');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch verification results');
      }

      return {
        data: data.data,
        meta: data.meta,
      };
    },
  });

  // Validate single email mutation
  const validateEmailMutation = useMutation({
    mutationFn: async ({ email, useCache = true }: { email: string; useCache?: boolean }): Promise<EmailValidationResult> => {
      const response = await fetch('/api/email-verification/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, useCache }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate email');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to validate email');
      }

      return data.data;
    },
    onSuccess: () => {
      // Invalidate and refetch verification results
      queryClient.invalidateQueries({ queryKey: ['email-verification-results'] });
    },
  });

  // Get single email verification result
  const getEmailVerification = useCallback(async (email: string): Promise<EmailVerification | null> => {
    try {
      const response = await fetch(`/api/email-verification/validate?email=${encodeURIComponent(email)}`);
      
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to get verification result');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get verification result');
      }

      return data.data;
    } catch (error) {
      console.error('Error getting email verification:', error);
      return null;
    }
  }, []);

  // Bulk verification mutation
  const bulkVerificationMutation = useMutation({
    mutationFn: async (request: BulkVerificationRequest): Promise<BulkVerificationJob> => {
      const response = await fetch('/api/email-verification/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk verification');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start bulk verification');
      }

      return data.data;
    },
    onSuccess: () => {
      // Invalidate and refetch verification results
      queryClient.invalidateQueries({ queryKey: ['email-verification-results'] });
    },
  });

  // Get bulk verification job status
  const getBulkVerificationJob = useCallback(async (jobId: string): Promise<BulkVerificationJob | null> => {
    try {
      const response = await fetch(`/api/email-verification/bulk/${jobId}`);
      
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to get bulk verification job');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get bulk verification job');
      }

      return data.data;
    } catch (error) {
      console.error('Error getting bulk verification job:', error);
      return null;
    }
  }, []);

  // Export verification results
  const exportResults = useCallback(async (status?: VerificationStatus, format: 'csv' | 'json' = 'csv'): Promise<void> => {
    try {
      const params = new URLSearchParams({
        format,
        ...(status && { status }),
      });

      const response = await fetch(`/api/email-verification/export?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to export verification results');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-verification-results-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting verification results:', error);
      throw error;
    }
  }, []);

  return {
    // Data
    verificationResults: verificationResults?.data || [],
    resultsMeta: verificationResults?.meta,
    
    // Loading states
    isLoadingResults,
    isValidating: validateEmailMutation.isPending,
    isBulkVerifying: bulkVerificationMutation.isPending,
    
    // Error states
    resultsError,
    validationError: validateEmailMutation.error,
    bulkVerificationError: bulkVerificationMutation.error,
    
    // Actions
    validateEmail: validateEmailMutation.mutateAsync,
    startBulkVerification: bulkVerificationMutation.mutateAsync,
    getBulkVerificationJob,
    getEmailVerification,
    exportResults,
    refetchResults,
    
    // Mutation state
    validationResult: validateEmailMutation.data,
    bulkVerificationJob: bulkVerificationMutation.data,
    resetValidation: validateEmailMutation.reset,
    resetBulkVerification: bulkVerificationMutation.reset,
  };
}

/**
 * Hook for real-time email validation with debouncing
 */
export function useRealTimeEmailValidation(debounceMs = 500) {
  const [email, setEmail] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [validationResult, setValidationResult] = useState<EmailValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce email input
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  const updateEmail = useCallback((newEmail: string) => {
    setEmail(newEmail);
    setError(null);

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    if (newEmail.trim()) {
      const timeout = setTimeout(() => {
        setDebouncedEmail(newEmail.trim());
      }, debounceMs);
      
      setDebounceTimeout(timeout);
    } else {
      setDebouncedEmail('');
      setValidationResult(null);
    }
  }, [debounceMs, debounceTimeout]);

  // Validate email when debounced email changes
  const validateDebouncedEmail = useCallback(async () => {
    if (!debouncedEmail) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/email-verification/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: debouncedEmail, useCache: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate email');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to validate email');
      }

      setValidationResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  }, [debouncedEmail]);

  // Effect to validate when debounced email changes
  useState(() => {
    if (debouncedEmail) {
      validateDebouncedEmail();
    }
  });

  return {
    email,
    updateEmail,
    validationResult,
    isValidating,
    error,
    isValid: validationResult?.isValid || false,
    status: validationResult?.status,
  };
}