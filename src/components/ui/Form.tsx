import React from 'react';
import { useFormContext, Controller, FieldValues, Path, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Input, InputProps } from './Input';
import { Dropdown, DropdownProps } from './Dropdown';

export interface FormProps<TFormValues extends FieldValues = FieldValues>
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /**
   * Form submission handler
   */
  onSubmit?: (data: TFormValues) => void | Promise<void>;
  
  /**
   * Form children
   */
  children: React.ReactNode;
}

/**
 * Form component that wraps form elements
 */
export const Form = <TFormValues extends FieldValues = FieldValues>({
  onSubmit,
  children,
  className,
  ...props
}: FormProps<TFormValues>) => {
  const context = useFormContext<TFormValues>();
  
  if (!context) {
    console.warn('Form component must be used within a FormProvider');
    return (
      <form
        className={cn('space-y-4', className)}
        onSubmit={e => {
          e.preventDefault();
          onSubmit && onSubmit({} as TFormValues);
        }}
        {...props}
      >
        {children}
      </form>
    );
  }
  
  const { handleSubmit } = context;
  
  return (
    <form
      className={cn('space-y-4', className)}
      onSubmit={onSubmit ? handleSubmit(onSubmit) : undefined}
      {...props}
    >
      {children}
    </form>
  );
};

export interface FormFieldProps<TFormValues extends FieldValues = FieldValues> {
  /**
   * Field name
   */
  name: Path<TFormValues>;
  
  /**
   * Field label
   */
  label?: string;
  
  /**
   * Helper text
   */
  helperText?: string;
  
  /**
   * Whether the field is required
   */
  required?: boolean;
  
  /**
   * Field render function
   */
  render: (props: {
    field: any;
    fieldState: {
      invalid: boolean;
      isTouched: boolean;
      isDirty: boolean;
      error?: FieldError;
    };
  }) => React.ReactNode;
}

/**
 * Form field component that connects to React Hook Form
 */
export const FormField = <TFormValues extends FieldValues = FieldValues>({
  name,
  label,
  helperText,
  required,
  render,
}: FormFieldProps<TFormValues>) => {
  const context = useFormContext<TFormValues>();
  
  if (!context) {
    console.warn('FormField must be used within a FormProvider');
    return null;
  }
  
  return (
    <Controller
      name={name}
      control={context.control}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          {label && (
            <label
              htmlFor={name}
              className="text-sm font-medium text-secondary-700"
            >
              {label}
              {required && <span className="text-error ml-1">*</span>}
            </label>
          )}
          {render({ field, fieldState })}
          {helperText && !fieldState.error && (
            <p className="text-xs text-secondary-500">{helperText}</p>
          )}
          {fieldState.error && (
            <p className="text-xs text-error">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
};

export interface FormInputProps<TFormValues extends FieldValues = FieldValues>
  extends Omit<InputProps, 'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur' | 'ref' | 'error'> {
  /**
   * Field name
   */
  name: Path<TFormValues>;
  
  /**
   * Helper text
   */
  helperText?: string;
}

/**
 * Form input component that connects to React Hook Form
 */
export const FormInput = <TFormValues extends FieldValues = FieldValues>({
  name,
  label,
  helperText,
  ...props
}: FormInputProps<TFormValues>) => {
  const context = useFormContext<TFormValues>();
  
  if (!context) {
    console.warn('FormInput must be used within a FormProvider');
    return <Input label={label} {...props} />;
  }
  
  return (
    <FormField
      name={name}
      label={label}
      helperText={helperText}
      render={({ field, fieldState }) => (
        <Input
          {...props}
          {...field}
          error={fieldState.error?.message}
          id={name}
        />
      )}
    />
  );
};

export interface FormDropdownProps<TFormValues extends FieldValues = FieldValues>
  extends Omit<DropdownProps, 'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur' | 'error'> {
  /**
   * Field name
   */
  name: Path<TFormValues>;
  
  /**
   * Helper text
   */
  helperText?: string;
}

/**
 * Form dropdown component that connects to React Hook Form
 */
export const FormDropdown = <TFormValues extends FieldValues = FieldValues>({
  name,
  label,
  helperText,
  items,
  ...props
}: FormDropdownProps<TFormValues>) => {
  const context = useFormContext<TFormValues>();
  
  if (!context) {
    console.warn('FormDropdown must be used within a FormProvider');
    return <Dropdown label={label} items={items} {...props} />;
  }
  
  return (
    <FormField
      name={name}
      label={label}
      helperText={helperText}
      render={({ field, fieldState }) => (
        <Dropdown
          {...props}
          items={items}
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message}
          id={name}
        />
      )}
    />
  );
};

export interface FormErrorProps {
  /**
   * Error message
   */
  message?: string;
}

/**
 * Form error component for displaying form-level errors
 */
export const FormError: React.FC<FormErrorProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="rounded-md bg-error-50 p-3 text-sm text-error">
      <p>{message}</p>
    </div>
  );
};

export interface FormSuccessProps {
  /**
   * Success message
   */
  message?: string;
}

/**
 * Form success component for displaying form-level success messages
 */
export const FormSuccess: React.FC<FormSuccessProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
      <p>{message}</p>
    </div>
  );
};