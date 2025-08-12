'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { UserRole } from '@/generated/prisma'

interface BulkUserActionsProps {
  selectedUserIds: string[]
  onBulkAction: (action: 'activate' | 'deactivate' | 'delete', data?: any) => Promise<void>
  onClearSelection: () => void
  canDelete: boolean
}

export function BulkUserActions({
  selectedUserIds,
  onBulkAction,
  onClearSelection,
  canDelete
}: BulkUserActionsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    action: 'activate' | 'deactivate' | 'delete'
    title: string
    message: string
    confirmText: string
    variant: 'default' | 'danger'
  } | null>(null)
  const [deactivationReason, setDeactivationReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (selectedUserIds.length === 0) {
    return null
  }

  const handleActionClick = (action: 'activate' | 'deactivate' | 'delete') => {
    let actionConfig = {
      action,
      title: '',
      message: '',
      confirmText: '',
      variant: 'default' as 'default' | 'danger'
    }

    switch (action) {
      case 'activate':
        actionConfig = {
          action,
          title: 'Activate Users',
          message: `Are you sure you want to activate ${selectedUserIds.length} selected users?`,
          confirmText: 'Activate Users',
          variant: 'default'
        }
        break
      case 'deactivate':
        actionConfig = {
          action,
          title: 'Deactivate Users',
          message: `Are you sure you want to deactivate ${selectedUserIds.length} selected users?`,
          confirmText: 'Deactivate Users',
          variant: 'default'
        }
        break
      case 'delete':
        actionConfig = {
          action,
          title: 'Delete Users',
          message: `Are you sure you want to permanently delete ${selectedUserIds.length} selected users? This action cannot be undone.`,
          confirmText: 'Delete Users',
          variant: 'danger'
        }
        break
    }

    setPendingAction(actionConfig)
    setShowConfirmModal(true)
  }

  const handleConfirm = async () => {
    if (!pendingAction) return

    setLoading(true)
    try {
      const actionData = pendingAction.action === 'deactivate' 
        ? { deactivationReason: deactivationReason || 'Bulk deactivation' }
        : undefined

      await onBulkAction(pendingAction.action, actionData)
      setShowConfirmModal(false)
      setPendingAction(null)
      setDeactivationReason('')
      onClearSelection()
    } catch (error) {
      console.error('Bulk action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowConfirmModal(false)
    setPendingAction(null)
    setDeactivationReason('')
  }

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex-1">
          <span className="text-sm font-medium text-blue-900">
            {selectedUserIds.length} users selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionClick('activate')}
          >
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionClick('deactivate')}
          >
            Deactivate
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleActionClick('delete')}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Delete
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        title={pendingAction?.title || ''}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {pendingAction?.message}
          </p>

          {pendingAction?.action === 'deactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deactivation Reason (Optional)
              </label>
              <input
                type="text"
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="Enter reason for deactivation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction?.variant === 'danger' ? 'outline' : 'default'}
              onClick={handleConfirm}
              loading={loading}
              className={pendingAction?.variant === 'danger' ? 'text-red-600 border-red-300 hover:bg-red-50' : ''}
            >
              {pendingAction?.confirmText}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}