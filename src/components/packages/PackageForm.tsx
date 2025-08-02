'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, DollarSign, Users, Mail, Zap } from 'lucide-react';

const packageSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  description: z.string().optional(),
  shortDescription: z.string().max(200, 'Short description must be under 200 characters').optional(),
  category: z.enum(['EMAIL_MARKETING', 'AUTOMATION', 'ANALYTICS', 'INTEGRATIONS', 'TEMPLATES', 'CUSTOM']),
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().default('USD'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']),
  setupFee: z.number().min(0).optional(),
  trialDays: z.number().min(0).optional(),
  isPublic: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  platformCommission: z.number().min(0).max(100).default(10),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

type PackageFormData = z.infer<typeof packageSchema>;

interface Package {
  id: string;
  name: string;
  description?: string;
  shortDescription?: string;
  category: string;
  price: number;
  currency: string;
  billingCycle: string;
  setupFee?: number;
  trialDays?: number;
  features: Record<string, any>;
  quotas: Record<string, any>;
  isPublic: boolean;
  isFeatured: boolean;
  platformCommission: number;
  images?: string[];
  tags?: string[];
  highlights?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

interface PackageFormProps {
  package?: Package;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PackageForm({ package: existingPackage, onSuccess, onCancel }: PackageFormProps) {
  const [features, setFeatures] = useState<Record<string, boolean>>(
    existingPackage?.features || {
      emailCampaigns: true,
      automation: false,
      analytics: false,
      apiAccess: false,
      customDomains: false,
      prioritySupport: false,
    }
  );
  
  const [quotas, setQuotas] = useState<Record<string, number>>(
    existingPackage?.quotas || {
      emailsPerMonth: 10000,
      subscribers: 1000,
      campaigns: 10,
      automations: 5,
    }
  );
  
  const [tags, setTags] = useState<string[]>(existingPackage?.tags || []);
  const [highlights, setHighlights] = useState<string[]>(existingPackage?.highlights || []);
  const [newTag, setNewTag] = useState('');
  const [newHighlight, setNewHighlight] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(packageSchema),
    defaultValues: existingPackage ? {
      name: existingPackage.name,
      description: existingPackage.description,
      shortDescription: existingPackage.shortDescription,
      category: existingPackage.category as any,
      price: existingPackage.price,
      currency: existingPackage.currency,
      billingCycle: existingPackage.billingCycle as any,
      setupFee: existingPackage.setupFee,
      trialDays: existingPackage.trialDays,
      isPublic: existingPackage.isPublic,
      isFeatured: existingPackage.isFeatured,
      platformCommission: existingPackage.platformCommission,
      metaTitle: existingPackage.metaTitle,
      metaDescription: existingPackage.metaDescription,
    } : {
      currency: 'USD',
      billingCycle: 'MONTHLY',
      platformCommission: 10,
      isPublic: false,
      isFeatured: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const payload = {
        ...data,
        features,
        quotas,
        tags,
        highlights,
      };

      const url = existingPackage 
        ? `/api/packages/${existingPackage.id}`
        : '/api/packages';
      
      const method = existingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save package');
      }

      return response.json();
    },
    onSuccess,
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const addHighlight = () => {
    if (newHighlight.trim() && !highlights.includes(newHighlight.trim())) {
      setHighlights([...highlights, newHighlight.trim()]);
      setNewHighlight('');
    }
  };

  const removeHighlight = (highlightToRemove: string) => {
    setHighlights(highlights.filter(highlight => highlight !== highlightToRemove));
  };

  const toggleFeature = (feature: string) => {
    setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  const updateQuota = (quota: string, value: number) => {
    setQuotas(prev => ({ ...prev, [quota]: value }));
  };

  const platformCommission = watch('platformCommission');
  const price = watch('price');
  const creatorRevenue = price ? (price * (100 - (platformCommission || 10))) / 100 : 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Package Name *
            </label>
            <Input
              {...register('name')}
              placeholder="Enter package name"
              error={errors.name?.message}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              {...register('category')}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="EMAIL_MARKETING">Email Marketing</option>
              <option value="AUTOMATION">Automation</option>
              <option value="ANALYTICS">Analytics</option>
              <option value="INTEGRATIONS">Integrations</option>
              <option value="TEMPLATES">Templates</option>
              <option value="CUSTOM">Custom</option>
            </select>
            {errors.category && (
              <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Description
          </label>
          <Input
            {...register('shortDescription')}
            placeholder="Brief description for marketplace listing"
            error={errors.shortDescription?.message}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Description
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder="Detailed description of your package"
          />
        </div>
      </Card>

      {/* Pricing */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price *
            </label>
            <Input
              type="number"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              placeholder="0.00"
              error={errors.price?.message}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              {...register('currency')}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Cycle
            </label>
            <select
              {...register('billingCycle')}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
              <option value="ONE_TIME">One-time</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setup Fee
            </label>
            <Input
              type="number"
              step="0.01"
              {...register('setupFee', { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trial Days
            </label>
            <Input
              type="number"
              {...register('trialDays', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Platform Commission (%)
            </label>
            <Input
              type="number"
              step="0.1"
              {...register('platformCommission', { valueAsNumber: true })}
              placeholder="10"
              error={errors.platformCommission?.message}
            />
          </div>
        </div>

        {/* Revenue Breakdown */}
        {price && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Revenue Breakdown</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Price:</span>
                <div className="font-medium">${price.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-600">Platform Fee:</span>
                <div className="font-medium text-red-600">
                  -${((price * (platformCommission || 10)) / 100).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Your Revenue:</span>
                <div className="font-medium text-green-600">${creatorRevenue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Features */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {feature === 'emailCampaigns' && <Mail className="w-4 h-4 text-blue-500" />}
                {feature === 'automation' && <Zap className="w-4 h-4 text-purple-500" />}
                {feature === 'analytics' && <DollarSign className="w-4 h-4 text-green-500" />}
                {feature === 'apiAccess' && <Users className="w-4 h-4 text-orange-500" />}
                <span className="font-medium">
                  {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFeature(feature)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Quotas */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Limits</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(quotas).map(([quota, value]) => (
            <div key={quota}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {quota.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
              <Input
                type="number"
                value={value}
                onChange={(e) => updateQuota(quota, parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Tags */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" onClick={addTag} variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Highlights */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Highlights</h3>
        
        <div className="space-y-2 mb-3">
          {highlights.map((highlight, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">{highlight}</span>
              <button
                type="button"
                onClick={() => removeHighlight(highlight)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Input
            value={newHighlight}
            onChange={(e) => setNewHighlight(e.target.value)}
            placeholder="Add a key selling point"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
          />
          <Button type="button" onClick={addHighlight} variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Public Package</label>
              <p className="text-sm text-gray-600">Make this package visible in the marketplace</p>
            </div>
            <input
              type="checkbox"
              {...register('isPublic')}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Featured Package</label>
              <p className="text-sm text-gray-600">Highlight this package in the marketplace</p>
            </div>
            <input
              type="checkbox"
              {...register('isFeatured')}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
        </div>
      </Card>

      {/* SEO */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">SEO Settings</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Title
            </label>
            <Input
              {...register('metaTitle')}
              placeholder="SEO title for search engines"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
            </label>
            <textarea
              {...register('metaDescription')}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="SEO description for search engines"
            />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : existingPackage ? 'Update Package' : 'Create Package'}
        </Button>
      </div>

      {mutation.error && (
        <div className="text-red-600 text-sm">
          {mutation.error instanceof Error ? mutation.error.message : 'An error occurred'}
        </div>
      )}
    </form>
  );
}