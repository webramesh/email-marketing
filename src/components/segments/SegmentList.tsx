'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Dropdown } from '@/components/ui/Dropdown'
import { SegmentBuilder } from './SegmentBuilder'
import { 
  Segment, 
  SegmentField, 
  SegmentConditions,
  CreateSegmentData,
  UpdateSegmentData 
} from '@/services/segment.service'
import { PaginatedResponse } from '@/types'

interface SegmentListProps {
  segments: PaginatedResponse<Segment>
  fields: SegmentField[]
  onRefresh: () => void
  onCreateSegment: (data: CreateSegmentData) => Promise<void>
  onUpdateSegment: (id: string, data: UpdateSegmentData) => Promise<void>
  onDeleteSegment: (id: string) => Promise<void>
  onPreviewSegment: (conditions: SegmentConditions) => Promise<{ count: number; sampleSubscribers: any[] }>
  onRefreshSegmentCount: (id: string) => Promise<void>
  onViewSegmentSubscribers: (id: string) => void
  onViewSegmentAnalytics: (id: string) => void
  isLoading?: boolean
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  fields,
  onRefresh,
  onCreateSegment,
  onUpdateSegment,
  onDeleteSegment,
  onPreviewSegment,
  onRefreshSegmentCount,
  onViewSegmentSubscribers,
  onViewSegmentAnalytics,
  isLoading = false
}) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshingSegments, setRefreshingSegments] = useState<Set<string>>(new Set())

  const handleCreateSegment = async (data: CreateSegmentData) => {
    await onCreateSegment(data)
    setIsBuilderOpen(false)
    onRefresh()
  }

  const handleUpdateSegment = async (id: string, data: UpdateSegmentData) => {
    await onUpdateSegment(id, data)
    setEditingSegment(null)
    onRefresh()
  }

  const handleSaveSegment = async (data: CreateSegmentData | UpdateSegmentData) => {
    if (editingSegment) {
      // For updates, we know the data will have the required fields
      await handleUpdateSegment(editingSegment.id, data as UpdateSegmentData)
    } else {
      // For creates, we know the data will have the required fields
      await handleCreateSegment(data as CreateSegmentData)
    }
  }

  const handleDeleteSegment = async (id: string) => {
    if (confirm('Are you sure you want to delete this segment?')) {
      await onDeleteSegment(id)
      onRefresh()
    }
  }

  const handleRefreshSegmentCount = async (id: string) => {
    setRefreshingSegments(prev => new Set(prev).add(id))
    try {
      await onRefreshSegmentCount(id)
      onRefresh()
    } finally {
      setRefreshingSegments(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const formatConditionsSummary = (conditions: any): string => {
    if (!conditions || !conditions.rules || conditions.rules.length === 0) {
      return 'No conditions'
    }

    const ruleCount = conditions.rules.length
    const operator = conditions.operator === 'OR' ? 'any' : 'all'
    
    if (ruleCount === 1) {
      const rule = conditions.rules[0]
      const field = fields.find(f => f.key === rule.field)
      return `${field?.label || rule.field} ${rule.operator.replace(/_/g, ' ')} ${rule.value || ''}`
    }

    return `Match ${operator} of ${ruleCount} conditions`
  }

  const getSegmentStatusColor = (count: number): string => {
    if (count === 0) return 'text-gray-500'
    if (count < 100) return 'text-yellow-600'
    if (count < 1000) return 'text-blue-600'
    return 'text-green-600'
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (segment: Segment) => (
        <div>
          <div className="font-medium text-gray-900">{segment.name}</div>
          {segment.description && (
            <div className="text-sm text-gray-500">{segment.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'conditions',
      label: 'Conditions',
      render: (segment: Segment) => (
        <div className="text-sm text-gray-600">
          {formatConditionsSummary(segment.conditions)}
        </div>
      )
    },
    {
      key: 'subscriberCount',
      label: 'Subscribers',
      render: (segment: Segment) => (
        <div className="flex items-center gap-2">
          <Badge 
            variant="secondary" 
            className={`font-semibold ${getSegmentStatusColor(segment.subscriberCount)}`}
          >
            {segment.subscriberCount.toLocaleString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefreshSegmentCount(segment.id)}
            disabled={refreshingSegments.has(segment.id)}
            className="text-xs"
          >
            {refreshingSegments.has(segment.id) ? '...' : '↻'}
          </Button>
        </div>
      )
    },
    {
      key: 'lastUpdated',
      label: 'Last Updated',
      render: (segment: Segment) => (
        <div className="text-sm text-gray-600">
          {new Date(segment.lastUpdated).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (segment: Segment) => (
        <div className="flex items-center gap-1">
          <Dropdown
            trigger={
              <Button variant="outline" size="sm">
                Actions
              </Button>
            }
            items={[
              {
                value: 'view-subscribers',
                label: 'View Subscribers',
                onClick: () => onViewSegmentSubscribers(segment.id)
              },
              {
                value: 'view-analytics',
                label: 'View Analytics',
                onClick: () => onViewSegmentAnalytics(segment.id)
              },
              {
                value: 'edit',
                label: 'Edit',
                onClick: () => setEditingSegment(segment)
              },
              {
                value: 'delete',
                label: 'Delete',
                onClick: () => handleDeleteSegment(segment.id),
                className: 'text-red-600 hover:text-red-700'
              }
            ]}
          />
        </div>
      )
    }
  ]

  const filteredSegments = segments.data.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (segment.description && segment.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
          <p className="text-gray-600">Create and manage subscriber segments</p>
        </div>
        <Button onClick={() => setIsBuilderOpen(true)}>
          Create Segment
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {/* Segments Table */}
      <Card>
        {filteredSegments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-4">
              {searchTerm ? 'No segments match your search.' : 'No segments created yet.'}
            </div>
            {!searchTerm && (
              <Button onClick={() => setIsBuilderOpen(true)}>
                Create Your First Segment
              </Button>
            )}
          </div>
        ) : (
          <Table
            data={filteredSegments}
            columns={columns}
            loading={isLoading}
          />
        )}
      </Card>

      {/* Pagination */}
      {segments.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((segments.meta.page - 1) * segments.meta.limit) + 1} to{' '}
            {Math.min(segments.meta.page * segments.meta.limit, segments.meta.total)} of{' '}
            {segments.meta.total} segments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={segments.meta.page === 1}
              onClick={() => {/* Handle previous page */}}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {segments.meta.page} of {segments.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={segments.meta.page === segments.meta.totalPages}
              onClick={() => {/* Handle next page */}}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Segment Builder Modal */}
      <SegmentBuilder
        isOpen={isBuilderOpen || !!editingSegment}
        onClose={() => {
          setIsBuilderOpen(false)
          setEditingSegment(null)
        }}
        onSave={handleSaveSegment}
        initialData={editingSegment ? {
          id: editingSegment.id,
          name: editingSegment.name,
          description: editingSegment.description || '',
          conditions: editingSegment.conditions
        } : undefined}
        fields={fields}
        onPreview={onPreviewSegment}
      />
    </div>
  )
}