import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Avatar size
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Avatar image source
   */
  src?: string;
  
  /**
   * Avatar alt text
   */
  alt?: string;
  
  /**
   * Fallback text (initials) when image is not available
   */
  fallback?: string;
  
  /**
   * Whether the avatar has a border
   */
  bordered?: boolean;
  
  /**
   * Status indicator
   */
  status?: 'online' | 'offline' | 'away' | 'busy' | 'none';
}

/**
 * Avatar component for displaying user profile images
 */
export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ 
    className, 
    size = 'md', 
    src, 
    alt = '', 
    fallback, 
    bordered = false,
    status = 'none',
    ...props 
  }, ref) => {
    const [imageError, setImageError] = React.useState(!src);
    
    // Handle image load error
    const handleError = () => {
      setImageError(true);
    };
    
    // Generate initials from fallback text
    const getInitials = () => {
      if (!fallback) return '';
      
      return fallback
        .split(' ')
        .map(part => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    };
    
    // Size styles
    const sizeStyles = {
      xs: 'h-6 w-6 text-xs',
      sm: 'h-8 w-8 text-sm',
      md: 'h-10 w-10 text-base',
      lg: 'h-12 w-12 text-lg',
      xl: 'h-16 w-16 text-xl',
    };
    
    // Status styles
    const statusStyles = {
      online: 'bg-green-500',
      offline: 'bg-secondary-300',
      away: 'bg-yellow-500',
      busy: 'bg-red-500',
      none: 'hidden',
    };
    
    // Status size based on avatar size
    const statusSizeStyles = {
      xs: 'h-1.5 w-1.5',
      sm: 'h-2 w-2',
      md: 'h-2.5 w-2.5',
      lg: 'h-3 w-3',
      xl: 'h-3.5 w-3.5',
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-100',
          sizeStyles[size],
          bordered && 'ring-2 ring-white',
          className
        )}
        {...props}
      >
        {!imageError && src ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={handleError}
          />
        ) : (
          <span className="font-medium text-secondary-700">
            {getInitials()}
          </span>
        )}
        
        {status !== 'none' && (
          <span 
            className={cn(
              'absolute right-0 bottom-0 block rounded-full ring-2 ring-white',
              statusStyles[status],
              statusSizeStyles[size]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of avatars to display
   */
  max?: number;
  
  /**
   * Avatar size
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Whether avatars have borders
   */
  bordered?: boolean;
}

/**
 * Avatar group component for displaying multiple avatars
 */
export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max, size = 'md', bordered = true, children, ...props }, ref) => {
    const avatars = React.Children.toArray(children);
    const displayAvatars = max ? avatars.slice(0, max) : avatars;
    const remainingCount = max && avatars.length > max ? avatars.length - max : 0;
    
    // Size styles for the counter
    const sizeStyles = {
      xs: 'h-6 w-6 text-xs',
      sm: 'h-8 w-8 text-sm',
      md: 'h-10 w-10 text-base',
      lg: 'h-12 w-12 text-lg',
      xl: 'h-16 w-16 text-xl',
    };
    
    return (
      <div
        ref={ref}
        className={cn('flex -space-x-2', className)}
        {...props}
      >
        {displayAvatars.map((avatar, index) => (
          <div key={index} className="relative">
            {React.isValidElement(avatar) &&
              React.cloneElement(avatar as React.ReactElement<AvatarProps>, {
                size,
                bordered,
                className: cn((avatar as React.ReactElement<AvatarProps>).props.className),
              })}
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-100 font-medium text-secondary-700',
              sizeStyles[size],
              bordered && 'ring-2 ring-white'
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';