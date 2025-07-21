'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
}

export function CampaignComparison() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock campaign data - in real app, fetch from API
    setCampaigns([
      {
        id: '1',
        name: 'Welcome Series #1',
        subject: 'Welcome to our platform!',
        status: 'SENT',
        sentAt: '2024-01-15T10:00:00Z',
      },
      {
        id: '2',
        name: 'Product Launch',
        subject: 'Introducing our new product',
        status: 'SENT',
        sentAt: '2024-01-20T14:30:00Z',
      },
      {
        id: '3',
        name: 'Monthly Newsletter',
        subject: 'January Newsletter',
        status: 'SENT',
        sentAt: '2024-01-25T09:00:00Z',
      },
      {
        id: '4',
        name: 'Flash Sale Alert',
        subject: '24-hour flash sale!',
        status: 'SENT',
        sentAt: '2024-01-28T16:00:00Z',
      },
      {
        id: '5',
        name: 'Customer Survey',
        subject: 'Help us improve',
        status: 'SENT',
        sentAt: '2024-02-01T11:00:00Z',
      },
    ]);
  }, []);

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev => {
      if (prev.includes(campaignId)) {
        return prev.filter(id => id !== campaignId);
      } else if (prev.length < 5) {
        return [...prev, campaignId];
      }
      return prev;
    });
  };

  const handleCompare = async () => {
    if (selectedCampaigns.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/analytics/campaigns/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignIds: selectedCampaigns }),
      });

      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      } else {
        // Mock data for demonstration
        const mockData: CampaignMetrics[] = selectedCampaigns.map(id => {
          const campaign = campaigns.find(c => c.id === id);
          return {
            campaignId: id,
            campaignName: campaign?.name || 'Unknown',
            totalSent: Math.floor(Math.random() * 3000) + 1000,
            totalDelivered: Math.floor(Math.random() * 2800) + 950,
            totalOpened: Math.floor(Math.random() * 1200) + 300,
            totalClicked: Math.floor(Math.random() * 400) + 50,
            totalUnsubscribed: Math.floor(Math.random() * 20) + 2,
            totalBounced: Math.floor(Math.random() * 100) + 10,
            totalComplained: Math.floor(Math.random() * 10) + 1,
            deliveryRate: Math.random() * 10 + 90,
            openRate: Math.random() * 30 + 20,
            clickRate: Math.random() * 15 + 5,
            unsubscribeRate: Math.random() * 2 + 0.5,
            bounceRate: Math.random() * 5 + 2,
          };
        });
        setComparisonData(mockData);
      }
    } catch (error) {
      console.error('Failed to fetch comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (value: number, metric: string) => {
    if (metric === 'deliveryRate') {
      return value >= 95 ? 'text-green-600' : value >= 90 ? 'text-yellow-600' : 'text-red-600';
    } else if (metric === 'openRate') {
      return value >= 40 ? 'text-green-600' : value >= 25 ? 'text-yellow-600' : 'text-red-600';
    } else if (metric === 'clickRate') {
      return value >= 15 ? 'text-green-600' : value >= 8 ? 'text-yellow-600' : 'text-red-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Campaign Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Campaigns to Compare</h3>
            <p className="text-sm text-gray-600">Choose up to 5 campaigns for comparison</p>
          </div>
          <Button
            onClick={handleCompare}
            disabled={selectedCampaigns.length === 0 || loading}
          >
            {loading ? 'Comparing...' : `Compare ${selectedCampaigns.length} Campaign${selectedCampaigns.length !== 1 ? 's' : ''}`}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedCampaigns.includes(campaign.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleCampaignToggle(campaign.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{campaign.name}</p>
                  <p className="text-sm text-gray-600 truncate">{campaign.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {campaign.sentAt ? new Date(campaign.sentAt).toLocaleDateString() : 'Not sent'}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedCampaigns.includes(campaign.id)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedCampaigns.includes(campaign.id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Campaign Comparison Results</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Open Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Click Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unsubscribe Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bounce Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {comparisonData.map((campaign) => (
                  <tr key={campaign.campaignId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {campaign.campaignName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.totalSent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getMetricColor(campaign.deliveryRate, 'deliveryRate')}`}>
                        {campaign.deliveryRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getMetricColor(campaign.openRate, 'openRate')}`}>
                        {campaign.openRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getMetricColor(campaign.clickRate, 'clickRate')}`}>
                        {campaign.clickRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.unsubscribeRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.bounceRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {(comparisonData.reduce((sum, c) => sum + c.deliveryRate, 0) / comparisonData.length).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg. Delivery Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(comparisonData.reduce((sum, c) => sum + c.openRate, 0) / comparisonData.length).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg. Open Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(comparisonData.reduce((sum, c) => sum + c.clickRate, 0) / comparisonData.length).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg. Click Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {comparisonData.reduce((sum, c) => sum + c.totalSent, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Sent</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}