'use client';

import React, { useState } from 'react';
import { 
  TicketPriority, 
  TicketCategory,
  SlaLevel,
  TicketSource 
} from '@/generated/prisma';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CreateTicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateTicketData {
  subject: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  language: string;
  requesterEmail: string;
  requesterName: string;
  assignedCompany: string;
  tags: string[];
  slaLevel: SlaLevel;
  source: TicketSource;
}

export function CreateTicketForm({ isOpen, onClose, onSuccess }: CreateTicketFormProps) {
  const [formData, setFormData] = useState<CreateTicketData>({
    subject: '',
    description: '',
    priority: TicketPriority.MEDIUM,
    category: TicketCategory.GENERAL,
    language: 'en',
    requesterEmail: '',
    requesterName: '',
    assignedCompany: '',
    tags: [],
    slaLevel: SlaLevel.STANDARD,
    source: TicketSource.WEB,
  });
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof CreateTicketData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.requesterEmail.trim()) {
      newErrors.requesterEmail = 'Requester email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.requesterEmail)) {
      newErrors.requesterEmail = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          customFields: {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket');
      }

      // Reset form
      setFormData({
        subject: '',
        description: '',
        priority: TicketPriority.MEDIUM,
        category: TicketCategory.GENERAL,
        language: 'en',
        requesterEmail: '',
        requesterName: '',
        assignedCompany: '',
        tags: [],
        slaLevel: SlaLevel.STANDARD,
        source: TicketSource.WEB,
      });
      setTagInput('');
      setErrors({});
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create ticket' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Create New Support Ticket
          </h2>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <Input
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Brief description of the issue"
                error={errors.subject}
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Detailed description of the issue"
                rows={4}
                className={`w-full border rounded-md px-3 py-2 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={submitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value as TicketPriority)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  {Object.values(TicketPriority).map(priority => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value as TicketCategory)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  {Object.values(TicketCategory).map(category => (
                    <option key={category} value={category}>
                      {category.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Requester Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Requester Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.requesterEmail}
                  onChange={(e) => handleInputChange('requesterEmail', e.target.value)}
                  placeholder="requester@example.com"
                  error={errors.requesterEmail}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <Input
                  value={formData.requesterName}
                  onChange={(e) => handleInputChange('requesterName', e.target.value)}
                  placeholder="Requester's full name"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Assignment and Classification */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Assignment & Classification</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assigned Company
                </label>
                <Input
                  value={formData.assignedCompany}
                  onChange={(e) => handleInputChange('assignedCompany', e.target.value)}
                  placeholder="Company name for routing"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SLA Level
                </label>
                <select
                  value={formData.slaLevel}
                  onChange={(e) => handleInputChange('slaLevel', e.target.value as SlaLevel)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting}
                >
                  {Object.values(SlaLevel).map(level => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={submitting}
                >
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 text-sm rounded-md"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-primary-600 hover:text-primary-800"
                        disabled={submitting}
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}