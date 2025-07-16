# UI/UX Design System

## Color Palette

The platform uses a modern, professional color scheme that ensures accessibility and visual hierarchy:

```typescript
export const colors = {
  // Primary Colors
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE', 
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#1E40AF', // Primary brand color
    700: '#1E3A8A',
    800: '#1E3A8A',
    900: '#1E3A8A',
  },
  
  // Secondary Colors
  secondary: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B', // Secondary brand color
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  
  // Accent Colors
  accent: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Success/accent color
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  
  // Semantic Colors
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444', // Error color
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B', // Warning color
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  
  // Neutral Colors
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  
  // Background & Text
  background: '#FFFFFF',
  text: {
    primary: '#1F2937',   // Dark gray for primary text
    secondary: '#6B7280', // Medium gray for secondary text
    tertiary: '#9CA3AF',  // Light gray for tertiary text
    inverse: '#FFFFFF',   // White text for dark backgrounds
  },
};
```

## Typography System

```typescript
export const typography = {
  fontFamily: {
    primary: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};
```

## Component Design Principles

### Modern UI/UX Guidelines

1. **Clean & Minimalist Design**
   - Generous white space for better readability
   - Clear visual hierarchy with consistent spacing
   - Subtle shadows and borders for depth

2. **Professional Appearance**
   - Consistent color usage throughout the application
   - Professional typography with proper contrast ratios
   - Polished icons and illustrations

3. **User-Friendly Interface**
   - Intuitive navigation with clear labels
   - Contextual help and tooltips
   - Progressive disclosure of complex features

4. **Responsive Design**
   - Mobile-first approach
   - Flexible grid system
   - Adaptive components for all screen sizes

## Component Library

### Base Component Structure

```typescript
interface ComponentProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
}
```

### Button Component

```typescript
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 focus:ring-secondary-500',
    outline: 'border border-secondary-300 text-secondary-700 hover:bg-secondary-50 focus:ring-secondary-500',
    ghost: 'text-secondary-700 hover:bg-secondary-100 focus:ring-secondary-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };
  
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
};
```

### Input Component

```typescript
export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className,
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        className={cn(
          'block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm',
          'placeholder-text-tertiary focus:outline-none focus:ring-primary-500 focus:border-primary-500',
          error && 'border-error-500 focus:ring-error-500 focus:border-error-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-error-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-text-secondary">{helperText}</p>
      )}
    </div>
  );
};
```

### Card Component

```typescript
export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  shadow = 'sm',
  ...props
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };
  
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-secondary-200',
        paddingClasses[padding],
        shadowClasses[shadow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
```

## Layout System

### Grid System

```typescript
export const gridSystem = {
  container: {
    maxWidth: {
      sm: '640px',
      md: '768px', 
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    padding: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
  },
  
  spacing: {
    0: '0px',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
  },
};
```

### Dashboard Layout

```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  tenant: Tenant;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  sidebar,
  header,
  tenant,
}) => {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <TenantLogo tenant={tenant} />
              <Navigation />
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        {sidebar && (
          <aside className="w-64 bg-white border-r border-neutral-200 min-h-screen">
            {sidebar}
          </aside>
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
```

## Accessibility Guidelines

### WCAG 2.1 Compliance

1. **Color Contrast**: All text meets WCAG AA standards (4.5:1 ratio)
2. **Keyboard Navigation**: All interactive elements are keyboard accessible
3. **Screen Reader Support**: Proper ARIA labels and semantic HTML
4. **Focus Management**: Clear focus indicators and logical tab order

### Implementation

```typescript
// Example accessible button with proper ARIA attributes
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  ariaLabel,
  ariaDescribedBy,
  ...props
}) => {
  return (
    <button
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      {...props}
    >
      {children}
    </button>
  );
};
```

This design system ensures a consistent, professional, and accessible user interface throughout the email marketing platform.