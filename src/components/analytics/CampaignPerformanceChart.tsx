'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  deliveryRate: number;
}

export function CampaignPerformanceChart() {
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'openRate' | 'clickRate' | 'deliveryRate'>('openRate');

  useEffect(() => {
    // This would typically fetch recent campaign data
    // For now, we'll use mock data
    const mockCampaigns: CampaignPerformance[] = [
      {
        campaignId: '1',
        campaignName: 'Welcome Series #1',
        totalSent: 1500,
        totalDelivered: 1450,
        totalOpened: 580,
        totalClicked: 145,
        openRate: 40.0,
        clickRate: 10.0,
        deliveryRate: 96.7,
      },
      {
        campaignId: '2',
        campaignName: 'Product Launch',
        totalSent: 2200,
        totalDelivered: 2100,
        totalOpened: 945,
        totalClicked: 315,
        openRate: 45.0,
        clickRate: 15.0,
        deliveryRate: 95.5,
      },
      {
        campaignId: '3',
        campaignName: 'Monthly Newsletter',
        totalSent: 3000,
        totalDelivered: 2850,
        totalOpened: 1140,
        totalClicked: 228,
        openRate: 40.0,
        clickRate: 8.0,
        deliveryRate: 95.0,
      },
      {
        campaignId: '4',
        campaignName: 'Flash Sale Alert',
        totalSent: 1800,
        totalDelivered: 1750,
        totalOpened: 875,
        totalClicked: 350,
        openRate: 50.0,
        clickRate: 20.0,
        deliveryRate: 97.2,
      },
      {
        campaignId: '5',
        campaignName: 'Customer Survey',
        totalSent: 1200,
        totalDelivered: 1150,
        totalOpened: 345,
        totalClicked: 69,
        openRate: 30.0,
        clickRate: 6.0,
        deliveryRate: 95.8,
      },
    ];

    setTimeout(() => {
      setCampaigns(mockCampaigns);
      setLoading(false);
    }, 1000);
  }, []);

  const getMetricValue = (campaign: CampaignPerformance) => {
    return campaign[selectedMetric];
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'openRate':
        return 'Open Rate';
      case 'clickRate':
        return 'Click Rate';
      case 'deliveryRate':
        return 'Delivery Rate';
      default:
        return 'Open Rate';
    }
  };

  const getMetricColor = (value: number) => {
    if (selectedMetric === 'deliveryRate') {
      return value >= 95 ? 'bg-green-500' : value >= 90 ? 'bg-yellow-500' : 'bg-red-500';
    } else if (selectedMetric === 'openRate') {
      return value >= 40 ? 'bg-green-500' : value >= 25 ? 'bg-yellow-500' : 'bg-red-500';
    } else { // clickRate
      return value >= 15 ? 'bg-green-500' : value >= 8 ? 'bg-yellow-500' : 'bg-red-500';
    }
  };

  const maxValue = Math.max(...campaigns.map(getMetricValue), 1);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Campaign Performance</h3>
          <p className="text-sm text-gray-600">Top 5 recent campaigns</p>
        </div>
        <div className="flex space-x-2">
          {(['openRate', 'clickRate', 'deliveryRate'] as const).map((metric) => (
            <Button
              key={metric}
              variant={selectedMetric === metric ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedMetric(metric)}
            >
              {metric === 'openRate' ? 'Opens' : metric === 'clickRate' ? 'Clicks' : 'Delivery'}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {campaigns.map((campaign) => {
          const value = getMetricValue(campaign);
          const percentage = (value / maxValue) * 100;

          return (
            <div key={campaign.campaignId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {campaign.campaignName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {campaign.totalSent.toLocaleString()} sent • {campaign.totalDelivered.toLocaleString()} delivered
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {value.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getMetricColor(value)}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Showing {getMetricLabel()}</span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Excellent</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Good</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Needs Improvement</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}