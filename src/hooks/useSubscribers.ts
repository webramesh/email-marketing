'use client'

import { useState, useEffect, useCallback } from 'react'
import { SubscriberStatus, type SubscriberWithDetails, type PaginatedResponse } from '@/types'

interface UseSubscribersOptions {
  page?: number
  limit?: number
  search?: string
  status?: SubscriberStatus
  sortBy?: 'email' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

interface SubscriberStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
  complained: number
  invalid: number
}

export function useSubscribers(options: UseSubscribersOptions = {}) {
  const [subscribers, setSubscribers] = useState<SubscriberWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<PaginatedResponse<any>['meta'] | null>(null)
  const [stats, setStats] = useState<SubscriberStats | null>(null)

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.page) params.append('page', options.page.toString())
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.search) params.append('search', options.search)
      if (options.status) params.append('status', options.status)
      if (options.sortBy) params.append('sortBy', options.sortBy)
      if (options.sortOrder) params.append('sortOrder', options.sortOrder)

      const response = await fetch(`/api/subscribers?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400 && result.error?.includes('Tenant context not found')) {
          throw new Error('Unable to load tenant data. Please refresh the page or contact support.')
        }
        throw new Error(result.error || 'Failed to fetch subscribers')
      }

      setSubscribers(result.data || [])
      setMeta(result.meta)
    } catch (err) {
      console.error('Error fetching subscribers:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [options.page, options.limit, options.search, options.status, options.sortBy, options.sortOrder])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/subscribers/stats')
      const result = await response.json()

      if (response.ok) {
        setStats(result.data)
      } else {
        console.error('Failed to fetch subscriber stats:', result.error)
        // Set default stats if API fails
        setStats({
          total: 0,
          active: 0,
          unsubscribed: 0,
          bounced: 0,
          complained: 0,
          invalid: 0
        })
      }
    } catch (err) {
      console.error('Failed to fetch subscriber stats:', err)
      // Set default stats if API fails
      setStats({
        total: 0,
        active: 0,
        unsubscribed: 0,
        bounced: 0,
        complained: 0,
        invalid: 0
      })
    }
  }, [])

  const createSubscriber = async (data: any) => {
    const response = await fetch('/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create subscriber')
    }

    return result.data
  }

  const updateSubscriber = async (id: string, data: any) => {
    const response = await fetch(`/api/subscribers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update subscriber')
    }

    return result.data
  }

  const deleteSubscriber = async (id: string) => {
    const response = await fetch(`/api/subscribers/${id}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete subscriber')
    }

    return result
  }

  const refetch = useCallback(() => {
    fetchSubscribers()
    fetchStats()
  }, [fetchSubscribers, fetchStats])

  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    subscribers,
    loading,
    error,
    meta,
    stats,
    createSubscriber,
    updateSubscriber,
    deleteSubscriber,
    refetch,
  }
}