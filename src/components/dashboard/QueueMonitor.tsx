'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface AllQueueStats {
  email: QueueStats;
  campaign: QueueStats;
  automation: QueueStats;
  analytics: QueueStats;
}

export function QueueMonitor() {
  const [stats, setStats] = useState<AllQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/queue/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (queueName: string, stats: QueueStats) => {
    if (stats.failed > 10) return 'destructive';
    if (stats.active > 0) return 'warning';
    if (stats.waiting > 0) return 'secondary';
    return 'success';
  };

  const getTotalJobs = (stats: QueueStats) => {
    return stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">Unable to load queue statistics</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Queue Monitor</h3>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchStats}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats).map(([queueName, queueStats]) => (
          <div key={queueName} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium capitalize">{queueName}</h4>
              <Badge variant={getStatusColor(queueName, queueStats)}>
                {queueStats.active > 0 ? 'Active' : 
                 queueStats.waiting > 0 ? 'Waiting' :
                 queueStats.failed > 0 ? 'Failed' : 'Idle'}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Waiting:</span>
                <span className="font-medium">{queueStats.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active:</span>
                <span className="font-medium text-blue-600">{queueStats.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-medium text-green-600">{queueStats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="font-medium text-red-600">{queueStats.failed}</span>
              </div>
              {queueStats.delayed > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delayed:</span>
                  <span className="font-medium text-yellow-600">{queueStats.delayed}</span>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>{getTotalJobs(queueStats)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">Queue Health</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Active Jobs:</span>
            <div className="font-medium text-blue-600">
              {Object.values(stats).reduce((sum, queue) => sum + queue.active, 0)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Total Waiting:</span>
            <div className="font-medium">
              {Object.values(stats).reduce((sum, queue) => sum + queue.waiting, 0)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Total Failed:</span>
            <div className="font-medium text-red-600">
              {Object.values(stats).reduce((sum, queue) => sum + queue.failed, 0)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Success Rate:</span>
            <div className="font-medium text-green-600">
              {(() => {
                const totalCompleted = Object.values(stats).reduce((sum, queue) => sum + queue.completed, 0);
                const totalFailed = Object.values(stats).reduce((sum, queue) => sum + queue.failed, 0);
                const total = totalCompleted + totalFailed;
                return total > 0 ? `${Math.round((totalCompleted / total) * 100)}%` : 'N/A';
              })()}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}