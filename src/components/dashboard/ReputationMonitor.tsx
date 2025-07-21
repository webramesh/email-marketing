'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ReputationMetrics {
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
  totalSent: number;
  totalBounced: number;
  totalComplaints: number;
  totalUnsubscribed: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export function ReputationMonitor() {
  const [metrics, setMetrics] = useState<ReputationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchMetrics();
  }, [days]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reputation?days=${days}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error fetching reputation metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">Unable to load reputation metrics</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Email Reputation</h3>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {formatPercentage(metrics.bounceRate)}
          </div>
          <div className="text-sm text-gray-600">Bounce Rate</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.totalBounced} of {metrics.totalSent}
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {formatPercentage(metrics.complaintRate)}
          </div>
          <div className="text-sm text-gray-600">Complaint Rate</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.totalComplaints} of {metrics.totalSent}
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {formatPercentage(metrics.unsubscribeRate)}
          </div>
          <div className="text-sm text-gray-600">Unsubscribe Rate</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.totalUnsubscribed} of {metrics.totalSent}
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {metrics.totalSent.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Sent</div>
          <div className="text-xs text-gray-500 mt-1">
            Last {days} days
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium">Risk Assessment</h4>
        <Badge variant={getRiskColor(metrics.riskLevel)}>
          {metrics.riskLevel.toUpperCase()} RISK
        </Badge>
      </div>

      <div className="space-y-2">
        {metrics.recommendations.map((recommendation, index) => (
          <div key={index} className="flex items-start gap-2 text-sm">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <span>{recommendation}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">Industry Benchmarks</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Bounce Rate:</span>
            <div className="font-medium">{'< 2%'} Good, {'< 5%'} Acceptable</div>
          </div>
          <div>
            <span className="text-gray-600">Complaint Rate:</span>
            <div className="font-medium">{'< 0.1%'} Good, {'< 0.5%'} Acceptable</div>
          </div>
          <div>
            <span className="text-gray-600">Unsubscribe Rate:</span>
            <div className="font-medium">{'< 2%'} Good, {'< 5%'} Acceptable</div>
          </div>
        </div>
      </div>
    </Card>
  );
}