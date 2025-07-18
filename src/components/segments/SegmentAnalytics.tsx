'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SegmentAnalytics as SegmentAnalyticsType } from '@/services/segment.service'

interface SegmentAnalyticsProps {
  analytics: SegmentAnalyticsType
  onRefresh: () => void
  isLoading?: boolean
}

export const SegmentAnalytics: React.FC<SegmentAnalyticsProps> = ({
  analytics,
  onRefresh,
  isLoading = false
}) => {
  const { segment, performance, subscriberGrowth, engagementTrends } = analytics

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`
  }

  const formatNumber = (value: number): string => {
    return value.toLocaleString()
  }

  const getPerformanceColor = (value: number, thresholds: { good: number; fair: number }): string => {
    if (value >= thresholds.good) return 'text-green-600'
    if (value >= thresholds.fair) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getGrowthTrend = (): { direction: 'up' | 'down' | 'stable'; percentage: number } => {
    if (subscriberGrowth.length < 2) return { direction: 'stable', percentage: 0 }
    
    const recent = subscriberGrowth[subscriberGrowth.length - 1].count
    const previous = subscriberGrowth[subscriberGrowth.length - 2].count
    
    if (recent > previous) {
      const percentage = ((recent - previous) / previous) * 100
      return { direction: 'up', percentage }
    } else if (recent < previous) {
      const percentage = ((previous - recent) / previous) * 100
      return { direction: 'down', percentage }
    }
    
    return { direction: 'stable', percentage: 0 }
  }

  const growthTrend = getGrowthTrend()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{segment.name} Analytics</h1>
          <p className="text-gray-600">{segment.description || 'Segment performance metrics'}</p>
        </div>
        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(performance.totalSubscribers)}
              </p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm ${
                growthTrend.direction === 'up' ? 'text-green-600' : 
                growthTrend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {growthTrend.direction === 'up' && '↗'}
                {growthTrend.direction === 'down' && '↘'}
                {growthTrend.direction === 'stable' && '→'}
                {growthTrend.percentage > 0 && `${growthTrend.percentage.toFixed(1)}%`}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Subscribers</p>
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(performance.activeSubscribers)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {performance.totalSubscribers > 0 
                ? `${((performance.activeSubscribers / performance.totalSubscribers) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
            <p className={`text-2xl font-bold ${getPerformanceColor(performance.engagementRate, { good: 20, fair: 10 })}`}>
              {formatPercentage(performance.engagementRate)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Opens + Clicks</p>
          </div>
        </Card>

        <Card className="p-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Open Rate</p>
            <p className={`text-2xl font-bold ${getPerformanceColor(performance.openRate, { good: 25, fair: 15 })}`}>
              {formatPercentage(performance.openRate)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </div>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Click Rate</span>
              <Badge 
                variant="secondary" 
                className={getPerformanceColor(performance.clickRate, { good: 3, fair: 1.5 })}
              >
                {formatPercentage(performance.clickRate)}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Unsubscribe Rate</span>
              <Badge 
                variant="secondary" 
                className={performance.unsubscribeRate > 2 ? 'text-red-600' : 'text-green-600'}
              >
                {formatPercentage(performance.unsubscribeRate)}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Bounce Rate</span>
              <Badge 
                variant="secondary" 
                className={performance.bounceRate > 5 ? 'text-red-600' : 'text-green-600'}
              >
                {formatPercentage(performance.bounceRate)}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Segment Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Segment Size</span>
              <Badge variant="primary">
                {performance.totalSubscribers < 100 ? 'Small' :
                 performance.totalSubscribers < 1000 ? 'Medium' : 'Large'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Activity Level</span>
              <Badge variant="secondary">
                {performance.engagementRate > 20 ? 'High' :
                 performance.engagementRate > 10 ? 'Medium' : 'Low'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="text-sm text-gray-900">
                {new Date(performance.lastCalculated).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Growth Chart Placeholder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscriber Growth (Last 30 Days)</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <p className="text-sm">Growth chart visualization</p>
            <p className="text-xs mt-1">
              {subscriberGrowth.length > 0 
                ? `${subscriberGrowth.length} data points available`
                : 'No growth data available'
              }
            </p>
          </div>
        </div>
      </Card>

      {/* Engagement Trends */}
      {engagementTrends.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Engagement Activity</h3>
          <div className="space-y-3">
            {engagementTrends.slice(-7).map((trend, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-600">
                  {new Date(trend.date).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-blue-600">{trend.opens} opens</span>
                  <span className="text-green-600">{trend.clicks} clicks</span>
                  {trend.unsubscribes > 0 && (
                    <span className="text-red-600">{trend.unsubscribes} unsubscribes</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Recommendations</h3>
        <div className="space-y-2 text-sm text-blue-800">
          {performance.openRate < 15 && (
            <p>• Consider improving subject lines to increase open rates</p>
          )}
          {performance.clickRate < 2 && (
            <p>• Add more compelling calls-to-action to improve click rates</p>
          )}
          {performance.unsubscribeRate > 2 && (
            <p>• Review email frequency and content relevance to reduce unsubscribes</p>
          )}
          {performance.bounceRate > 5 && (
            <p>• Clean your email list to reduce bounce rates</p>
          )}
          {performance.totalSubscribers < 100 && (
            <p>• Consider expanding your segment criteria to reach more subscribers</p>
          )}
        </div>
      </Card>
    </div>
  )
}