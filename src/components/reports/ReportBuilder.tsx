'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface ReportConfig {
  name: string;
  description?: string;
  type: 'campaign' | 'subscriber' | 'engagement' | 'geographic' | 'custom';
  filters: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    campaignIds?: string[];
    subscriberSegments?: string[];
    eventTypes?: string[];
    countries?: string[];
  };
  metrics: string[];
  groupBy?: string[];
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  format: 'json' | 'csv' | 'pdf' | 'excel';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
    enabled: boolean;
  };
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
}

export function ReportBuilder() {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    type: 'campaign',
    filters: {},
    metrics: [],
    format: 'csv',
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Available metrics for each report type
  const availableMetrics = {
    campaign: [
      'campaignName', 'subject', 'totalSent', 'totalDelivered', 'totalOpened', 
      'totalClicked', 'totalUnsubscribed', 'totalBounced', 'deliveryRate', 
      'openRate', 'clickRate', 'sentAt'
    ],
    subscriber: [
      'email', 'firstName', 'lastName', 'status', 'createdAt', 'lastActivity',
      'opens', 'clicks', 'unsubscribes', 'bounces', 'engagementScore', 'lists'
    ],
    engagement: [
      'type', 'createdAt', 'campaignName', 'subscriberEmail', 'ipAddress', 
      'location', 'userAgent'
    ],
    geographic: [
      'country', 'opens', 'clicks', 'unsubscribes', 'uniqueSubscribers', 
      'engagementRate', 'topCities'
    ],
    custom: ['*'],
  };

  const eventTypes = [
    'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'
  ];

  useEffect(() => {
    // Load campaigns for filtering
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      // This would fetch from your campaigns API
      // For now, using mock data
      setCampaigns([
        { id: '1', name: 'Welcome Series', subject: 'Welcome!' },
        { id: '2', name: 'Product Launch', subject: 'New Product Alert' },
        { id: '3', name: 'Newsletter', subject: 'Monthly Update' },
      ]);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  const handleMetricToggle = (metric: string) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric],
    }));
  };

  const handleFilterChange = (filterType: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterType]: value,
      },
    }));
  };

  const handleGenerateReport = async () => {
    if (!config.name || config.metrics.length === 0) {
      alert('Please provide a report name and select at least one metric');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const reportData = await response.json();
        setPreviewData(reportData);
        setShowPreview(true);
      } else {
        throw new Error('Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportConfig: config,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.name}_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to export report');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Report Builder</h1>
          <p className="text-gray-600">Create custom reports with flexible filtering and export options</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Configuration */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Report Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Name *
                </label>
                <Input
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter report name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  value={config.description || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Type *
                </label>
                <select
                  value={config.type}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    type: e.target.value as any,
                    metrics: [] // Reset metrics when type changes
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="campaign">Campaign Performance</option>
                  <option value="subscriber">Subscriber Analytics</option>
                  <option value="engagement">Engagement Timeline</option>
                  <option value="geographic">Geographic Analysis</option>
                  <option value="custom">Custom Query</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Metrics Selection */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Select Metrics *</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableMetrics[config.type].map((metric) => (
                <label key={metric} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.metrics.includes(metric)}
                    onChange={() => handleMetricToggle(metric)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {metric.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Filters</h3>
            
            <div className="space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={config.filters.dateRange?.start?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...config.filters.dateRange,
                      start: new Date(e.target.value),
                    })}
                  />
                  <Input
                    type="date"
                    value={config.filters.dateRange?.end?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...config.filters.dateRange,
                      end: new Date(e.target.value),
                    })}
                  />
                </div>
              </div>

              {/* Campaign Filter */}
              {(config.type === 'campaign' || config.type === 'engagement') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaigns
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                    {campaigns.map((campaign) => (
                      <label key={campaign.id} className="flex items-center space-x-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={config.filters.campaignIds?.includes(campaign.id) || false}
                          onChange={(e) => {
                            const currentIds = config.filters.campaignIds || [];
                            const newIds = e.target.checked
                              ? [...currentIds, campaign.id]
                              : currentIds.filter(id => id !== campaign.id);
                            handleFilterChange('campaignIds', newIds);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{campaign.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Types Filter */}
              {config.type === 'engagement' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Types
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {eventTypes.map((eventType) => (
                      <label key={eventType} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.filters.eventTypes?.includes(eventType) || false}
                          onChange={(e) => {
                            const currentTypes = config.filters.eventTypes || [];
                            const newTypes = e.target.checked
                              ? [...currentTypes, eventType]
                              : currentTypes.filter(type => type !== eventType);
                            handleFilterChange('eventTypes', newTypes);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{eventType}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Actions Panel */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Actions</h3>
            
            <div className="space-y-3">
              <Button
                onClick={handleGenerateReport}
                disabled={loading || !config.name || config.metrics.length === 0}
                className="w-full"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExportReport('csv')}
                  disabled={loading}
                  size="sm"
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExportReport('excel')}
                  disabled={loading}
                  size="sm"
                >
                  Export Excel
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowScheduleModal(true)}
                className="w-full"
              >
                Schedule Report
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Report Summary</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{config.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Metrics:</span>
                <span className="font-medium">{config.metrics.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Filters:</span>
                <span className="font-medium">
                  {Object.keys(config.filters).filter(key => config.filters[key as keyof typeof config.filters]).length}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Report Preview"
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{previewData.metadata.name}</h4>
                <p className="text-sm text-gray-600">
                  {previewData.metadata.totalRecords} records • Generated {new Date(previewData.metadata.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleExportReport('csv')}
                  size="sm"
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExportReport('excel')}
                  size="sm"
                >
                  Export Excel
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-auto border border-gray-200 rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {previewData.data.length > 0 && Object.keys(previewData.data[0]).map((key) => (
                      <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.data.slice(0, 10).map((row: any, index: number) => (
                    <tr key={index}>
                      {Object.values(row).map((value: any, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.data.length > 10 && (
              <p className="text-sm text-gray-600 text-center">
                Showing first 10 of {previewData.metadata.totalRecords} records
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <Modal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          title="Schedule Report"
        >
          <div className="space-y-4">
            <p className="text-gray-600">Schedule this report to run automatically and be delivered via email.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <Input type="time" defaultValue="09:00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Recipients
                </label>
                <Input placeholder="Enter email addresses separated by commas" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowScheduleModal(false)}>
                Schedule Report
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}