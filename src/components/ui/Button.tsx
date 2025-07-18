import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'link';
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Whether the button is in a loading state
   */
  isLoading?: boolean;
  
  /**
   * Whether the button is in a loading state (alias for isLoading)
   */
  loading?: boolean;
  
  /**
   * Icon to display before the button text
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Icon to display after the button text
   */
  rightIcon?: React.ReactNode;
  
  /**
   * Full width button
   */
  fullWidth?: boolean;
}

/**
 * Button component with various styles and states
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Base button styles
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    
    // Variant styles
    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700',
      secondary: 'bg-secondary text-white hover:bg-secondary-600 active:bg-secondary-700',
      accent: 'bg-accent text-white hover:bg-accent-600 active:bg-accent-700',
      outline: 'border border-secondary-200 bg-white hover:bg-secondary-50 hover:text-secondary-900 text-secondary-700',
      ghost: 'hover:bg-secondary-50 hover:text-secondary-900 text-secondary-700',
      link: 'text-primary underline-offset-4 hover:underline',
    };
    
    // Size styles
    const sizeStyles = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 py-3 text-lg',
    };
    
    // Width style
    const widthStyle = fullWidth ? 'w-full' : '';
    
    // Determine if loading (support both props)
    const isLoadingState = isLoading || loading;
    
    return (
      <button
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          widthStyle,
          isLoadingState && 'opacity-70 cursor-not-allowed',
          className
        )}
        disabled={disabled || isLoadingState}
        ref={ref}
        {...props}
      >
        {isLoadingState && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {!isLoadingState && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoadingState && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';