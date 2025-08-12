'use client'

import { useState, useEffect } from 'react'
import { UserRole } from '@/generated/prisma'

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

interface UserStats {
  total: number
  active: number
  inactive: number
  admins: number
  users: number
  customers: number
}

interface UseUsersOptions {
  page?: number
  limit?: number
  search?: string
  role?: UserRole
  isActive?: boolean
  packageId?: string
  hasPackage?: boolean
  sortBy?: 'email' | 'name' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

interface UseUsersReturn {
  users: UserWithDetails[]
  loading: boolean
  error: string | null
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  } | null
  stats: UserStats | null
  createUser: (data: any) => Promise<UserWithDetails>
  updateUser: (id: string, data: any) => Promise<UserWithDetails>
  deleteUser: (id: string) => Promise<void>
  bulkUpdateUsers: (userIds: string[], data: any) => Promise<number>
  refetch: () => void
}

export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const [users, setUsers] = useState<UserWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{
    total: number
    page: number
    limit: number
    totalPages: number
  } | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)

  const buildQueryString = (opts: UseUsersOptions) => {
    const params = new URLSearchParams()
    
    if (opts.page) params.append('page', opts.page.toString())
    if (opts.limit) params.append('limit', opts.limit.toString())
    if (opts.search) params.append('search', opts.search)
    if (opts.role) params.append('role', opts.role)
    if (opts.isActive !== undefined) params.append('isActive', opts.isActive.toString())
    if (opts.packageId) params.append('packageId', opts.packageId)
    if (opts.hasPackage !== undefined) params.append('hasPackage', opts.hasPackage.toString())
    if (opts.sortBy) params.append('sortBy', opts.sortBy)
    if (opts.sortOrder) params.append('sortOrder', opts.sortOrder)
    
    return params.toString()
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryString = buildQueryString(options)
      const response = await fetch(`/api/users?${queryString}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.data)
      setMeta(data.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setUsers([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/users/stats')
      
      if (!response.ok) {
        throw new Error('Failed to fetch user stats')
      }

      const data = await response.json()
      setStats(data.data)
    } catch (err) {
      console.error('Error fetching user stats:', err)
      setStats(null)
    }
  }

  const createUser = async (userData: any): Promise<UserWithDetails> => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create user')
    }

    const data = await response.json()
    return data.data
  }

  const updateUser = async (id: string, userData: any): Promise<UserWithDetails> => {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update user')
    }

    const data = await response.json()
    return data.data
  }

  const deleteUser = async (id: string): Promise<void> => {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete user')
    }
  }

  const bulkUpdateUsers = async (userIds: string[], updateData: any): Promise<number> => {
    const response = await fetch('/api/users/bulk', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds,
        data: updateData,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to perform bulk update')
    }

    const data = await response.json()
    return data.data.updatedCount
  }

  const refetch = () => {
    fetchUsers()
    fetchStats()
  }

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [
    options.page,
    options.limit,
    options.search,
    options.role,
    options.isActive,
    options.packageId,
    options.hasPackage,
    options.sortBy,
    options.sortOrder,
  ])

  return {
    users,
    loading,
    error,
    meta,
    stats,
    createUser,
    updateUser,
    deleteUser,
    bulkUpdateUsers,
    refetch,
  }
}