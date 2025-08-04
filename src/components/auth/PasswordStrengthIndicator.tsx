'use client';

import React, { useState, useEffect } from 'react';
// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

interface PasswordStrengthResult {
  score: number;
  isValid: boolean;
  feedback: string[];
  warnings: string[];
}

interface PasswordStrengthIndicatorProps {
  password: string;
  userInfo?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  onValidationChange?: (isValid: boolean, result: PasswordStrengthResult) => void;
  showDetails?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  userInfo,
  onValidationChange,
  showDetails = true,
}: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState<PasswordStrengthResult | null>(null);
  const [isCompromised, setIsCompromised] = useState(false);
  const [isReused, setIsReused] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounced validation function
  const validatePassword = debounce(async (pwd: string) => {
    if (!pwd) {
      setStrength(null);
      setIsCompromised(false);
      setIsReused(false);
      onValidationChange?.(false, {
        score: 0,
        isValid: false,
        feedback: ['Password is required'],
        warnings: [],
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: pwd,
          userInfo,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStrength(data.strength);
        setIsCompromised(data.isCompromised);
        setIsReused(data.isReused);

        const isValid = data.strength.isValid && !data.isCompromised && !data.isReused;
        onValidationChange?.(isValid, {
          ...data.strength,
          isValid,
          feedback: [
            ...data.strength.feedback,
            ...(data.isCompromised ? ['This password has been found in data breaches'] : []),
            ...(data.isReused ? ['This password has been used recently'] : []),
          ],
        });
      }
    } catch (error) {
      console.error('Password validation error:', error);
    } finally {
      setLoading(false);
    }
  }, 500);

  useEffect(() => {
    validatePassword(password);
    return () => {
      validatePassword.cancel();
    };
  }, [password, userInfo]);

  if (!password) {
    return null;
  }

  const getStrengthColor = (score: number) => {
    if (score < 30) return 'bg-red-500';
    if (score < 60) return 'bg-yellow-500';
    if (score < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthText = (score: number) => {
    if (score < 30) return 'Weak';
    if (score < 60) return 'Fair';
    if (score < 80) return 'Good';
    return 'Strong';
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Password Strength</span>
          {loading ? (
            <span className="text-gray-500">Checking...</span>
          ) : strength ? (
            <span className={`font-medium ${
              strength.score < 30 ? 'text-red-600' :
              strength.score < 60 ? 'text-yellow-600' :
              strength.score < 80 ? 'text-blue-600' :
              'text-green-600'
            }`}>
              {getStrengthText(strength.score)} ({strength.score}/100)
            </span>
          ) : null}
        </div>
        
        {strength && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(strength.score)}`}
              style={{ width: `${strength.score}%` }}
            />
          </div>
        )}
      </div>

      {/* Security Warnings */}
      {(isCompromised || isReused) && (
        <div className="space-y-1">
          {isCompromised && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>⚠️ This password has been found in data breaches</span>
            </div>
          )}
          {isReused && (
            <div className="flex items-center space-x-2 text-orange-600 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>⚠️ This password has been used recently</span>
            </div>
          )}
        </div>
      )}

      {/* Detailed Feedback */}
      {showDetails && strength && (
        <div className="space-y-2">
          {/* Requirements */}
          {strength.feedback.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-700">Requirements:</h4>
              <ul className="space-y-1">
                {strength.feedback.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-red-600">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {strength.warnings.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-700">Suggestions:</h4>
              <ul className="space-y-1">
                {strength.warnings.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-yellow-600">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success */}
          {strength.isValid && !isCompromised && !isReused && (
            <div className="flex items-center space-x-2 text-green-600 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>✅ Password meets all security requirements</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}