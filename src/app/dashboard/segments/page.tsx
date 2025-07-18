'use client'

import React, { useState, useEffect } from 'react'
import { SegmentList } from '@/components/segments/SegmentList'
import { SegmentAnalytics } from '@/components/segments/SegmentAnalytics'
import { 
  Segment, 
  SegmentField, 
  SegmentConditions,
  CreateSegmentData,
  UpdateSegmentData,
  SegmentAnalytics as SegmentAnalyticsType
} from '@/services/segment.service'
import { PaginatedResponse } from '@/types'

// Mock data for demonstration
const mockSegments: PaginatedResponse<Segment> = {
  data: [
    {
      id: '1',
      name: 'Active Subscribers',
      description: 'All active subscribers who have not unsubscribed',
      conditions: {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'status',
            operator: 'equals',
            value: 'ACTIVE'
          }
        ]
      },
      subscriberCount: 1250,
      lastUpdated: new Date('2024-01-15'),
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-15'),
      tenantId: 'demo-tenant'
    },
    {
      id: '2',
      name: 'High Engagement Users',
      description: 'Users who have opened emails in the last 30 days',
      conditions: {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'status',
            operator: 'equals',
            value: 'ACTIVE'
          },
          {
            id: '2',
            field: 'createdAt',
            operator: 'greater_than',
            value: '2024-01-01'
          }
        ]
      },
      subscriberCount: 850,
      lastUpdated: new Date('2024-01-14'),
      createdAt: new Date('2024-01-12'),
      updatedAt: new Date('2024-01-14'),
      tenantId: 'demo-tenant'
    },
    {
      id: '3',
      name: 'New Subscribers',
      description: 'Subscribers who joined in the last 7 days',
      conditions: {
        operator: 'AND',
        rules: [
          {
            id: '1',
            field: 'createdAt',
            operator: 'greater_than',
            value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      },
      subscriberCount: 45,
      lastUpdated: new Date(),
      createdAt: new Date('2024-01-13'),
      updatedAt: new Date(),
      tenantId: 'demo-tenant'
    }
  ],
  meta: {
    total: 3,
    page: 1,
    limit: 20,
    totalPages: 1
  }
}

const mockFields: SegmentField[] = [
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
  },
  {
    key: 'firstName',
    label: 'First Name',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
  },
  {
    key: 'lastName',
    label: 'Last Name',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
      { value: 'BOUNCED', label: 'Bounced' },
      { value: 'COMPLAINED', label: 'Complained' },
      { value: 'INVALID', label: 'Invalid' }
    ],
    operators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    key: 'createdAt',
    label: 'Created Date',
    type: 'date',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    key: 'custom_age',
    label: 'Custom: Age',
    type: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between']
  },
  {
    key: 'custom_city',
    label: 'Custom: City',
    type: 'string',
    operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']
  }
]

const mockAnalytics: SegmentAnalyticsType = {
  segment: mockSegments.data[0],
  performance: {
    segmentId: '1',
    totalSubscribers: 1250,
    activeSubscribers: 1200,
    engagementRate: 24.5,
    openRate: 28.3,
    clickRate: 4.2,
    unsubscribeRate: 0.8,
    bounceRate: 2.1,
    lastCalculated: new Date()
  },
  subscriberGrowth: [
    { date: new Date('2024-01-01'), count: 1100 },
    { date: new Date('2024-01-05'), count: 1150 },
    { date: new Date('2024-01-10'), count: 1200 },
    { date: new Date('2024-01-15'), count: 1250 }
  ],
  engagementTrends: [
    { date: new Date('2024-01-10'), opens: 45, clicks: 12, unsubscribes: 2 },
    { date: new Date('2024-01-11'), opens: 52, clicks: 15, unsubscribes: 1 },
    { date: new Date('2024-01-12'), opens: 38, clicks: 8, unsubscribes: 0 },
    { date: new Date('2024-01-13'), opens: 61, clicks: 18, unsubscribes: 3 }
  ]
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState(mockSegments)
  const [fields] = useState(mockFields)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list')
  const [selectedSegmentAnalytics, setSelectedSegmentAnalytics] = useState<SegmentAnalyticsType | null>(null)

  const handleRefresh = async () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleCreateSegment = async (data: CreateSegmentData) => {
    console.log('Creating segment:', data)
    // Simulate API call
    const newSegment: Segment = {
      id: Date.now().toString(),
      name: data.name,
      description: data.description,
      conditions: data.conditions,
      subscriberCount: Math.floor(Math.random() * 1000),
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'demo-tenant'
    }
    
    setSegments(prev => ({
      ...prev,
      data: [newSegment, ...prev.data],
      meta: {
        ...prev.meta,
        total: prev.meta.total + 1
      }
    }))
  }

  const handleUpdateSegment = async (id: string, data: UpdateSegmentData) => {
    console.log('Updating segment:', id, data)
    // Simulate API call
    setSegments(prev => ({
      ...prev,
      data: prev.data.map(segment => 
        segment.id === id 
          ? { 
              ...segment, 
              ...data, 
              lastUpdated: new Date(),
              subscriberCount: Math.floor(Math.random() * 1000)
            }
          : segment
      )
    }))
  }

  const handleDeleteSegment = async (id: string) => {
    console.log('Deleting segment:', id)
    // Simulate API call
    setSegments(prev => ({
      ...prev,
      data: prev.data.filter(segment => segment.id !== id),
      meta: {
        ...prev.meta,
        total: prev.meta.total - 1
      }
    }))
  }

  const handlePreviewSegment = async (conditions: SegmentConditions) => {
    console.log('Previewing segment:', conditions)
    // Simulate API call
    return {
      count: Math.floor(Math.random() * 500) + 50,
      sampleSubscribers: [
        { id: '1', email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
        { id: '2', email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith' },
        { id: '3', email: 'bob@example.com', firstName: 'Bob', lastName: 'Johnson' }
      ]
    }
  }

  const handleRefreshSegmentCount = async (id: string) => {
    console.log('Refreshing segment count:', id)
    // Simulate API call
    setSegments(prev => ({
      ...prev,
      data: prev.data.map(segment => 
        segment.id === id 
          ? { 
              ...segment, 
              subscriberCount: Math.floor(Math.random() * 1000),
              lastUpdated: new Date()
            }
          : segment
      )
    }))
  }

  const handleViewSegmentSubscribers = (id: string) => {
    console.log('Viewing segment subscribers:', id)
    // Navigate to subscribers view with segment filter
    alert(`Viewing subscribers for segment ${id}`)
  }

  const handleViewSegmentAnalytics = (id: string) => {
    console.log('Viewing segment analytics:', id)
    setSelectedSegmentAnalytics(mockAnalytics)
    setViewMode('analytics')
  }

  if (viewMode === 'analytics' && selectedSegmentAnalytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => {
              setViewMode('list')
              setSelectedSegmentAnalytics(null)
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Segments
          </button>
        </div>
        <SegmentAnalytics
          analytics={selectedSegmentAnalytics}
          onRefresh={() => console.log('Refreshing analytics')}
          isLoading={isLoading}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SegmentList
        segments={segments}
        fields={fields}
        onRefresh={handleRefresh}
        onCreateSegment={handleCreateSegment}
        onUpdateSegment={handleUpdateSegment}
        onDeleteSegment={handleDeleteSegment}
        onPreviewSegment={handlePreviewSegment}
        onRefreshSegmentCount={handleRefreshSegmentCount}
        onViewSegmentSubscribers={handleViewSegmentSubscribers}
        onViewSegmentAnalytics={handleViewSegmentAnalytics}
        isLoading={isLoading}
      />
    </div>
  )
}