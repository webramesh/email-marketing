'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Dropdown } from '@/components/ui/Dropdown'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { DragDrop } from '@/components/ui/DragDrop'
import { 
  SegmentCondition, 
  SegmentConditions, 
  SegmentField, 
  CreateSegmentData,
  UpdateSegmentData 
} from '@/services/segment.service'

interface SegmentBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateSegmentData | UpdateSegmentData) => Promise<void>
  initialData?: {
    id?: string
    name: string
    description?: string
    conditions: SegmentConditions
  }
  fields: SegmentField[]
  onPreview?: (conditions: SegmentConditions) => Promise<{ count: number; sampleSubscribers: any[] }>
}

interface ConditionBuilderProps {
  condition: SegmentCondition
  fields: SegmentField[]
  onChange: (condition: SegmentCondition) => void
  onRemove: () => void
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  condition,
  fields,
  onChange,
  onRemove
}) => {
  const selectedField = fields.find(f => f.key === condition.field)
  
  const handleFieldChange = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey)
    if (field) {
      onChange({
        ...condition,
        field: fieldKey,
        operator: field.operators[0] as any,
        value: undefined,
        secondValue: undefined
      })
    }
  }

  const handleOperatorChange = (operator: string) => {
    onChange({
      ...condition,
      operator: operator as any,
      value: condition.value,
      secondValue: operator === 'between' || operator === 'not_between' ? condition.secondValue : undefined
    })
  }

  const renderValueInput = () => {
    if (!selectedField) return null

    const needsSecondValue = condition.operator === 'between' || condition.operator === 'not_between'
    const isEmptyOperator = condition.operator === 'is_empty' || condition.operator === 'is_not_empty'

    if (isEmptyOperator) {
      return null
    }

    if (selectedField.type === 'enum' && selectedField.options) {
      const isMultiSelect = condition.operator === 'in' || condition.operator === 'not_in'
      
      if (isMultiSelect) {
        // For multi-select, use a text input with comma-separated values
        const displayValue = Array.isArray(condition.value) 
          ? condition.value.map(v => selectedField.options?.find(opt => opt.value === v)?.label || v).join(', ')
          : ''
        
        return (
          <div className="flex gap-2">
            <Input
              value={displayValue}
              onChange={(e) => {
                const labels = e.target.value.split(',').map(v => v.trim()).filter(v => v)
                const values = labels.map(label => {
                  const option = selectedField.options?.find(opt => opt.label === label)
                  return option ? option.value : label
                })
                onChange({ ...condition, value: values })
              }}
              placeholder="Enter values separated by commas"
            />
          </div>
        )
      }

      return (
        <div className="flex gap-2">
          <Dropdown
            items={selectedField.options?.map(opt => ({ value: opt.value, label: opt.label }))}
            value={condition.value}
            onChange={(value) => onChange({ ...condition, value })}
            placeholder="Select value"
          />
        </div>
      )
    }

    if (selectedField.type === 'date') {
      return (
        <div className="flex gap-2">
          <Input
            type="date"
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Select date"
          />
          {needsSecondValue && (
            <Input
              type="date"
              value={condition.secondValue || ''}
              onChange={(e) => onChange({ ...condition, secondValue: e.target.value })}
              placeholder="End date"
            />
          )}
        </div>
      )
    }

    if (selectedField.type === 'number') {
      return (
        <div className="flex gap-2">
          <Input
            type="number"
            value={condition.value || ''}
            onChange={(e) => onChange({ ...condition, value: parseFloat(e.target.value) || e.target.value })}
            placeholder="Enter number"
          />
          {needsSecondValue && (
            <Input
              type="number"
              value={condition.secondValue || ''}
              onChange={(e) => onChange({ ...condition, secondValue: parseFloat(e.target.value) || e.target.value })}
              placeholder="End number"
            />
          )}
        </div>
      )
    }

    // Default to string input
    const isMultiValue = condition.operator === 'in' || condition.operator === 'not_in'
    
    if (isMultiValue) {
      return (
        <Input
          value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value || ''}
          onChange={(e) => {
            const values = e.target.value.split(',').map(v => v.trim()).filter(v => v)
            onChange({ ...condition, value: values })
          }}
          placeholder="Enter values separated by commas"
        />
      )
    }

    return (
      <div className="flex gap-2">
        <Input
          value={condition.value || ''}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Enter value"
        />
        {needsSecondValue && (
          <Input
            value={condition.secondValue || ''}
            onChange={(e) => onChange({ ...condition, secondValue: e.target.value })}
            placeholder="End value"
          />
        )}
      </div>
    )
  }

  return (
    <Card className="p-4 border border-gray-200">
      <div className="flex items-center gap-3 flex-wrap">
        <Dropdown
          items={fields.map(f => ({ value: f.key, label: f.label }))}
          value={condition.field}
          onChange={handleFieldChange}
          placeholder="Select field"
          className="min-w-[150px]"
        />
        
        {selectedField && (
          <Dropdown
            items={selectedField.operators.map(op => ({ 
              value: op, 
              label: op.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            }))}
            value={condition.operator}
            onChange={handleOperatorChange}
            placeholder="Select operator"
            className="min-w-[120px]"
          />
        )}
        
        <div className="flex-1 min-w-[200px]">
          {renderValueInput()}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Remove
        </Button>
      </div>
    </Card>
  )
}

