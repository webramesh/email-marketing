'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { type ListWithDetails, type ListAnalytics } from '@/types'

interface ListManagementProps {
  tenantId: string
}

export function ListManagement({ tenantId }: ListManagementProps) {
  const [lists, setLists] = useState<ListWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [selectedList, setSelectedList] = useState<ListWithDetails | null>(null)
  const [analytics, setAnalytics] = useState<ListAnalytics | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Form state for creating/editing lists
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Fetch lists
  const fetchLists = async (page = 1, search = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search })
      })

      const response = await fetch(`/api/lists?${params}`)
      const result = await response.json()

      if (result.success) {
        setLists(result.data)
        setPagination(prev => ({
          ...prev,
          page: result.meta.page,
          total: result.meta.total,
          totalPages: result.meta.totalPages
        }))
      } else {
        setError(result.error || 'Failed to fetch lists')
      }
    } catch (err) {
      setError('Failed to fetch lists')
      console.error('Error fetching lists:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create list
  const createList = async () => {
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        setShowCreateModal(false)
        setFormData({ name: '', description: '' })
        fetchLists(pagination.page, searchTerm)
      } else {
        setError(result.error || 'Failed to create list')
      }
    } catch (err) {
      setError('Failed to create list')
      console.error('Error creating list:', err)
    }
  }

  // Delete list
  const deleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        fetchLists(pagination.page, searchTerm)
      } else {
        setError(result.error || 'Failed to delete list')
      }
    } catch (err) {
      setError('Failed to delete list')
      console.error('Error deleting list:', err)
    }
  }

  // Duplicate list
  const duplicateList = async (listId: string, originalName: string) => {
    const newName = prompt(`Enter name for duplicated list:`, `${originalName} (Copy)`)
    if (!newName) return

    try {
      const response = await fetch(`/api/lists/${listId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      })

      const result = await response.json()

      if (result.success) {
        fetchLists(pagination.page, searchTerm)
      } else {
        setError(result.error || 'Failed to duplicate list')
      }
    } catch (err) {
      setError('Failed to duplicate list')
      console.error('Error duplicating list:', err)
    }
  }

  // Fetch analytics
  const fetchAnalytics = async (listId: string) => {
    try {
      const response = await fetch(`/api/lists/${listId}/analytics`)
      const result = await response.json()

      if (result.success) {
        setAnalytics(result.data)
      } else {
        setError(result.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      setError('Failed to fetch analytics')
      console.error('Error fetching analytics:', err)
    }
  }

  // Export list
  const exportList = async (listId: string, listName: string, format: 'json' | 'csv' = 'csv') => {
    try {
      const response = await fetch(`/api/lists/${listId}/export?format=${format}`)
      
      if (format === 'csv') {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${listName}_subscribers.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const result = await response.json()
        if (result.success) {
          const dataStr = JSON.stringify(result.data, null, 2)
          const blob = new Blob([dataStr], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${listName}_export.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
    } catch (err) {
      setError('Failed to export list')
      console.error('Error exporting list:', err)
    }
  }

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    fetchLists(1, value)
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    fetchLists(newPage, searchTerm)
  }

  // Show analytics modal
  const showAnalytics = (list: ListWithDetails) => {
    setSelectedList(list)
    setShowAnalyticsModal(true)
    fetchAnalytics(list.id)
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (list: ListWithDetails) => (
        <div>
          <div className="font-medium">{list.name}</div>
          {list.description && (
            <div className="text-sm text-gray-500">{list.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'subscribers',
      label: 'Subscribers',
      render: (list: ListWithDetails) => (
        <Badge variant="secondary">
          {list._count?.subscribers || 0}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (list: ListWithDetails) => (
        <span className="text-sm text-gray-500">
          {new Date(list.createdAt).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (list: ListWithDetails) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => showAnalytics(list)}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => duplicateList(list.id, list.name)}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportList(list.id, list.name)}
          >
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteList(list.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">List Management</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Create List
        </Button>
      </div>

      {/* Search */}
      <div className="flex space-x-4">
        <Input
          placeholder="Search lists..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Lists table */}
      <Card>
        <Table
          data={lists}
          columns={columns}
          loading={loading}
          pagination={{
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            totalItems: pagination.total,
            onPageChange: handlePageChange
          }}
        />
      </Card>

      {/* Create List Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New List"
      >
        <div className="space-y-4">
          <Input
            label="List Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter list name"
            required
          />
          <Input
            label="Description (Optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter list description"
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createList}
              disabled={!formData.name.trim()}
            >
              Create List
            </Button>
          </div>
        </div>
      </Modal>

      {/* Analytics Modal */}
      <Modal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        title={`Analytics - ${selectedList?.name}`}
        size="lg"
      >
        {analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.totalSubscribers}
                </div>
                <div className="text-sm text-gray-500">Total Subscribers</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {analytics.activeSubscribers}
                </div>
                <div className="text-sm text-gray-500">Active Subscribers</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.growthRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Growth Rate (30d)</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.engagementRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Engagement Rate</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {analytics.unsubscribedSubscribers}
                </div>
                <div className="text-sm text-gray-500">Unsubscribed</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-gray-600">
                  {analytics.bouncedSubscribers + analytics.complainedSubscribers + analytics.invalidSubscribers}
                </div>
                <div className="text-sm text-gray-500">Inactive</div>
              </Card>
            </div>
            <div className="text-xs text-gray-400">
              Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}