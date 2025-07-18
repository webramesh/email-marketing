'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Dropdown } from '@/components/ui/Dropdown'
import { SubscriberStatus, type SubscriberWithDetails } from '@/types'
import { SubscriberForm } from '@/components/subscribers/SubscriberForm'
import { SubscriberStats } from '@/components/subscribers/SubscriberStats'
import { BulkImportModal } from '@/components/subscribers/BulkImportModal'
import { useSubscribers } from '@/hooks/useSubscribers'

export default function SubscribersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | ''>('')
  const [sortBy, setSortBy] = useState<'email' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberWithDetails | null>(null)

  const {
    subscribers,
    loading,
    error,
    meta,
    stats,
    createSubscriber,
    updateSubscriber,
    deleteSubscriber,
    refetch
  } = useSubscribers({
    page,
    limit: 20,
    search,
    status: statusFilter || undefined,
    sortBy,
    sortOrder
  })

  const handleCreateSubscriber = async (data: any) => {
    try {
      await createSubscriber(data)
      setShowCreateModal(false)
      refetch()
    } catch (error) {
      console.error('Failed to create subscriber:', error)
    }
  }

  const handleUpdateSubscriber = async (data: any) => {
    if (!selectedSubscriber) return
    
    try {
      await updateSubscriber(selectedSubscriber.id, data)
      setShowEditModal(false)
      setSelectedSubscriber(null)
      refetch()
    } catch (error) {
      console.error('Failed to update subscriber:', error)
    }
  }

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) return
    
    try {
      await deleteSubscriber(id)
      refetch()
    } catch (error) {
      console.error('Failed to delete subscriber:', error)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch('/api/subscribers/bulk/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          filters: {
            status: statusFilter || undefined,
            search: search || undefined,
          },
          fields: ['email', 'firstName', 'lastName', 'status', 'createdAt'],
          includeCustomFields: true,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subscribers_export_${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Export failed')
      }
    } catch (error) {
      console.error('Failed to export subscribers:', error)
    }
  }

  const getStatusColor = (status: SubscriberStatus) => {
    switch (status) {
      case SubscriberStatus.ACTIVE:
        return 'green'
      case SubscriberStatus.UNSUBSCRIBED:
        return 'gray'
      case SubscriberStatus.BOUNCED:
        return 'red'
      case SubscriberStatus.COMPLAINED:
        return 'orange'
      case SubscriberStatus.INVALID:
        return 'red'
      default:
        return 'gray'
    }
  }

  const columns = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (subscriber: SubscriberWithDetails) => (
        <div>
          <div className="font-medium text-gray-900">{subscriber.email}</div>
          {(subscriber.firstName || subscriber.lastName) && (
            <div className="text-sm text-gray-500">
              {[subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ')}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (subscriber: SubscriberWithDetails) => (
        <Badge color={getStatusColor(subscriber.status)}>
          {subscriber.status}
        </Badge>
      )
    },
    {
      key: 'lists',
      label: 'Lists',
      render: (subscriber: SubscriberWithDetails) => (
        <div className="flex flex-wrap gap-1">
          {subscriber.lists.slice(0, 2).map((listMembership) => (
            <Badge key={listMembership.id} color="blue" size="sm">
              {listMembership.list.name}
            </Badge>
          ))}
          {subscriber.lists.length > 2 && (
            <Badge color="gray" size="sm">
              +{subscriber.lists.length - 2} more
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'emailEvents',
      label: 'Activity',
      render: (subscriber: SubscriberWithDetails) => (
        <div className="text-sm text-gray-600">
          {subscriber._count?.emailEvents || 0} events
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (subscriber: SubscriberWithDetails) => (
        <div className="text-sm text-gray-600">
          {new Date(subscriber.createdAt).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (subscriber: SubscriberWithDetails) => (
        <Dropdown
          trigger={
            <Button variant="ghost" size="sm">
              •••
            </Button>
          }
          items={[
            {
              label: 'View Details',
              onClick: () => {
                setSelectedSubscriber(subscriber)
                // Navigate to subscriber detail page
              }
            },
            {
              label: 'Edit',
              onClick: () => {
                setSelectedSubscriber(subscriber)
                setShowEditModal(true)
              }
            },
            {
              label: 'Delete',
              onClick: () => handleDeleteSubscriber(subscriber.id),
              className: 'text-red-600'
            }
          ]}
        />
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
          <p className="text-gray-600">Manage your email subscribers and their information</p>
        </div>
        <div className="flex gap-2">
          <Dropdown
            trigger={
              <Button variant="outline">
                Import/Export
              </Button>
            }
            items={[
              {
                label: 'Import from CSV',
                onClick: () => setShowBulkImportModal(true)
              },
              {
                label: 'Export to CSV',
                onClick: () => handleExport('csv')
              },
              {
                label: 'Export to JSON',
                onClick: () => handleExport('json')
              }
            ]}
          />
          <Button onClick={() => setShowCreateModal(true)}>
            Add Subscriber
          </Button>
        </div>
      </div>

      {/* Stats */}
      <SubscriberStats stats={stats} />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search subscribers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="min-w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubscriberStatus | '')}
            >
              <option value="">All Statuses</option>
              <option value={SubscriberStatus.ACTIVE}>Active</option>
              <option value={SubscriberStatus.UNSUBSCRIBED}>Unsubscribed</option>
              <option value={SubscriberStatus.BOUNCED}>Bounced</option>
              <option value={SubscriberStatus.COMPLAINED}>Complained</option>
              <option value={SubscriberStatus.INVALID}>Invalid</option>
            </select>
          </div>
          <div className="min-w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as any)
                setSortOrder(order as 'asc' | 'desc')
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="firstName-asc">First Name A-Z</option>
              <option value="firstName-desc">First Name Z-A</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          data={subscribers}
          loading={loading}
          error={error}
          pagination={{
            currentPage: page,
            totalPages: meta?.totalPages || 1,
            onPageChange: setPage,
            totalItems: meta?.total || 0
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Subscriber"
        size="lg"
      >
        <SubscriberForm
          onSubmit={handleCreateSubscriber}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedSubscriber(null)
        }}
        title="Edit Subscriber"
        size="lg"
      >
        {selectedSubscriber && (
          <SubscriberForm
            initialData={selectedSubscriber}
            onSubmit={handleUpdateSubscriber}
            onCancel={() => {
              setShowEditModal(false)
              setSelectedSubscriber(null)
            }}
          />
        )}
      </Modal>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onImportComplete={() => {
          refetch()
          setShowBulkImportModal(false)
        }}
      />
    </div>
  )
}