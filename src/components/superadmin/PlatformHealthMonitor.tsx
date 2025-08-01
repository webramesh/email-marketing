'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface PlatformHealthMetrics {
  systemHealth: {
    database: {
      status: 'healthy' | 'degraded' | 'down'
      responseTime: number
      connections: number
    }
    redis: {
      status: 'healthy' | 'degraded' | 'down'
      responseTime: number
      memory: number
    }
    queue: {
      status: 'healthy' | 'degraded' | 'down'
      activeJobs: number
      failedJobs: number
      completedJobs: number
    }
  }
  performance: {
    avgResponseTime: number
    errorRate: number
    throughput: number
  }
}

export function PlatformHealthMonitor() {
  const [health, setHealth] = useState<PlatformHealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchHealth()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchHealth = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/superadmin/platform-health')
      const result = await response.json()
      
      if (result.success) {
        setHealth(result.data)
        setLastUpdated(new Date())
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch health metrics')
      }
    } catch (err) {
      setError('Failed to fetch platform health')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100'
      case 'down':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅'
      case 'degraded':
        return '⚠️'
      case 'down':
        return '❌'
      default:
        return '❓'
    }
  }

  if (loading && !health) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error && !health) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading platform health</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Button onClick={fetchHealth} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!health) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Platform Health</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={fetchHealth} variant="outline" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Health */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Database</h3>
            <span className="text-2xl">{getStatusIcon(health.systemHealth.database.status)}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.systemHealth.database.status)}`}>
                {health.systemHealth.database.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Response Time</span>
              <span className="text-sm font-medium">{health.systemHealth.database.responseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connections</span>
              <span className="text-sm font-medium">{health.systemHealth.database.connections}</span>
            </div>
          </div>
        </Card>

        {/* Redis Health */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Redis Cache</h3>
            <span className="text-2xl">{getStatusIcon(health.systemHealth.redis.status)}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.systemHealth.redis.status)}`}>
                {health.systemHealth.redis.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Response Time</span>
              <span className="text-sm font-medium">{health.systemHealth.redis.responseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Memory Usage</span>
              <span className="text-sm font-medium">{health.systemHealth.redis.memory}MB</span>
            </div>
          </div>
        </Card>

        {/* Queue Health */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Job Queue</h3>
            <span className="text-2xl">{getStatusIcon(health.systemHealth.queue.status)}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health.systemHealth.queue.status)}`}>
                {health.systemHealth.queue.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active Jobs</span>
              <span className="text-sm font-medium">{health.systemHealth.queue.activeJobs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Failed Jobs</span>
              <span className="text-sm font-medium text-red-600">{health.systemHealth.queue.failedJobs}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {health.performance.avgResponseTime}ms
            </div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {health.performance.errorRate}%
            </div>
            <div className="text-sm text-gray-600">Error Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {health.performance.throughput}
            </div>
            <div className="text-sm text-gray-600">Requests/min</div>
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {(health.systemHealth.database.status !== 'healthy' || 
        health.systemHealth.redis.status !== 'healthy' || 
        health.systemHealth.queue.status !== 'healthy' ||
        health.performance.errorRate > 5) && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-2">🚨</span>
            <h3 className="text-lg font-semibold text-red-800">System Alerts</h3>
          </div>
          <div className="space-y-2">
            {health.systemHealth.database.status !== 'healthy' && (
              <div className="text-sm text-red-700">
                ⚠️ Database is {health.systemHealth.database.status}
              </div>
            )}
            {health.systemHealth.redis.status !== 'healthy' && (
              <div className="text-sm text-red-700">
                ⚠️ Redis cache is {health.systemHealth.redis.status}
              </div>
            )}
            {health.systemHealth.queue.status !== 'healthy' && (
              <div className="text-sm text-red-700">
                ⚠️ Job queue is {health.systemHealth.queue.status}
              </div>
            )}
            {health.performance.errorRate > 5 && (
              <div className="text-sm text-red-700">
                ⚠️ High error rate: {health.performance.errorRate}%
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}