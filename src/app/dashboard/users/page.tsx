'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Dropdown } from '@/components/ui/Dropdown'
import { UserRole } from '@/generated/prisma'
import { UserForm } from '@/components/users/UserForm'
import { UserStats } from '@/components/users/UserStats'
import { CustomerOnboardingModal } from '@/components/users/CustomerOnboardingModal'
import { BulkUserActions } from '@/components/users/BulkUserActions'
import { useUsers } from '@/hooks/useUsers'

interface UserWithDetails {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: UserRole
  isActive: boolean
  deactivationReason?: string
  createdAt: string
  updatedAt: string
  tenant: {
    id: string
    name: string
    subdomain: string
    customDomain?: string
  }
  packagePurchases?: Array<{
    id: string
    status: string
    package: {
      id: string
      name: string
      price: number
      currency: string
    }
    currentPeriodStart: string
    currentPeriodEnd: string
  }>
  _count?: {
    assignedTickets: number
    requestedTickets: number
  }
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<boolean | ''>('')
  const [packageFilter, setPackageFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'email' | 'name' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [availablePackages, setAvailablePackages] = useState<Array<{
    id: string
    name: string
    description?: string
    price: number
    currency: string
    billingCycle: string
    features: any
    quotas: any
  }>>([])

  const currentUserRole = session?.user?.role as UserRole

  const {
    users,
    loading,
    error,
    meta,
    stats,
    createUser,
    updateUser,
    deleteUser,
    bulkUpdateUsers,
    refetch
  } = useUsers({
    page,
    limit: 20,
    search,
    role: roleFilter || undefined,
    isActive: statusFilter !== '' ? statusFilter : undefined,
    packageId: packageFilter || undefined,
    sortBy,
    sortOrder
  })

  // Fetch available packages for admin users
  useEffect(() => {
    if (currentUserRole === UserRole.ADMIN) {
      fetchAvailablePackages()
    }
  }, [currentUserRole])

  const fetchAvailablePackages = async () => {
    try {
      const response = await fetch('/api/packages/my')
      if (response.ok) {
        const data = await response.json()
        setAvailablePackages(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error)
    }
  }

  const handleCreateUser = async (data: any) => {
    try {
      await createUser(data)
      setShowCreateModal(false)
      refetch()
    } catch (error) {
      console.error('Failed to create user:', error)
    }
  }

  const handleUpdateUser = async (data: any) => {
    if (!selectedUser) return
    
    try {
      await updateUser(selectedUser.id, data)
      setShowEditModal(false)
      setSelectedUser(null)
      refetch()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const handleCustomerOnboarding = async (customerData: any) => {
    try {
      // Create user with package assignment
      await createUser({
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        name: `${customerData.firstName} ${customerData.lastName}`,
        password: generateTemporaryPassword(),
        role: 'USER',
        isActive: true,
        packageId: customerData.packageId
      })

      // TODO: Send welcome email if requested
      if (customerData.sendWelcomeEmail) {
        // Implementation for sending welcome email
        console.log('Sending welcome email to:', customerData.email)
      }

      setShowOnboardingModal(false)
      refetch()
    } catch (error) {
      console.error('Failed to onboard customer:', error)
      throw error
    }
  }

  const generateTemporaryPassword = () => {
    // Generate a secure temporary password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    
    try {
      await deleteUser(id)
      refetch()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete', data?: any) => {
    if (selectedUsers.length === 0) return

    try {
      if (action === 'delete') {
        // Delete users one by one (bulk delete not implemented for safety)
        for (const userId of selectedUsers) {
          await deleteUser(userId)
        }
      } else {
        await bulkUpdateUsers(selectedUsers, {
          isActive: action === 'activate',
          deactivationReason: action === 'deactivate' ? (data?.deactivationReason || 'Bulk deactivation') : undefined
        })
      }
      setSelectedUsers([])
      refetch()
    } catch (error) {
      console.error(`Failed to ${action} users:`, error)
      throw error // Re-throw to let the component handle the error
    }
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN:
        return 'red'
      case UserRole.ADMIN:
        return 'purple'
      case UserRole.SUPPORT:
        return 'blue'
      case UserRole.USER:
        return 'green'
      default:
        return 'gray'
    }
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'green' : 'gray'
  }

  const getPageTitle = () => {
    switch (currentUserRole) {
      case UserRole.SUPERADMIN:
        return 'Platform Users'
      case UserRole.ADMIN:
        return 'Customer Management'
      case UserRole.USER:
        return 'My Profile'
      default:
        return 'Users'
    }
  }

  const getPageDescription = () => {
    switch (currentUserRole) {
      case UserRole.SUPERADMIN:
        return 'Manage all users across the platform'
      case UserRole.ADMIN:
        return 'Manage your customers and package assignments'
      case UserRole.USER:
        return 'View and manage your profile information'
      default:
        return 'User management'
    }
  }

  const canCreateUsers = currentUserRole === UserRole.SUPERADMIN || currentUserRole === UserRole.ADMIN
  const canDeleteUsers = currentUserRole === UserRole.SUPERADMIN
  const canBulkEdit = currentUserRole === UserRole.SUPERADMIN || currentUserRole === UserRole.ADMIN

  const columns = [
    ...(canBulkEdit ? [{
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedUsers.length === users.length && users.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedUsers(users.map(u => u.id))
            } else {
              setSelectedUsers([])
            }
          }}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      ),
      render: (user: UserWithDetails) => (
        <input
          type="checkbox"
          checked={selectedUsers.includes(user.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedUsers(prev => [...prev, user.id])
            } else {
              setSelectedUsers(prev => prev.filter(id => id !== user.id))
            }
          }}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      )
    }] : []),
    {
      key: 'user',
      label: 'User',
      sortable: true,
      render: (user: UserWithDetails) => (
        <div>
          <div className="font-medium text-gray-900">{user.email}</div>
          {(user.firstName || user.lastName || user.name) && (
            <div className="text-sm text-gray-500">
              {user.name || [user.firstName, user.lastName].filter(Boolean).join(' ')}
            </div>
          )}
          {currentUserRole === UserRole.SUPERADMIN && (
            <div className="text-xs text-gray-400">
              {user.tenant.name} ({user.tenant.subdomain})
            </div>
          )}
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (user: UserWithDetails) => (
        <Badge color={getRoleColor(user.role)}>
          {user.role.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (user: UserWithDetails) => (
        <div>
          <Badge color={getStatusColor(user.isActive)}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {!user.isActive && user.deactivationReason && (
            <div className="text-xs text-gray-500 mt-1">
              {user.deactivationReason}
            </div>
          )}
        </div>
      )
    },
    ...(currentUserRole === UserRole.ADMIN ? [{
      key: 'packages',
      label: 'Packages',
      render: (user: UserWithDetails) => (
        <div className="flex flex-wrap gap-1">
          {user.packagePurchases?.slice(0, 2).map((purchase) => (
            <Badge key={purchase.id} color="blue" size="sm">
              {purchase.package.name}
            </Badge>
          ))}
          {(user.packagePurchases?.length || 0) > 2 && (
            <Badge color="gray" size="sm">
              +{(user.packagePurchases?.length || 0) - 2} more
            </Badge>
          )}
          {(!user.packagePurchases || user.packagePurchases.length === 0) && (
            <span className="text-sm text-gray-400">No packages</span>
          )}
        </div>
      )
    }] : []),
    {
      key: 'activity',
      label: 'Activity',
      render: (user: UserWithDetails) => (
        <div className="text-sm text-gray-600">
          {user._count?.assignedTickets || 0} assigned tickets
          {user._count?.requestedTickets ? `, ${user._count.requestedTickets} requests` : ''}
        </div>
      )
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (user: UserWithDetails) => (
        <div className="text-sm text-gray-600">
          {new Date(user.createdAt).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: UserWithDetails) => (
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
                setSelectedUser(user)
                // Navigate to user detail page or show detail modal
              }
            },
            {
              label: 'Edit',
              onClick: () => {
                setSelectedUser(user)
                setShowEditModal(true)
              }
            },
            ...(user.isActive ? [{
              label: 'Deactivate',
              onClick: () => handleUpdateUser({ isActive: false, deactivationReason: 'Manually deactivated' })
            }] : [{
              label: 'Activate',
              onClick: () => handleUpdateUser({ isActive: true })
            }]),
            ...(canDeleteUsers ? [{
              label: 'Delete',
              onClick: () => handleDeleteUser(user.id),
              className: 'text-red-600'
            }] : [])
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
          <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600">{getPageDescription()}</p>
        </div>
        <div className="flex gap-2">
          {canCreateUsers && (
            <>
              {currentUserRole === UserRole.ADMIN && (
                <Button 
                  variant="outline"
                  onClick={() => setShowOnboardingModal(true)}
                >
                  Onboard Customer
                </Button>
              )}
              <Button onClick={() => setShowCreateModal(true)}>
                {currentUserRole === UserRole.ADMIN ? 'Add Customer' : 'Add User'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <UserStats stats={stats} />

      {/* Bulk Actions */}
      {canBulkEdit && (
        <BulkUserActions
          selectedUserIds={selectedUsers}
          onBulkAction={handleBulkAction}
          onClearSelection={() => setSelectedUsers([])}
          canDelete={canDeleteUsers}
        />
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="min-w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            >
              <option value="">All Roles</option>
              {currentUserRole === UserRole.SUPERADMIN && (
                <option value={UserRole.SUPERADMIN}>Super Admin</option>
              )}
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.SUPPORT}>Support</option>
            </select>
          </div>
          <div className="min-w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter.toString()}
              onChange={(e) => setStatusFilter(e.target.value === '' ? '' : e.target.value === 'true')}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          {currentUserRole === UserRole.ADMIN && availablePackages.length > 0 && (
            <div className="min-w-48">
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                <option value="">All Packages</option>
                {availablePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          data={users}
          loading={loading}
          error={error}
          emptyMessage={`No users found. ${canCreateUsers ? `Click '${currentUserRole === UserRole.ADMIN ? 'Add Customer' : 'Add User'}' to get started.` : ''}`}
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
        title={currentUserRole === UserRole.ADMIN ? 'Add New Customer' : 'Add New User'}
        size="lg"
      >
        <UserForm
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateModal(false)}
          availablePackages={availablePackages}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedUser(null)
        }}
        title="Edit User"
        size="lg"
      >
        {selectedUser && (
          <UserForm
            initialData={selectedUser}
            onSubmit={handleUpdateUser}
            onCancel={() => {
              setShowEditModal(false)
              setSelectedUser(null)
            }}
            availablePackages={availablePackages}
          />
        )}
      </Modal>

      {/* Customer Onboarding Modal */}
      <CustomerOnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleCustomerOnboarding}
        availablePackages={availablePackages}
      />
    </div>
  )
}