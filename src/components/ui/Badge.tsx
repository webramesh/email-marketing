import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Badge variant
   */
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'outline';
  
  /**
   * Badge color (alias for variant)
   */
  color?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'outline' | 'green' | 'red' | 'blue' | 'orange' | 'gray';
  
  /**
   * Badge size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Whether the badge is rounded
   */
  rounded?: boolean;
}

/**
 * Badge component for displaying status or count
 */
export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', color, size = 'md', rounded = false, ...props }, ref) => {
    // Determine the effective variant (color takes precedence)
    const effectiveVariant = color || variant;
    
    // Variant styles
    const variantStyles = {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-blue-100 text-blue-800',
      secondary: 'bg-gray-100 text-gray-800',
      accent: 'bg-green-100 text-green-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      outline: 'bg-transparent border border-gray-200 text-gray-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    
    // Size styles
    const sizeStyles = {
      sm: 'text-xs px-2 py-0.5',
      md: 'text-xs px-2.5 py-0.5',
      lg: 'text-sm px-3 py-1',
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium',
          rounded ? 'rounded-full' : 'rounded-md',
          variantStyles[effectiveVariant as keyof typeof variantStyles] || variantStyles.default,
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';