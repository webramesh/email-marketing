import React, { useRef, useState, useEffect, useId } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItemProps {
  /**
   * Item label
   */
  label: React.ReactNode;
  
  /**
   * Item value
   */
  value?: string;
  
  /**
   * Whether the item is disabled
   */
  disabled?: boolean;
  
  /**
   * Icon to display before the label
   */
  icon?: React.ReactNode;
  
  /**
   * Click handler for the item
   */
  onClick?: () => void;
  
  /**
   * Additional class name for the item
   */
  className?: string;
}

export interface DropdownProps {
  /**
   * Dropdown items
   */
  items?: DropdownItemProps[];
  
  /**
   * Selected value
   */
  value?: string;
  
  /**
   * Function called when selection changes
   */
  onChange?: (value: string) => void;
  
  /**
   * Dropdown placeholder
   */
  placeholder?: string;
  
  /**
   * Whether the dropdown is disabled
   */
  disabled?: boolean;
  
  /**
   * Dropdown label
   */
  label?: string;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Helper text
   */
  helperText?: string;
  
  /**
   * Full width dropdown
   */
  fullWidth?: boolean;
  
  /**
   * Additional class name
   */
  className?: string;
  
  /**
   * ID for the dropdown
   */
  id?: string;
  
  /**
   * Trigger element for the dropdown
   */
  trigger?: React.ReactNode;
  
  /**
   * Children to render (alternative to items)
   */
  children?: React.ReactNode;
}

/**
 * Dropdown component for selecting from a list of options
 */
export const Dropdown: React.FC<DropdownProps> = ({
  items = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  id,
  trigger,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const dropdownId = id || `dropdown-${generatedId}`;
  
  // Find the selected item
  const selectedItem = items.find(item => item.value === value);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle item selection
  const handleSelect = (item: DropdownItemProps) => {
    if (item.disabled) return;
    if (item.onClick) {
      item.onClick();
    } else if (item.value && onChange) {
      onChange(item.value);
    }
    setIsOpen(false);
  };

  // If trigger is provided, render as a trigger-based dropdown
  if (trigger) {
    return (
      <div ref={dropdownRef} className={cn('relative inline-block', className)}>
        <div onClick={() => !disabled && setIsOpen(!isOpen)}>
          {trigger}
        </div>
        
        {isOpen && (
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={item.value || index}
                  className={cn(
                    'flex w-full items-center px-4 py-2 text-sm text-left hover:bg-gray-50',
                    item.disabled && 'opacity-50 cursor-not-allowed',
                    item.className
                  )}
                  onClick={() => handleSelect(item)}
                  disabled={item.disabled}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Default select-style dropdown
  return (
    <div className={cn('flex flex-col space-y-1.5', fullWidth && 'w-full', className)}>
      {label && (
        <label
          htmlFor={dropdownId}
          className="text-sm font-medium text-secondary-700"
        >
          {label}
        </label>
      )}
      
      <div ref={dropdownRef} className="relative">
        <button
          id={dropdownId}
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-secondary-200 bg-white px-3 py-2 text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error focus-visible:ring-error',
            fullWidth && 'w-full'
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? dropdownId : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${dropdownId}-error` : helperText ? `${dropdownId}-description` : undefined}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
          <svg
            className={cn(
              'h-4 w-4 opacity-50 transition-transform',
              isOpen && 'rotate-180'
            )}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-secondary-200 bg-white shadow-lg">
            <ul
              className="max-h-60 overflow-auto py-1"
              role="listbox"
              aria-labelledby={dropdownId}
            >
              {items.map((item, index) => (
                <li
                  key={item.value || index}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm cursor-pointer',
                    item.value === value ? 'bg-primary-50 text-primary-900' : 'text-secondary-700 hover:bg-secondary-50',
                    item.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => handleSelect(item)}
                  role="option"
                  aria-selected={item.value === value}
                  aria-disabled={item.disabled}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                  {item.value === value && (
                    <svg
                      className="ml-auto h-4 w-4 text-primary-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {helperText && !error && (
        <p id={`${dropdownId}-description`} className="text-xs text-secondary-500">
          {helperText}
        </p>
      )}
      
      {error && (
        <p id={`${dropdownId}-error`} className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
};