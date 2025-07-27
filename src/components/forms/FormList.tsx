'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { FormBuilder } from './FormBuilder';
import { FormField, FormStyling, FormSettings } from '@/services/form.service';

interface Form {
  id: string;
  name: string;
  description?: string;
  formType: 'SUBSCRIPTION' | 'POPUP' | 'EMBEDDED' | 'LANDING_PAGE';
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  totalViews: number;
  totalSubmissions: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  embedCode?: string;
  fields?: any;
  styling?: any;
  settings?: any;
  _count: {
    submissions: number;
  };
}

interface FormListProps {
  onCreateForm?: () => void;
}

export function FormList({ onCreateForm }: FormListProps) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [duplicatingForm, setDuplicatingForm] = useState<Form | null>(null);
  const [newFormName, setNewFormName] = useState('');

  useEffect(() => {
    fetchForms();
  }, [filterType, filterStatus]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('formType', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/forms?${params}`);
      if (response.ok) {
        const data = await response.json();
        setForms(data.forms);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForm = () => {
    setEditingForm(null);
    setShowBuilder(true);
    onCreateForm?.();
  };

  const handleEditForm = (form: Form) => {
    setEditingForm(form);
    setShowBuilder(true);
  };

  const handleSaveForm = async (data: {
    fields: FormField[];
    styling: FormStyling;
    settings: FormSettings;
  }) => {
    try {
      const formData = {
        name: editingForm?.name || 'New Form',
        formType: editingForm?.formType || 'SUBSCRIPTION',
        ...data,
      };

      const url = editingForm ? `/api/forms/${editingForm.id}` : '/api/forms';
      const method = editingForm ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowBuilder(false);
        setEditingForm(null);
        fetchForms();
      }
    } catch (error) {
      console.error('Error saving form:', error);
    }
  };

  const handlePublishForm = async (formId: string) => {
    try {
      const response = await fetch(`/api/forms/${formId}/publish`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchForms();
      }
    } catch (error) {
      console.error('Error publishing form:', error);
    }
  };

  const handleDuplicateForm = async () => {
    if (!duplicatingForm || !newFormName) return;

    try {
      const response = await fetch(`/api/forms/${duplicatingForm.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFormName }),
      });

      if (response.ok) {
        setDuplicatingForm(null);
        setNewFormName('');
        fetchForms();
      }
    } catch (error) {
      console.error('Error duplicating form:', error);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form?')) return;

    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchForms();
      }
    } catch (error) {
      console.error('Error deleting form:', error);
    }
  };

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'ARCHIVED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SUBSCRIPTION': return 'bg-blue-100 text-blue-800';
      case 'POPUP': return 'bg-purple-100 text-purple-800';
      case 'EMBEDDED': return 'bg-green-100 text-green-800';
      case 'LANDING_PAGE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (showBuilder) {
    return (
      <FormBuilder
        formId={editingForm?.id}
        tenantId={editingForm?.tenantId}
        formType={editingForm?.formType}
        embedCode={editingForm?.embedCode}
        initialFields={editingForm?.fields as FormField[] || []}
        initialStyling={editingForm?.styling as FormStyling}
        initialSettings={editingForm?.settings as FormSettings}
        onSave={handleSaveForm}
        onCancel={() => {
          setShowBuilder(false);
          setEditingForm(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Forms</h1>
          <p className="text-secondary-600">Create and manage subscription forms</p>
        </div>
        <Button onClick={handleCreateForm}>
          Create Form
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <Input
          placeholder="Search forms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Types</option>
          <option value="SUBSCRIPTION">Subscription</option>
          <option value="POPUP">Popup</option>
          <option value="EMBEDDED">Embedded</option>
          <option value="LANDING_PAGE">Landing Page</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Forms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-secondary-200 rounded w-3/4"></div>
                <div className="h-3 bg-secondary-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-secondary-200 rounded"></div>
                  <div className="h-3 bg-secondary-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <Card key={form.id} variant="bordered">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{form.name}</CardTitle>
                    {form.description && (
                      <p className="text-sm text-secondary-500 mt-1">
                        {form.description}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Badge className={getStatusColor(form.status)}>
                      {form.status}
                    </Badge>
                    <Badge className={getTypeColor(form.formType)}>
                      {form.formType.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-secondary-900">
                        {form.totalViews.toLocaleString()}
                      </div>
                      <div className="text-xs text-secondary-500">Views</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-secondary-900">
                        {form.totalSubmissions.toLocaleString()}
                      </div>
                      <div className="text-xs text-secondary-500">Submissions</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-secondary-900">
                        {form.conversionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-secondary-500">Conversion</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-secondary-200">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditForm(form)}
                      >
                        Edit
                      </Button>
                      {form.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => handlePublishForm(form.id)}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDuplicatingForm(form);
                          setNewFormName(`${form.name} (Copy)`);
                        }}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteForm(form.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredForms.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-secondary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-secondary-900">No forms found</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Get started by creating your first form.
          </p>
          <div className="mt-6">
            <Button onClick={handleCreateForm}>
              Create Form
            </Button>
          </div>
        </div>
      )}

      {/* Duplicate Form Modal */}
      <Modal
        isOpen={!!duplicatingForm}
        onClose={() => {
          setDuplicatingForm(null);
          setNewFormName('');
        }}
        title="Duplicate Form"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            Create a copy of "{duplicatingForm?.name}" with a new name.
          </p>
          <Input
            label="Form Name"
            value={newFormName}
            onChange={(e) => setNewFormName(e.target.value)}
            placeholder="Enter form name"
            fullWidth
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDuplicatingForm(null);
                setNewFormName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateForm}
              disabled={!newFormName.trim()}
            >
              Duplicate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}