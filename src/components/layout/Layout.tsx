import React from 'react';
import { cn } from '@/lib/utils';

export interface LayoutProps {
  /**
   * Layout children
   */
  children: React.ReactNode;
  
  /**
   * Whether to include padding
   */
  withPadding?: boolean;
  
  /**
   * Maximum width of the layout
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Main layout component
 */
export function Layout({
  children,
  withPadding = true,
  maxWidth = 'xl',
  className,
}: LayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };
  
  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        withPadding && 'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface HeaderProps {
  /**
   * Header children
   */
  children: React.ReactNode;
  
  /**
   * Whether the header is sticky
   */
  sticky?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Header component
 */
export function Header({
  children,
  sticky = false,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'bg-white border-b border-secondary-200',
        sticky && 'sticky top-0 z-10',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {children}
        </div>
      </div>
    </header>
  );
}

export interface MainProps {
  /**
   * Main content
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Main content component
 */
export function Main({
  children,
  className,
}: MainProps) {
  return (
    <main className={cn('py-6', className)}>
      {children}
    </main>
  );
}

export interface FooterProps {
  /**
   * Footer content
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Footer component
 */
export function Footer({
  children,
  className,
}: FooterProps) {
  return (
    <footer
      className={cn(
        'bg-white border-t border-secondary-200 py-6',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </footer>
  );
}