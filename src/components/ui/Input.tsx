"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Input label
   */
  label?: string;
  
  /**
   * Helper text displayed below the input
   */
  helperText?: string;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Left icon
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Right icon
   */
  rightIcon?: React.ReactNode;
  
  /**
   * Full width input
   */
  fullWidth?: boolean;

  /**
   * Show password toggle for password inputs
   */
  showPasswordToggle?: boolean;
}

/**
 * Input component with various styles and states
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      showPasswordToggle = false,
      id,
      ...props
    },
    ref
  ) => {
    // Generate a unique ID if not provided
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    // State for password visibility
    const [showPassword, setShowPassword] = useState(false);
    
    // Determine actual input type
    const actualType = type === 'password' && showPassword ? 'text' : type;
    
    // Show password toggle for password inputs
    const shouldShowPasswordToggle = showPasswordToggle && type === 'password';
    
    // Password toggle icon
    const passwordToggleIcon = shouldShowPasswordToggle ? (
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-secondary-400 hover:text-secondary-600 focus:outline-none focus:text-secondary-600"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        )}
      </button>
    ) : null;
    
    return (
      <div className={cn('flex flex-col space-y-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-secondary-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-secondary-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={actualType}
            className={cn(
              'flex h-10 w-full rounded-md border border-secondary-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-error focus-visible:ring-error',
              leftIcon && 'pl-10',
              (rightIcon || shouldShowPasswordToggle) && 'pr-10',
              fullWidth && 'w-full',
              className
            )}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-description` : undefined}
            {...props}
          />
          {rightIcon && !shouldShowPasswordToggle && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-secondary-400">
              {rightIcon}
            </div>
          )}
          {passwordToggleIcon}
        </div>
        {helperText && !error && (
          <p id={`${inputId}-description`} className="text-xs text-secondary-500">
            {helperText}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';