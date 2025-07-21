'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface TriggerStats {
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  executionsByTrigger: Record<string, number>;
}

export interface TriggerMonitorProps {
  /**
   * Automation ID to monitor (optional, monitors all if not provided)
   */
  automationId?: string;
  
  /**
   * Refresh interval in milliseconds
   */
  refreshInterval?: number;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Trigger monitoring component for tracking automation executions
 */
export function TriggerMonitor({
  automationId,
  refreshInterval = 30000, // 30 seconds
  className,
}: TriggerMonitorProps) {
  const [stats, setStats] = useState<TriggerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch trigger statistics
  const fetchStats = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (automationId) {
        params.set('automationId', automationId);
      }

      const response = await fetch(`/api/automations/triggers/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trigger stats');
      }

      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up auto-refresh
  useEffect(() => {
    fetchStats();
    
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [automationId, refreshInterval]);

  // Manual refresh
  const handleRefresh = () => {
    setIsLoading(true);
    fetchStats();
  };

  if (isLoading && !stats) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-secondary-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-secondary-200 rounded w-3/4"></div>
                <div className="h-6 bg-secondary-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Failed to Load Stats
          </h3>
          <p className="text-secondary-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="secondary">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const triggerTypeNames: Record<string, string> = {
    SUBSCRIPTION: 'New Subscriptions',
    DATE_BASED: 'Date/Time',
    EMAIL_OPENED: 'Email Opens',
    EMAIL_CLICKED: 'Email Clicks',
    LIST_JOINED: 'List Joins',
    CUSTOM_FIELD_CHANGED: 'Field Changes',
    API_TRIGGERED: 'API Triggers',
    EVENT_DRIVEN: 'Events',
    BEHAVIOR_BASED: 'Behaviors',
  };

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-secondary-900">
            Trigger Monitoring
          </h3>
          {lastUpdated && (
            <p className="text-sm text-secondary-600">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <Button
          onClick={handleRefresh}
          variant="secondary"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-secondary-900">
            {stats.totalExecutions.toLocaleString()}
          </div>
          <div className="text-sm text-secondary-600">Total Executions</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats.activeExecutions.toLocaleString()}
          </div>
          <div className="text-sm text-secondary-600">Active</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats.completedExecutions.toLocaleString()}
          </div>
          <div className="text-sm text-secondary-600">Completed</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {stats.failedExecutions.toLocaleString()}
          </div>
          <div className="text-sm text-secondary-600">Failed</div>
        </div>
      </div>

      {/* Success Rate */}
      {stats.totalExecutions > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-secondary-700">Success Rate</span>
            <span className="text-sm text-secondary-600">
              {Math.round((stats.completedExecutions / stats.totalExecutions) * 100)}%
            </span>
          </div>
          <div className="w-full bg-secondary-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(stats.completedExecutions / stats.totalExecutions) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Executions by Trigger Type */}
      {Object.keys(stats.executionsByTrigger).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-secondary-700 mb-3">
            Executions by Trigger Type
          </h4>
          <div className="space-y-2">
            {Object.entries(stats.executionsByTrigger)
              .sort(([, a], [, b]) => b - a)
              .map(([triggerType, count]) => (
                <div key={triggerType} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" size="sm">
                      {triggerTypeNames[triggerType] || triggerType}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-secondary-900">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.totalExecutions === 0 && (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            No Executions Yet
          </h3>
          <p className="mt-1 text-sm text-secondary-500">
            Automation executions will appear here once triggers are activated.
          </p>
        </div>
      )}
    </Card>
  );
}