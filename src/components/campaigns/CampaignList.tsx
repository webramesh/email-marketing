'use client'

import { useState, useEffect } from 'react'
import { CampaignWithDetails, CampaignStatus, CampaignType, PaginatedResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'

interface CampaignListProps {
  onCreateCampaign?: () => void
  onEditCampaign?: (campaign: CampaignWithDetails) => void
}

export function CampaignList({ onCreateCampaign, onEditCampaign }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '' as CampaignStatus | '',
    type: '' as CampaignType | ''
  })
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignWithDetails | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [campaignToDuplicate, setCampaignToDuplicate] = useState<CampaignWithDetails | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type })
      })

      const response = await fetch(`/api/campaigns?${params}`)
      const result = await response.json()

      if (result.success) {
        setCampaigns(result.data)
        setPagination(prev => ({
          ...prev,
          total: result.meta.total,
          totalPages: result.meta.totalPages
        }))
      } else {
        setError(result.error || 'Failed to fetch campaigns')
      }
    } catch (err) {
      setError('Failed to fetch campaigns')
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [pagination.page, pagination.limit, filters])

  // Delete campaign
  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return

    try {
      const response = await fetch(`/api/campaigns/${campaignToDelete.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id))
        setShowDeleteModal(false)
        setCampaignToDelete(null)
      } else {
        setError(result.error || 'Failed to delete campaign')
      }
    } catch (err) {
      setError('Failed to delete campaign')
      console.error('Error deleting campaign:', err)
    }
  }

  // Duplicate campaign
  const handleDuplicateCampaign = async () => {
    if (!campaignToDuplicate) return

    try {
      const response = await fetch(`/api/campaigns/${campaignToDuplicate.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: duplicateName || undefined })
      })
      const result = await response.json()

      if (result.success) {
        setCampaigns(prev => [result.data, ...prev])
        setShowDuplicateModal(false)
        setCampaignToDuplicate(null)
        setDuplicateName('')
      } else {
        setError(result.error || 'Failed to duplicate campaign')
      }
    } catch (err) {
      setError('Failed to duplicate campaign')
      console.error('Error duplicating campaign:', err)
    }
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: CampaignStatus) => {
    switch (status) {
      case CampaignStatus.DRAFT:
        return 'secondary'
      case CampaignStatus.SCHEDULED:
        return 'warning'
      case CampaignStatus.SENDING:
        return 'primary'
      case CampaignStatus.SENT:
        return 'success'
      case CampaignStatus.PAUSED:
        return 'warning'
      case CampaignStatus.CANCELLED:
        return 'error'
      default:
        return 'secondary'
    }
  }

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading campaigns...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">Create and manage your email campaigns</p>
        </div>
        <Button onClick={onCreateCampaign} variant="primary">
          Create Campaign
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search campaigns..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
          <Dropdown
            value={filters.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value as CampaignStatus }))}
            items={[
              { value: '', label: 'All Statuses' },
              { value: CampaignStatus.DRAFT, label: 'Draft' },
              { value: CampaignStatus.SCHEDULED, label: 'Scheduled' },
              { value: CampaignStatus.SENDING, label: 'Sending' },
              { value: CampaignStatus.SENT, label: 'Sent' },
              { value: CampaignStatus.PAUSED, label: 'Paused' },
              { value: CampaignStatus.CANCELLED, label: 'Cancelled' }
            ]}
          />
          <Dropdown
            value={filters.type}
            onChange={(value) => setFilters(prev => ({ ...prev, type: value as CampaignType }))}
            items={[
              { value: '', label: 'All Types' },
              { value: CampaignType.REGULAR, label: 'Regular' },
              { value: CampaignType.AB_TEST, label: 'A/B Test' },
              { value: CampaignType.AUTOMATION, label: 'Automation' },
              { value: CampaignType.TRANSACTIONAL, label: 'Transactional' }
            ]}
          />
          <Button
            variant="secondary"
            onClick={() => setFilters({ search: '', status: '', type: '' })}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Campaign List */}
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              {filters.search || filters.status || filters.type
                ? 'No campaigns match your filters'
                : 'No campaigns yet'}
            </div>
            {!filters.search && !filters.status && !filters.type && (
              <Button
                variant="primary"
                onClick={onCreateCampaign}
                className="mt-4"
              >
                Create Your First Campaign
              </Button>
            )}
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {campaign.name}
                    </h3>
                    <Badge variant={getStatusBadgeVariant(campaign.status)}>
                      {campaign.status}
                    </Badge>
                    {campaign.isAbTest && (
                      <Badge variant="primary">A/B Test</Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{campaign.subject}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {formatDate(campaign.createdAt)}
                    </div>
                    {campaign.scheduledAt && (
                      <div>
                        <span className="font-medium">Scheduled:</span>{' '}
                        {formatDate(campaign.scheduledAt)}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Recipients:</span>{' '}
                      {campaign.totalRecipients.toLocaleString()}
                    </div>
                    {campaign.totalSent > 0 && (
                      <div>
                        <span className="font-medium">Sent:</span>{' '}
                        {campaign.totalSent.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Statistics for sent campaigns */}
                  {campaign.status === CampaignStatus.SENT && campaign.totalSent > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-green-600">
                        <span className="font-medium">Opens:</span>{' '}
                        {campaign.totalOpened} ({((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-blue-600">
                        <span className="font-medium">Clicks:</span>{' '}
                        {campaign.totalClicked} ({((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-red-600">
                        <span className="font-medium">Bounces:</span>{' '}
                        {campaign.totalBounced} ({((campaign.totalBounced / campaign.totalSent) * 100).toFixed(1)}%)
                      </div>
                      <div className="text-orange-600">
                        <span className="font-medium">Unsubscribes:</span>{' '}
                        {campaign.totalUnsubscribed}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onEditCampaign?.(campaign)}
                  >
                    Edit
                  </Button>
                  <Dropdown
                    trigger={
                      <Button variant="secondary" size="sm">
                        Actions
                      </Button>
                    }
                    items={[
                      {
                        value: 'duplicate',
                        label: 'Duplicate',
                        onClick: () => {
                          setCampaignToDuplicate(campaign)
                          setDuplicateName(`${campaign.name} (Copy)`)
                          setShowDuplicateModal(true)
                        }
                      },
                      {
                        value: 'delete',
                        label: 'Delete',
                        onClick: () => {
                          setCampaignToDelete(campaign)
                          setShowDeleteModal(true)
                        },
                        className: 'text-red-600'
                      }
                    ]}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Campaign"
      >
        <div className="space-y-4">
          <p>
            Are you sure you want to delete the campaign "{campaignToDelete?.name}"?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleDeleteCampaign}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Campaign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Duplicate Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Duplicate Campaign"
      >
        <div className="space-y-4">
          <p>
            Create a copy of "{campaignToDuplicate?.name}"
          </p>
          <Input
            label="New Campaign Name"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            placeholder="Enter name for duplicated campaign"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDuplicateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDuplicateCampaign}
              disabled={!duplicateName.trim()}
            >
              Duplicate Campaign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}