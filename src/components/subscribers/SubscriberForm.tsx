'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Form } from '@/components/ui/Form'
import { SubscriberStatus, type SubscriberWithDetails } from '@/types'

interface SubscriberFormProps {
  initialData?: Partial<SubscriberWithDetails>
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

export function SubscriberForm({ initialData, onSubmit, onCancel }: SubscriberFormProps) {
  const [formData, setFormData] = useState({
    email: initialData?.email || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    status: initialData?.status || SubscriberStatus.ACTIVE,
    customFields: initialData?.customFields || {}
  })
  const [customFieldKey, setCustomFieldKey] = useState('')
  const [customFieldValue, setCustomFieldValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const addCustomField = () => {
    if (!customFieldKey.trim() || !customFieldValue.trim()) return

    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [customFieldKey]: customFieldValue
      }
    }))
    setCustomFieldKey('')
    setCustomFieldValue('')
  }

  const removeCustomField = (key: string) => {
    setFormData(prev => {
      const newCustomFields = { ...prev.customFields }
      delete newCustomFields[key]
      return { ...prev, customFields: newCustomFields }
    })
  }

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={errors.email}
            placeholder="subscriber@example.com"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value as SubscriberStatus)}
          >
            <option value={SubscriberStatus.ACTIVE}>Active</option>
            <option value={SubscriberStatus.UNSUBSCRIBED}>Unsubscribed</option>
            <option value={SubscriberStatus.BOUNCED}>Bounced</option>
            <option value={SubscriberStatus.COMPLAINED}>Complained</option>
            <option value={SubscriberStatus.INVALID}>Invalid</option>
          </select>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Custom Fields</h3>
        
        {/* Existing Custom Fields */}
        {Object.entries(formData.customFields).length > 0 && (
          <div className="space-y-2">
            {Object.entries(formData.customFields).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <div className="flex-1">
                  <span className="font-medium text-sm text-gray-700">{key}:</span>
                  <span className="ml-2 text-sm text-gray-600">{String(value)}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField(key)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Custom Field */}
        <div className="flex gap-2">
          <Input
            placeholder="Field name"
            value={customFieldKey}
            onChange={(e) => setCustomFieldKey(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Field value"
            value={customFieldValue}
            onChange={(e) => setCustomFieldValue(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomField}
            disabled={!customFieldKey.trim() || !customFieldValue.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
        >
          {initialData ? 'Update Subscriber' : 'Create Subscriber'}
        </Button>
      </div>
    </Form>
  )
}