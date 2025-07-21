'use client';

import React from 'react';
import { VerificationStatus, EmailValidationResult } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface EmailValidationIndicatorProps {
  status?: VerificationStatus;
  result?: EmailValidationResult;
  showDetails?: boolean;
  className?: string;
}

const statusConfig = {
  [VerificationStatus.VALID]: {
    label: 'Valid',
    color: 'success' as const,
    icon: '✓',
  },
  [VerificationStatus.INVALID]: {
    label: 'Invalid',
    color: 'error' as const,
    icon: '✗',
  },
  [VerificationStatus.RISKY]: {
    label: 'Risky',
    color: 'warning' as const,
    icon: '⚠',
  },
  [VerificationStatus.UNKNOWN]: {
    label: 'Unknown',
    color: 'secondary' as const,
    icon: '?',
  },
  [VerificationStatus.PENDING]: {
    label: 'Pending',
    color: 'primary' as const,
    icon: '⏳',
  },
};

export function EmailValidationIndicator({
  status,
  result,
  showDetails = false,
  className = '',
}: EmailValidationIndicatorProps) {
  if (!status) {
    return null;
  }

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Badge variant={config.color} className="flex items-center gap-1">
        <span className="text-xs">{config.icon}</span>
        {config.label}
        {result?.score && (
          <span className="ml-1 text-xs opacity-75">
            ({result.score}%)
          </span>
        )}
      </Badge>

      {showDetails && result && (
        <div className="text-xs text-gray-600">
          {result.reason && (
            <div className="mt-1">{result.reason}</div>
          )}

          {result.details && (
            <div className="mt-1 flex flex-wrap gap-1">
              {result.details.syntax && (
                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  Syntax ✓
                </span>
              )}
              {result.details.domain && (
                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  Domain ✓
                </span>
              )}
              {result.details.mx && (
                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  MX ✓
                </span>
              )}
              {result.details.disposable && (
                <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                  Disposable
                </span>
              )}
              {result.details.role && (
                <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                  Role-based
                </span>
              )}
              {result.details.free && (
                <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  Free provider
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EmailValidationInputProps {
  email: string;
  onEmailChange: (email: string) => void;
  validationResult?: EmailValidationResult | null;
  isValidating?: boolean;
  error?: string | null;
  placeholder?: string;
  className?: string;
}

export function EmailValidationInput({
  email,
  onEmailChange,
  validationResult,
  isValidating,
  error,
  placeholder = 'Enter email address',
  className = '',
}: EmailValidationInputProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
            ${validationResult?.isValid ? 'border-green-500' : ''}
            ${validationResult && !validationResult.isValid ? 'border-red-500' : ''}
            ${isValidating ? 'pr-8' : ''}
          `}
        />

        {isValidating && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {validationResult && (
        <div className="mt-2">
          <EmailValidationIndicator
            status={validationResult.status}
            result={validationResult}
            showDetails={true}
          />
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}