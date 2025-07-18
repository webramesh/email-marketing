import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  /**
   * Selected date
   */
  value?: Date;
  
  /**
   * Function called when date changes
   */
  onChange?: (date: Date) => void;
  
  /**
   * Minimum selectable date
   */
  minDate?: Date;
  
  /**
   * Maximum selectable date
   */
  maxDate?: Date;
  
  /**
   * Date format for display
   */
  format?: string;
  
  /**
   * Input placeholder
   */
  placeholder?: string;
  
  /**
   * Whether the date picker is disabled
   */
  disabled?: boolean;
  
  /**
   * Label for the date picker
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
   * Additional class name
   */
  className?: string;
  
  /**
   * ID for the input
   */
  id?: string;
}

/**
 * Date picker component
 */
export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  format = 'MM/dd/yyyy',
  placeholder = 'Select date',
  disabled = false,
  label,
  error,
  helperText,
  className,
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const [inputValue, setInputValue] = useState('');
  const datePickerRef = useRef<HTMLDivElement>(null);
  const inputId = id || `date-picker-${Math.random().toString(36).substring(2, 9)}`;
  
  // Format date for display
  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    
    return format
      .replace('MM', month.toString().padStart(2, '0'))
      .replace('dd', day.toString().padStart(2, '0'))
      .replace('yyyy', year.toString());
  };
  
  // Parse date from string
  const parseDate = (dateString: string): Date | null => {
    // Simple parsing for MM/dd/yyyy format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    
    return null;
  };
  
  // Update input value when value changes
  useEffect(() => {
    if (value) {
      setInputValue(formatDate(value));
      setCurrentMonth(value);
    } else {
      setInputValue('');
    }
  }, [value]);
  
  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const parsedDate = parseDate(newValue);
    if (parsedDate) {
      onChange?.(parsedDate);
    }
  };
  
  // Handle date selection
  const handleDateSelect = (date: Date) => {
    onChange?.(date);
    setIsOpen(false);
  };
  
  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Get day of week for first day of month (0 = Sunday, 6 = Saturday)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  // Check if date is in range
  const isInRange = (date: Date) => {
    if (minDate && date < minDate) return false;
    if (maxDate && date > maxDate) return false;
    return true;
  };
  
  // Check if date is selected
  const isSelected = (date: Date) => {
    return value && 
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear();
  };
  
  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };
  
  // Render calendar
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentMonth);
    
    // Create array of days
    const days = [];
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const inRange = isInRange(date);
      
      days.push(
        <button
          key={`day-${day}`}
          type="button"
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-sm',
            isSelected(date) && 'bg-primary text-white',
            isToday(date) && !isSelected(date) && 'border border-primary text-primary',
            !inRange && 'text-secondary-300 cursor-not-allowed',
            inRange && !isSelected(date) && !isToday(date) && 'hover:bg-secondary-100'
          )}
          onClick={() => inRange && handleDateSelect(date)}
          disabled={!inRange}
        >
          {day}
        </button>
      );
    }
    
    return (
      <div className="p-3 bg-white rounded-md shadow-lg border border-secondary-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="p-1 rounded-full hover:bg-secondary-100"
            onClick={prevMonth}
          >
            <svg
              className="h-5 w-5 text-secondary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="font-medium">
            {monthName} {year}
          </div>
          <button
            type="button"
            className="p-1 rounded-full hover:bg-secondary-100"
            onClick={nextMonth}
          >
            <svg
              className="h-5 w-5 text-secondary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        
        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div
              key={day}
              className="h-8 w-8 flex items-center justify-center text-xs font-medium text-secondary-500"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };
  
  return (
    <div className={cn('flex flex-col space-y-1.5', className)} ref={datePickerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-secondary-700"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          id={inputId}
          type="text"
          className={cn(
            'flex h-10 w-full rounded-md border border-secondary-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error focus-visible:ring-error'
          )}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          readOnly
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-description` : undefined}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <button
            type="button"
            className="text-secondary-400 hover:text-secondary-600"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
        
        {isOpen && (
          <div className="absolute z-10 mt-1 w-64">
            {renderCalendar()}
          </div>
        )}
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