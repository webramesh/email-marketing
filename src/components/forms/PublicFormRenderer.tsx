'use client';

import React, { useState } from 'react';
import { FormField, FormStyling, FormSettings } from '@/services/form.service';

interface PublicFormRendererProps {
  formId: string;
  fields: FormField[];
  styling: FormStyling;
  settings: FormSettings;
}

export function PublicFormRenderer({ formId, fields, styling, settings }: PublicFormRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear field error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.label} is required`;
    }

    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    if (field.validation && value) {
      if (field.validation.minLength && value.length < field.validation.minLength) {
        return `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && value.length > field.validation.maxLength) {
        return `${field.label} must be no more than ${field.validation.maxLength} characters`;
      }
      if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
        return `${field.label} format is invalid`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    for (const field of fields) {
      const value = formData[field.id];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.id] = error;
        hasErrors = true;
      }
    }

    setErrors(newErrors);
    setSubmitError(null);

    if (hasErrors) return;

    // Prepare submission data
    const submissionData: any = {
      email: '',
      firstName: '',
      lastName: '',
      customFields: {},
    };

    // Map form data to submission format
    for (const field of fields) {
      const value = formData[field.id];
      if (!value) continue;

      if (field.type === 'email') {
        submissionData.email = value;
      } else if (field.customField) {
        submissionData.customFields[field.customField] = value;
      } else {
        // Map common field types
        switch (field.id.toLowerCase()) {
          case 'firstname':
          case 'first_name':
            submissionData.firstName = value;
            break;
          case 'lastname':
          case 'last_name':
            submissionData.lastName = value;
            break;
          default:
            submissionData.customFields[field.id] = value;
        }
      }
    }

    // Submit form
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionData,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Submission failed');
      }

      // Handle successful submission
      if (settings.redirectUrl) {
        window.location.href = settings.redirectUrl;
      } else {
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formStyles = {
    backgroundColor: styling.backgroundColor,
    color: styling.textColor,
    fontFamily: styling.fontFamily,
    fontSize: `${styling.fontSize}px`,
    borderRadius: `${styling.borderRadius}px`,
  };

  const inputStyles = {
    borderColor: styling.borderColor,
    borderRadius: `${styling.borderRadius}px`,
    fontSize: `${styling.fontSize}px`,
    fontFamily: styling.fontFamily,
  };

  const buttonStyles = {
    backgroundColor: styling.buttonStyle.backgroundColor,
    color: styling.buttonStyle.textColor,
    borderRadius: `${styling.buttonStyle.borderRadius}px`,
    padding: styling.buttonStyle.padding,
    fontFamily: styling.fontFamily,
  };

  if (isSubmitted && settings.showThankYouMessage) {
    return (
      <div className="max-w-md mx-auto">
        <div
          className="p-8 border rounded-lg text-center"
          style={formStyles}
        >
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">Success!</h3>
          <p>{settings.thankYouMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="p-6 border rounded-lg space-y-4"
        style={formStyles}
      >
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'email' && (
              <input
                type="email"
                placeholder={field.placeholder}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                required={field.required}
                className={`w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors[field.id] ? 'border-red-500' : ''
                }`}
                style={inputStyles}
              />
            )}

            {field.type === 'text' && (
              <input
                type="text"
                placeholder={field.placeholder}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                required={field.required}
                className={`w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors[field.id] ? 'border-red-500' : ''
                }`}
                style={inputStyles}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                placeholder={field.placeholder}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                required={field.required}
                rows={3}
                className={`w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors[field.id] ? 'border-red-500' : ''
                }`}
                style={inputStyles}
              />
            )}

            {field.type === 'select' && (
              <select
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                required={field.required}
                className={`w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors[field.id] ? 'border-red-500' : ''
                }`}
                style={inputStyles}
              >
                <option value="">{field.placeholder || 'Select an option'}</option>
                {field.options?.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData[field.id] || false}
                  onChange={(e) => handleInputChange(field.id, e.target.checked)}
                  required={field.required}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{field.label}</span>
              </div>
            )}

            {field.type === 'radio' && (
              <div className="space-y-2">
                {field.options?.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={field.id}
                      value={option}
                      checked={formData[field.id] === option}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      required={field.required}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{option}</span>
                  </div>
                ))}
              </div>
            )}

            {errors[field.id] && (
              <p className="text-red-500 text-sm mt-1">{errors[field.id]}</p>
            )}
          </div>
        ))}

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full font-medium transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={buttonStyles}
        >
          {isSubmitting ? 'Submitting...' : 'Subscribe'}
        </button>

        {/* Privacy notice */}
        <p className="text-xs text-center opacity-75">
          By subscribing, you agree to our privacy policy and terms of service.
        </p>
      </form>

      {/* Custom CSS */}
      {styling.customCss && (
        <style dangerouslySetInnerHTML={{ __html: styling.customCss }} />
      )}
    </div>
  );
}