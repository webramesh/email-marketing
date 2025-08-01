'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface RevenueMetrics {
  totalRevenue: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  churnRate: number
  revenueByPlan: Array<{
    planName: string
    revenue: number
    subscribers: number
  }>
  revenueGrowth: Array<{
    month: string
    revenue: number
    growth: number
  }>
}

export function RevenueTracker() {
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRevenue()
  }, [])

  const fetchRevenue = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/superadmin/revenue')
      const result = await response.json()
      
      if (result.success) {
        setRevenue(result.data)
      } else {
        setError(result.error || 'Failed to fetch revenue metrics')
      }
    } catch (err) {
      setError('Failed to fetch revenue metrics')
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading revenue metrics</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Button onClick={fetchRevenue} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!revenue) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
        <Button onClick={fetchRevenue} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">💰</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(revenue.totalRevenue)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📈</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Monthly Recurring Revenue</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(revenue.monthlyRecurringRevenue)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">👤</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Average Revenue Per User</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(revenue.averageRevenuePerUser)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📉</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Churn Rate</h3>
          <p className="text-2xl font-bold text-gray-900">
            {revenue.churnRate.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Revenue by Plan */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscribers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Revenue/Subscriber
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenue.revenueByPlan.map((plan, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {plan.planName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.subscribers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(plan.revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(plan.subscribers > 0 ? plan.revenue / plan.subscribers : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revenue Growth */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Growth Trend</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Growth
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenue.revenueGrowth.map((month, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(month.month).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(month.revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatGrowth(month.growth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}