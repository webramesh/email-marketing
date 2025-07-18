import React, { Fragment, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Function to close the modal
   */
  onClose: () => void;
  
  /**
   * Modal title
   */
  title?: React.ReactNode;
  
  /**
   * Modal content
   */
  children: React.ReactNode;
  
  /**
   * Modal footer
   */
  footer?: React.ReactNode;
  
  /**
   * Modal size
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /**
   * Whether to close the modal when clicking outside
   */
  closeOnOverlayClick?: boolean;
  
  /**
   * Whether to close the modal when pressing escape key
   */
  closeOnEsc?: boolean;
  
  /**
   * Additional class name for the modal
   */
  className?: string;
}

/**
 * Modal component for displaying content in a dialog
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle ESC key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && closeOnEsc) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEsc]);
  
  // Handle click outside
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };
  
  // Prevent scroll on body when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };
  
  return (
    <Fragment>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
        onClick={handleOverlayClick}
      >
        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            ref={modalRef}
            className={cn(
              'w-full rounded-lg bg-white shadow-xl transition-all',
              sizeClasses[size],
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between border-b border-secondary-200 px-6 py-4">
                <h3 id="modal-title" className="text-lg font-semibold text-secondary-900">
                  {title}
                </h3>
                <button
                  type="button"
                  className="rounded-md p-1 text-secondary-400 hover:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Content */}
            <div className="px-6 py-4">
              {children}
            </div>
            
            {/* Footer */}
            {footer && (
              <div className="border-t border-secondary-200 px-6 py-4">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Modal header component
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('flex items-center justify-between border-b border-secondary-200 px-6 py-4', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Modal body component
 */
export const ModalBody: React.FC<ModalBodyProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('px-6 py-4', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Modal footer component
 */
export const ModalFooter: React.FC<ModalFooterProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('flex items-center justify-end space-x-2 border-t border-secondary-200 px-6 py-4', className)}
      {...props}
    >
      {children}
    </div>
  );
};