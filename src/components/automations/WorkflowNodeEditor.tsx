'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  WorkflowNode,
  WorkflowNodeType,
  TriggerConfiguration,
  ActionConfiguration,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Form } from '@/components/ui/Form';

export interface WorkflowNodeEditorProps {
  /**
   * The node to edit
   */
  node: WorkflowNode;
  
  /**
   * Available trigger configurations
   */
  triggerConfigurations: TriggerConfiguration[];
  
  /**
   * Available action configurations
   */
  actionConfigurations: ActionConfiguration[];
  
  /**
   * Callback when the node is updated
   */
  onUpdate: (node: WorkflowNode) => void;
  
  /**
   * Callback when the editor is closed
   */
  onClose: () => void;
  
  /**
   * Whether the editor is in read-only mode
   */
  readOnly?: boolean;
}

/**
 * Node editor component for configuring workflow nodes
 */
export function WorkflowNodeEditor({
  node,
  triggerConfigurations,
  actionConfigurations,
  onUpdate,
  onClose,
  readOnly = false,
}: WorkflowNodeEditorProps) {
  const [formData, setFormData] = useState(node.data.config);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);

  // Get configuration for the current node
  const getNodeConfiguration = () => {
    if (node.type === WorkflowNodeType.TRIGGER) {
      return triggerConfigurations.find(config => 
        config.type === node.data.config.triggerType || 
        config.name === node.data.label
      );
    } else {
      return actionConfigurations.find(config => 
        config.type === node.data.config.actionType || 
        config.name === node.data.label
      );
    }
  };

  const configuration = getNodeConfiguration();

  // Validate form data
  const validateForm = () => {
    if (!configuration) return false;
    
    const newErrors: Record<string, string> = {};
    let valid = true;

    for (const field of configuration.config.fields) {
      const value = formData[field.key];
      
      if (field.required && (!value || value === '')) {
        newErrors[field.key] = `${field.label} is required`;
        valid = false;
      }
      
      // Type-specific validation
      if (value && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.key] = 'Please enter a valid email address';
          valid = false;
        }
      }
      
      if (value && field.type === 'number') {
        if (isNaN(Number(value))) {
          newErrors[field.key] = 'Please enter a valid number';
          valid = false;
        }
      }
    }

    setErrors(newErrors);
    setIsValid(valid);
    return valid;
  };

  // Handle form field change
  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Handle form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm() || readOnly) return;

    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...node.data,
        config: formData,
        isValid: true,
        errors: [],
      },
    };

    onUpdate(updatedNode);
    onClose();
  };

  // Validate on form data change
  useEffect(() => {
    validateForm();
  }, [formData, configuration]);

  // Render form field based on type
  const renderField = (field: any) => {
    const value = formData[field.key] || '';
    const error = errors[field.key];

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            error={error}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
            placeholder={field.placeholder}
            disabled={readOnly}
            error={error}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={readOnly}
            className={cn(
              'w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm',
              'focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
              readOnly && 'bg-secondary-50 cursor-not-allowed'
            )}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              disabled={readOnly}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-secondary-700">Enable {field.label}</span>
          </label>
        );

      case 'date':
        return (
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={readOnly}
            error={error}
          />
        );

      case 'template':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={readOnly}
            className={cn(
              'w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm',
              'focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
              readOnly && 'bg-secondary-50 cursor-not-allowed'
            )}
          >
            <option value="">Select Template</option>
            {/* TODO: Load actual templates */}
            <option value="welcome">Welcome Email</option>
            <option value="newsletter">Newsletter</option>
            <option value="promotion">Promotion</option>
          </select>
        );

      case 'list':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={readOnly}
            className={cn(
              'w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm',
              'focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
              readOnly && 'bg-secondary-50 cursor-not-allowed'
            )}
          >
            <option value="">Select List</option>
            {/* TODO: Load actual lists */}
            <option value="subscribers">All Subscribers</option>
            <option value="newsletter">Newsletter Subscribers</option>
            <option value="customers">Customers</option>
          </select>
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            error={error}
          />
        );
    }
  };

  if (!configuration) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-secondary-900 mb-2">
          Configuration Not Found
        </h3>
        <p className="text-secondary-600">
          Unable to find configuration for this node type.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-2xl">{
            node.type === WorkflowNodeType.TRIGGER 
              ? (configuration as TriggerConfiguration).icon
              : (configuration as ActionConfiguration).icon
          }</span>
          <div>
            <h3 className="text-lg font-semibold text-secondary-900">
              {configuration.name}
            </h3>
            <p className="text-sm text-secondary-600">
              {configuration.description}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {configuration.config.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {renderField(field)}
            
            {field.description && (
              <p className="mt-1 text-xs text-secondary-500">
                {field.description}
              </p>
            )}
            
            {errors[field.key] && (
              <p className="mt-1 text-xs text-red-600">
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-secondary-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          
          {!readOnly && (
            <Button
              type="submit"
              disabled={!isValid}
            >
              Save Configuration
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}