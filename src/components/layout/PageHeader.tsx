import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /**
   * Page title
   */
  title: string;
  
  /**
   * Page description
   */
  description?: string;
  
  /**
   * Actions to display in the header
   */
  actions?: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Page header component with title, description, and actions
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-secondary-500">{description}</p>
          )}
        </div>
        {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export interface PageSectionProps {
  /**
   * Section title
   */
  title?: string;
  
  /**
   * Section description
   */
  description?: string;
  
  /**
   * Section content
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Page section component for organizing content
 */
export function PageSection({
  title,
  description,
  children,
  className,
}: PageSectionProps) {
  return (
    <div className={cn('mb-8', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-lg font-medium text-secondary-900">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-secondary-500">{description}</p>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}