'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PublicFormRenderer } from '@/components/forms/PublicFormRenderer';
import { FormField, FormStyling, FormSettings } from '@/services/form.service';

interface PublicFormData {
  id: string;
  name: string;
  formType: string;
  fields: FormField[];
  styling: FormStyling;
  settings: FormSettings;
}

export default function PublicFormPage() {
  const params = useParams();
  const formId = params.id as string;
  
  const [formData, setFormData] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFormData();
  }, [formId]);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/forms/${formId}/public`);
      
      if (!response.ok) {
        throw new Error('Form not found or not published');
      }
      
      const data = await response.json();
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Available</h1>
          <p className="text-gray-600">{error || 'This form could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  const backgroundStyle = {
    backgroundColor: formData.styling?.backgroundColor || '#f9fafb',
    minHeight: '100vh',
    padding: '2rem',
    fontFamily: formData.styling?.fontFamily || 'Inter, sans-serif',
  };

  return (
    <div style={backgroundStyle}>
      <div className="max-w-md mx-auto">
        {/* Form Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {formData.name}
          </h1>
          <p className="text-gray-600">
            Please fill out the form below to subscribe.
          </p>
        </div>

        {/* Form */}
        <PublicFormRenderer
          formId={formData.id}
          fields={formData.fields}
          styling={formData.styling}
          settings={formData.settings}
        />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            Powered by{' '}
            <a 
              href="https://jetmail.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              JetMail
            </a>
          </p>
        </div>
      </div>

      {/* Custom CSS */}
      {formData.styling?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: formData.styling.customCss }} />
      )}
    </div>
  );
}