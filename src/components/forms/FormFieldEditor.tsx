'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormField } from '@/services/form.service';

interface FormFieldEditorProps {
  field: FormField;
  onUpdate: (field: Partial<FormField>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function FormFieldEditor({ field, onUpdate, onDelete, onClose }: FormFieldEditorProps) {
  const [localField, setLocalField] = useState<FormField>(field);

  const handleChange = (key: keyof FormField, value: any) => {
    const updatedField = { ...localField, [key]: value };
    setLocalField(updatedField);
    onUpdate(updatedField);
  };

  const handleValidationChange = (key: string, value: any) => {
    const validation = { ...localField.validation, [key]: value };
    handleChange('validation', validation);
  };

  const handleOptionsChange = (options: string[]) => {
    handleChange('options', options);
  };

  const addOption = () => {
    const options = [...(localField.options || []), ''];
    handleOptionsChange(options);
  };

  const updateOption = (index: number, value: string) => {
    const options = [...(localField.options || [])];
    options[index] = value;
    handleOptionsChange(options);
  };

  const removeOption = (index: number) => {
    const options = [...(localField.options || [])];
    options.splice(index, 1);
    handleOptionsChange(options);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Edit Field</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Field Type */}
        <div>
          <label className="text-sm font-medium text-secondary-700 mb-1 block">
            Field Type
          </label>
          <div className="px-3 py-2 bg-secondary-50 rounded-md text-sm text-secondary-600">
            {localField.type}
          </div>
        </div>

        {/* Label */}
        <Input
          label="Label"
          value={localField.label}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder="Enter field label"
        />

        {/* Placeholder */}
        {['email', 'text', 'textarea', 'select'].includes(localField.type) && (
          <Input
            label="Placeholder"
            value={localField.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            placeholder="Enter placeholder text"
          />
        )}

        {/* Required */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="required"
            checked={localField.required}
            onChange={(e) => handleChange('required', e.target.checked)}
            className="rounded border-secondary-300 text-primary focus:ring-primary"
          />
          <label htmlFor="required" className="text-sm font-medium text-secondary-700">
            Required field
          </label>
        </div>

        {/* Options for select and radio */}
        {['select', 'radio'].includes(localField.type) && (
          <div>
            <label className="text-sm font-medium text-secondary-700 mb-2 block">
              Options
            </label>
            <div className="space-y-2">
              {(localField.options || []).map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    fullWidth
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeOption(index)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addOption}>
                Add Option
              </Button>
            </div>
          </div>
        )}

        {/* Default Value */}
        {!['checkbox', 'radio'].includes(localField.type) && (
          <Input
            label="Default Value"
            value={localField.defaultValue || ''}
            onChange={(e) => handleChange('defaultValue', e.target.value)}
            placeholder="Enter default value"
          />
        )}

        {/* Custom Field Mapping */}
        <Input
          label="Custom Field"
          value={localField.customField || ''}
          onChange={(e) => handleChange('customField', e.target.value)}
          placeholder="Map to subscriber custom field"
          helperText="Optional: Map this field to a subscriber custom field"
        />

        {/* Validation Rules */}
        {['text', 'textarea'].includes(localField.type) && (
          <div>
            <label className="text-sm font-medium text-secondary-700 mb-2 block">
              Validation Rules
            </label>
            <div className="space-y-2">
              <Input
                label="Minimum Length"
                type="number"
                value={localField.validation?.minLength || ''}
                onChange={(e) => handleValidationChange('minLength', parseInt(e.target.value) || undefined)}
                placeholder="0"
              />
              <Input
                label="Maximum Length"
                type="number"
                value={localField.validation?.maxLength || ''}
                onChange={(e) => handleValidationChange('maxLength', parseInt(e.target.value) || undefined)}
                placeholder="100"
              />
              <Input
                label="Pattern (Regex)"
                value={localField.validation?.pattern || ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                placeholder="^[a-zA-Z]+$"
                helperText="Optional regular expression pattern"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-secondary-200">
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 border-red-200 hover:bg-red-50"
            fullWidth
          >
            Delete Field
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}