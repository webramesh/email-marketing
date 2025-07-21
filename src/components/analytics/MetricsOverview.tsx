'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';

interface MetricsOverviewProps {
  metrics: {
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
}

export function MetricsOverview({ metrics }: MetricsOverviewProps) {
  const metricCards = [
    {
      title: 'Total Campaigns',
      value: metrics.totalCampaigns.toLocaleString(),
      subtitle: `${metrics.activeCampaigns} active`,
      icon: '📧',
      color: 'blue',
    },
    {
      title: 'Subscribers',
      value: metrics.totalSubscribers.toLocaleString(),
      subtitle: `${metrics.activeSubscribers} active`,
      icon: '👥',
      color: 'green',
    },
    {
      title: 'Emails Sent',
      value: metrics.totalSent.toLocaleString(),
      subtitle: `${metrics.totalDelivered.toLocaleString()} delivered`,
      icon: '📤',
      color: 'purple',
    },
    {
      title: 'Delivery Rate',
      value: `${metrics.deliveryRate}%`,
      subtitle: 'Last 30 days',
      icon: '✅',
      color: 'green',
    },
    {
      title: 'Open Rate',
      value: `${metrics.openRate}%`,
      subtitle: `${metrics.totalOpened.toLocaleString()} opens`,
      icon: '👁️',
      color: 'blue',
    },
    {
      title: 'Click Rate',
      value: `${metrics.clickRate}%`,
      subtitle: `${metrics.totalClicked.toLocaleString()} clicks`,
      icon: '🖱️',
      color: 'orange',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      orange: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {metricCards.map((metric, index) => (
        <Card key={index} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${getColorClasses(metric.color)}`}>
              {metric.icon}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{metric.title}</p>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-xs text-gray-500">{metric.subtitle}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}