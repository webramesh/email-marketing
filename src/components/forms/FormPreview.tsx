'use client';

import React, { useState } from 'react';
import { FormField, FormStyling, FormSettings } from '@/services/form.service';

interface FormPreviewProps {
  fields: FormField[];
  styling: FormStyling;
  settings: FormSettings;
}

export function FormPreview({ fields, styling, settings }: FormPreviewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({});
    }, 3000);
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
      <div className="mb-4 text-center">
        <h3 className="text-lg font-medium text-secondary-900 mb-2">Form Preview</h3>
        <p className="text-sm text-secondary-500">
          This is how your form will appear to visitors
        </p>
      </div>

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
                className="w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={inputStyles}
              />
            )}

            {field.type === 'select' && (
              <select
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                required={field.required}
                className="w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
        ))}

        <button
          type="submit"
          className="w-full font-medium transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          style={buttonStyles}
        >
          Subscribe
        </button>

        {/* Privacy notice */}
        <p className="text-xs text-center opacity-75">
          By subscribing, you agree to our privacy policy and terms of service.
        </p>
      </form>

      {/* Custom CSS Preview */}
      {styling.customCss && (
        <style dangerouslySetInnerHTML={{ __html: styling.customCss }} />
      )}
    </div>
  );
}