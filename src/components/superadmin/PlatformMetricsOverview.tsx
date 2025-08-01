'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

interface PlatformMetrics {
  totalTenants: number
  activeTenants: number
  totalUsers: number
  totalCampaigns: number
  totalEmailsSent: number
  totalRevenue: number
  monthlyGrowth: {
    tenants: number
    users: number
    revenue: number
  }
}

export function PlatformMetricsOverview() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/superadmin/platform-metrics')
      const result = await response.json()
      
      if (result.success) {
        setMetrics(result.data)
      } else {
        setError(result.error || 'Failed to fetch metrics')
      }
    } catch (err) {
      setError('Failed to fetch platform metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading platform metrics</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button 
            onClick={fetchMetrics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </Card>
    )
  }

  if (!metrics) return null

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : ''
    const color = growth >= 0 ? 'text-green-600' : 'text-red-600'
    return (
      <span className={`text-sm ${color}`}>
        {sign}{growth.toFixed(1)}%
      </span>
    )
  }

  const metricCards = [
    {
      title: 'Total Tenants',
      value: formatNumber(metrics.totalTenants),
      growth: metrics.monthlyGrowth.tenants,
      icon: '🏢'
    },
    {
      title: 'Active Tenants',
      value: formatNumber(metrics.activeTenants),
      subtitle: `${((metrics.activeTenants / metrics.totalTenants) * 100).toFixed(1)}% active`,
      icon: '✅'
    },
    {
      title: 'Total Users',
      value: formatNumber(metrics.totalUsers),
      growth: metrics.monthlyGrowth.users,
      icon: '👥'
    },
    {
      title: 'Total Campaigns',
      value: formatNumber(metrics.totalCampaigns),
      icon: '📧'
    },
    {
      title: 'Emails Sent',
      value: formatNumber(metrics.totalEmailsSent),
      icon: '📤'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      growth: metrics.monthlyGrowth.revenue,
      icon: '💰'
    },
    {
      title: 'Avg Revenue/Tenant',
      value: formatCurrency(metrics.totalRevenue / metrics.totalTenants),
      icon: '📊'
    },
    {
      title: 'Avg Emails/Campaign',
      value: formatNumber(metrics.totalEmailsSent / (metrics.totalCampaigns || 1)),
      icon: '📈'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Platform Overview</h2>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{metric.icon}</span>
              {metric.growth !== undefined && formatGrowth(metric.growth)}
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              {metric.title}
            </h3>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {metric.value}
            </p>
            {metric.subtitle && (
              <p className="text-xs text-gray-500">
                {metric.subtitle}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}