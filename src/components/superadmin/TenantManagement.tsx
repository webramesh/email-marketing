'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

interface TenantOverview {
  id: string
  name: string
  subdomain: string
  customDomain?: string | null
  userCount: number
  campaignCount: number
  subscriberCount: number
  emailsSent: number
  revenue: number
  status: 'active' | 'suspended' | 'inactive'
  createdAt: string
  subscriptionPlan?: {
    name: string
    price: number
  }
}

interface TenantsData {
  tenants: TenantOverview[]
  total: number
  totalPages: number
}

export function TenantManagement() {
  const [tenantsData, setTenantsData] = useState<TenantsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchTenants()
  }, [currentPage, search, statusFilter])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })
      
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/superadmin/tenants?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setTenantsData(result.data)
      } else {
        setError(result.error || 'Failed to fetch tenants')
      }
    } catch (err) {
      setError('Failed to fetch tenants')
    } finally {
      setLoading(false)
    }
  }

  const handleTenantAction = async (tenantId: string, action: 'suspend' | 'activate' | 'delete') => {
    if (action === 'delete' && !confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(tenantId)
      
      const method = action === 'delete' ? 'DELETE' : 'PATCH'
      const body = action !== 'delete' ? JSON.stringify({ action }) : undefined

      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method,
        headers: action !== 'delete' ? {
          'Content-Type': 'application/json'
        } : undefined,
        body
      })
      
      const result = await response.json()
      
      if (result.success) {
        fetchTenants() // Refresh the list
      } else {
        alert(result.error || `Failed to ${action} tenant`)
      }
    } catch (err) {
      alert(`Failed to ${action} tenant`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.inactive}>
        {status}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading && !tenantsData) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading tenants</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Button onClick={fetchTenants} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Tenant Management</h2>
        <Button onClick={fetchTenants} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchTenants()}
            />
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Button onClick={fetchTenants}>
            Search
          </Button>
        </div>
      </Card>

      {/* Tenants Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaigns
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscribers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenantsData?.tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {tenant.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {tenant.customDomain || `${tenant.subdomain}.example.com`}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(tenant.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.userCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.campaignCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.subscriberCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(tenant.revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.subscriptionPlan?.name || 'Free'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(tenant.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {tenant.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTenantAction(tenant.id, 'suspend')}
                          disabled={actionLoading === tenant.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          {actionLoading === tenant.id ? 'Loading...' : 'Suspend'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTenantAction(tenant.id, 'activate')}
                          disabled={actionLoading === tenant.id}
                          className="text-green-600 hover:text-green-700"
                        >
                          {actionLoading === tenant.id ? 'Loading...' : 'Activate'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTenantAction(tenant.id, 'delete')}
                        disabled={actionLoading === tenant.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        {actionLoading === tenant.id ? 'Loading...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {tenantsData && tenantsData.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentPage(Math.min(tenantsData.totalPages, currentPage + 1))}
                disabled={currentPage === tenantsData.totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{tenantsData.totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    className="rounded-r-none"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(Math.min(tenantsData.totalPages, currentPage + 1))}
                    disabled={currentPage === tenantsData.totalPages}
                    variant="outline"
                    className="rounded-l-none"
                  >
                    Next
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}