export const SegmentBuilder: React.FC<SegmentBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  fields,
  onPreview
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [conditions, setConditions] = useState<SegmentConditions>(
    initialData?.conditions || {
      operator: 'AND',
      rules: []
    }
  )
  const [previewData, setPreviewData] = useState<{ count: number; sampleSubscribers: any[] } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const addCondition = () => {
    const newCondition: SegmentCondition = {
      id: generateId(),
      field: fields[0]?.key || '',
      operator: fields[0]?.operators[0] as any || 'equals',
      value: undefined
    }

    setConditions(prev => ({
      ...prev,
      rules: [...prev.rules, newCondition]
    }))
  }

  const updateCondition = (index: number, condition: SegmentCondition) => {
    setConditions(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => i === index ? condition : rule)
    }))
  }

  const removeCondition = (index: number) => {
    setConditions(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }))
  }

  const handlePreview = async () => {
    if (!onPreview || conditions.rules.length === 0) return

    setIsPreviewLoading(true)
    try {
      const result = await onPreview(conditions)
      setPreviewData(result)
    } catch (error) {
      console.error('Error previewing segment:', error)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || conditions.rules.length === 0) return

    setIsLoading(true)
    try {
      const data = initialData?.id 
        ? { name, description, conditions }
        : { name, description, conditions }
      
      await onSave(data)
      onClose()
    } catch (error) {
      console.error('Error saving segment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isValid = name.trim() && conditions.rules.length > 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? 'Edit Segment' : 'Create Segment'} size="lg">
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Segment Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter segment name"
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter segment description (optional)"
              className="w-full"
            />
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Conditions</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Match</span>
              <Dropdown
                items={[
                  { value: 'AND', label: 'All conditions' },
                  { value: 'OR', label: 'Any condition' }
                ]}
                value={conditions.operator}
                onChange={(value) => setConditions(prev => ({ ...prev, operator: value as 'AND' | 'OR' }))}
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-3">
            {conditions.rules.map((condition, index) => (
              <div key={condition.id}>
                {index > 0 && (
                  <div className="flex justify-center py-2">
                    <Badge variant="secondary" className="text-xs">
                      {conditions.operator}
                    </Badge>
                  </div>
                )}
                <ConditionBuilder
                  condition={condition}
                  fields={fields}
                  onChange={(updatedCondition) => updateCondition(index, updatedCondition)}
                  onRemove={() => removeCondition(index)}
                />
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addCondition}
            className="w-full border-dashed"
            disabled={fields.length === 0}
          >
            + Add Condition
          </Button>
        </div>

        {/* Preview */}
        {onPreview && conditions.rules.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Preview</h3>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isPreviewLoading}
                size="sm"
              >
                {isPreviewLoading ? 'Loading...' : 'Preview Results'}
              </Button>
            </div>

            {previewData && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" className="text-lg font-semibold">
                      {previewData.count.toLocaleString()} subscribers
                    </Badge>
                    <span className="text-sm text-gray-600">match this segment</span>
                  </div>
                  
                  {previewData.sampleSubscribers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Sample subscribers:</p>
                      <div className="space-y-1">
                        {previewData.sampleSubscribers.map((subscriber) => (
                          <div key={subscriber.id} className="text-sm text-gray-600">
                            {subscriber.email} {subscriber.firstName && `(${subscriber.firstName} ${subscriber.lastName || ''})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isLoading}
          >
            {isLoading ? 'Saving...' : (initialData?.id ? 'Update Segment' : 'Create Segment')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}