'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MetricsOverview } from './MetricsOverview';
import { CampaignPerformanceChart } from './CampaignPerformanceChart';
import { GeographicAnalytics } from './GeographicAnalytics';
import { EngagementTimeline } from './EngagementTimeline';
import { CampaignComparison } from './CampaignComparison';

interface DashboardMetrics {
  overview: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalSubscribers: number;
    activeSubscribers: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  timeline: Array<{
    timestamp: string;
    [key: string]: any;
  }>;
  recentActivity: any[];
}

interface AnalyticsDashboardProps {
  tenantId: string;
}

export function AnalyticsDashboard({ tenantId }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'geographic' | 'engagement'>('overview');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchDashboardMetrics = async () => {
    try {
      const response = await fetch('/api/analytics/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardMetrics, 30000);
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardMetrics();
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error loading analytics</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">
          No analytics data available
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Real-time insights into your email marketing performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Live data
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <MetricsOverview metrics={metrics.overview} />

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'campaigns', label: 'Campaigns' },
            { key: 'geographic', label: 'Geographic' },
            { key: 'engagement', label: 'Engagement' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <EngagementTimeline timeline={metrics.timeline} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CampaignPerformanceChart />
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {metrics.recentActivity.length > 0 ? (
                    metrics.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${
                            activity.type === 'OPENED' ? 'bg-blue-500' :
                            activity.type === 'CLICKED' ? 'bg-green-500' :
                            activity.type === 'UNSUBSCRIBED' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}></div>
                          <span className="text-sm text-gray-900">
                            {activity.type.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No recent activity</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {activeTab === 'campaigns' && (
          <CampaignComparison />
        )}

        {activeTab === 'geographic' && (
          <GeographicAnalytics />
        )}

        {activeTab === 'engagement' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Engagement Trends</h3>
              <p className="text-gray-600">Engagement trend analysis coming soon...</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Subscriber Cohorts</h3>
              <p className="text-gray-600">Cohort analysis coming soon...</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}