'use client';

import React, { useState, useCallback } from 'react';
import { DragDrop, DraggableItem } from '@/components/ui/DragDrop';
import { Button } from '@/components/ui/Button';
import { FormField, FormStyling, FormSettings } from '@/services/form.service';
import { FormFieldEditor } from './FormFieldEditor';
import { FormStyleEditor } from './FormStyleEditor';
import { FormSettingsEditor } from './FormSettingsEditor';
import { FormPreview } from './FormPreview';

interface FormBuilderProps {
  initialFields?: FormField[];
  initialStyling?: FormStyling;
  initialSettings?: FormSettings;
  onSave: (data: {
    fields: FormField[];
    styling: FormStyling;
    settings: FormSettings;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const AVAILABLE_FIELD_TYPES: DraggableItem[] = [
  {
    id: 'email',
    type: 'Email Field',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
        </svg>
        <span>Email Field</span>
      </div>
    ),
    data: {
      type: 'email',
      label: 'Email Address',
      placeholder: 'Enter your email',
      required: true,
    },
  },
  {
    id: 'text',
    type: 'Text Field',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <span>Text Field</span>
      </div>
    ),
    data: {
      type: 'text',
      label: 'Text Field',
      placeholder: 'Enter text',
      required: false,
    },
  },
  {
    id: 'textarea',
    type: 'Textarea',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Textarea</span>
      </div>
    ),
    data: {
      type: 'textarea',
      label: 'Message',
      placeholder: 'Enter your message',
      required: false,
    },
  },
  {
    id: 'select',
    type: 'Select Dropdown',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
        <span>Select Dropdown</span>
      </div>
    ),
    data: {
      type: 'select',
      label: 'Select Option',
      placeholder: 'Choose an option',
      required: false,
      options: ['Option 1', 'Option 2', 'Option 3'],
    },
  },
  {
    id: 'checkbox',
    type: 'Checkbox',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Checkbox</span>
      </div>
    ),
    data: {
      type: 'checkbox',
      label: 'I agree to the terms',
      required: false,
    },
  },
  {
    id: 'radio',
    type: 'Radio Buttons',
    content: (
      <div className="flex items-center space-x-2">
        <svg className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
        <span>Radio Buttons</span>
      </div>
    ),
    data: {
      type: 'radio',
      label: 'Choose Option',
      required: false,
      options: ['Option 1', 'Option 2', 'Option 3'],
    },
  },
];

export function FormBuilder({
  initialFields = [],
  initialStyling,
  initialSettings,
  onSave,
  onCancel,
  isLoading = false,
}: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'style' | 'settings' | 'preview'>('fields');
  const [styling, setStyling] = useState<FormStyling>(
    initialStyling || {
      theme: 'light',
      primaryColor: '#1E40AF',
      backgroundColor: '#FFFFFF',
      textColor: '#374151',
      borderColor: '#D1D5DB',
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      buttonStyle: {
        backgroundColor: '#1E40AF',
        textColor: '#FFFFFF',
        borderRadius: 6,
        padding: '12px 24px',
      },
    }
  );
  const [settings, setSettings] = useState<FormSettings>(
    initialSettings || {
      showThankYouMessage: true,
      thankYouMessage: 'Thank you for subscribing!',
      enableDoubleOptIn: false,
      sendWelcomeEmail: false,
      allowDuplicates: false,
      requireEmailConfirmation: false,
    }
  );

  // Convert fields to draggable items
  const placedItems: DraggableItem[] = fields.map(field => ({
    id: field.id,
    type: field.type,
    content: (
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{field.label}</div>
          <div className="text-sm text-secondary-500">
            {field.type} {field.required && '(Required)'}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedFieldId(field.id)}
        >
          Edit
        </Button>
      </div>
    ),
    data: field,
  }));

  const handleFieldsChange = useCallback((items: DraggableItem[]) => {
    const newFields: FormField[] = items.map((item, index) => {
      const existingField = fields.find(f => f.id === item.id);
      if (existingField) {
        return existingField;
      }

      // Create new field from dragged item
      return {
        id: `field_${Date.now()}_${index}`,
        type: item.data?.type || 'text',
        label: item.data?.label || 'Untitled Field',
        placeholder: item.data?.placeholder,
        required: item.data?.required || false,
        options: item.data?.options,
        validation: item.data?.validation,
        defaultValue: item.data?.defaultValue,
        customField: item.data?.customField,
      };
    });

    setFields(newFields);
  }, [fields]);

  const handleFieldUpdate = useCallback((fieldId: string, updatedField: Partial<FormField>) => {
    setFields(prev => prev.map(field =>
      field.id === fieldId ? { ...field, ...updatedField } : field
    ));
    setSelectedFieldId(null);
  }, []);

  const handleFieldDelete = useCallback((fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
    setSelectedFieldId(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      fields,
      styling,
      settings,
    });
  }, [fields, styling, settings, onSave]);

  const selectedField = selectedFieldId ? fields.find(f => f.id === selectedFieldId) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-secondary-900">Form Builder</h2>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isLoading}>
              Save Form
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4">
          {[
            { id: 'fields', label: 'Fields' },
            { id: 'style', label: 'Style' },
            { id: 'settings', label: 'Settings' },
            { id: 'preview', label: 'Preview' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
                }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'fields' && (
          <div className="h-full flex">
            <div className="flex-1 p-4">
              <DragDrop
                availableItems={AVAILABLE_FIELD_TYPES}
                placedItems={placedItems}
                onItemsChange={handleFieldsChange}
                allowReordering={true}
              />
            </div>

            {/* Field Editor Sidebar */}
            {selectedField && (
              <div className="w-80 border-l border-secondary-200 p-4 overflow-y-auto">
                <FormFieldEditor
                  field={selectedField}
                  onUpdate={(updatedField) => handleFieldUpdate(selectedField.id, updatedField)}
                  onDelete={() => handleFieldDelete(selectedField.id)}
                  onClose={() => setSelectedFieldId(null)}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'style' && (
          <div className="h-full p-4 overflow-y-auto">
            <FormStyleEditor
              styling={styling}
              onUpdate={setStyling}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full p-4 overflow-y-auto">
            <FormSettingsEditor
              settings={settings}
              onUpdate={setSettings}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="h-full p-4 overflow-y-auto">
            <FormPreview
              fields={fields}
              styling={styling}
              settings={settings}
            />
          </div>
        )}
      </div>
    </div>
  );
}