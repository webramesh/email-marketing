'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface JourneyStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executedAt: Date;
  status: 'completed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  error?: string;
  data?: Record<string, any>;
}

export interface SubscriberJourney {
  executionId: string;
  automationId: string;
  automationName: string;
  subscriberId: string;
  subscriberEmail: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  currentStep?: string;
  steps: JourneyStep[];
}

export interface SubscriberJourneyVisualizationProps {
  /**
   * Subscriber ID to show journey for
   */
  subscriberId: string;
  
  /**
   * Automation ID to filter by (optional)
   */
  automationId?: string;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Component for visualizing subscriber journey through automation workflows
 */
export function SubscriberJourneyVisualization({
  subscriberId,
  automationId,
  className,
}: SubscriberJourneyVisualizationProps) {
  const [journeys, setJourneys] = useState<SubscriberJourney[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<SubscriberJourney | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscriber journeys
  const fetchJourneys = async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ subscriberId });
      if (automationId) {
        params.set('automationId', automationId);
      }

      const response = await fetch(`/api/automations/executions/journey?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subscriber journeys');
      }

      const data = await response.json();
      setJourneys(data);
      
      if (data.length > 0 && !selectedJourney) {
        setSelectedJourney(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, [subscriberId, automationId]);

  // Get status styling
  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'skipped':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get node type icon
  const getNodeTypeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'TRIGGER':
        return '🚀';
      case 'ACTION':
        return '⚡';
      case 'EMAIL':
        return '📧';
      case 'CONDITION':
        return '🔀';
      case 'DELAY':
        return '⏰';
      case 'WAIT':
        return '⏸️';
      default:
        return '📦';
    }
  };

  // Format duration
  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${Math.round(duration / 1000)}s`;
    } else if (duration < 3600000) {
      return `${Math.round(duration / 60000)}m`;
    } else {
      return `${Math.round(duration / 3600000)}h`;
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-secondary-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-secondary-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-3 bg-secondary-200 rounded w-3/4 mb-1"></div>
                  <div className="h-2 bg-secondary-200 rounded w-1/2"></div>
                </div>
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
            Failed to Load Journey
          </h3>
          <p className="text-secondary-600 mb-4">{error}</p>
          <Button onClick={fetchJourneys} variant="secondary">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (journeys.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            No Journeys Found
          </h3>
          <p className="mt-1 text-sm text-secondary-500">
            This subscriber hasn't been through any automation workflows yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Journey Selector */}
      {journeys.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-secondary-900 mb-3">
            Automation Journeys
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {journeys.map((journey) => (
              <button
                key={journey.executionId}
                className={cn(
                  'p-3 text-left border rounded-md transition-colors',
                  selectedJourney?.executionId === journey.executionId
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-secondary-200 hover:border-secondary-300'
                )}
                onClick={() => setSelectedJourney(journey)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary-900">
                    {journey.automationName}
                  </span>
                  <Badge
                    variant="secondary"
                    className={getStatusStyling(journey.status)}
                  >
                    {journey.status}
                  </Badge>
                </div>
                <p className="text-xs text-secondary-600">
                  Started {journey.startedAt.toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Journey Timeline */}
      {selectedJourney && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-secondary-900">
                {selectedJourney.automationName}
              </h3>
              <p className="text-sm text-secondary-600">
                {selectedJourney.subscriberEmail} • Started {selectedJourney.startedAt.toLocaleString()}
                {selectedJourney.completedAt && (
                  <> • Completed {selectedJourney.completedAt.toLocaleString()}</>
                )}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={getStatusStyling(selectedJourney.status)}
            >
              {selectedJourney.status}
            </Badge>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-secondary-200"></div>

            {/* Steps */}
            <div className="space-y-6">
              {selectedJourney.steps.map((step, index) => (
                <div key={step.nodeId} className="relative flex items-start space-x-4">
                  {/* Step indicator */}
                  <div className={cn(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2',
                    step.status === 'completed' && 'bg-green-100 border-green-500',
                    step.status === 'failed' && 'bg-red-100 border-red-500',
                    step.status === 'pending' && 'bg-gray-100 border-gray-300',
                    step.status === 'skipped' && 'bg-gray-50 border-gray-300'
                  )}>
                    <span className="text-sm">
                      {getNodeTypeIcon(step.nodeType)}
                    </span>
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-secondary-900">
                        {step.nodeName}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {step.duration && (
                          <span className="text-xs text-secondary-500">
                            {formatDuration(step.duration)}
                          </span>
                        )}
                        <Badge
                          size="sm"
                          className={getStatusStyling(step.status)}
                        >
                          {step.status}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-secondary-600 mb-2">
                      {step.nodeType} • {step.executedAt.toLocaleString()}
                    </p>

                    {/* Error message */}
                    {step.error && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {step.error}
                      </div>
                    )}

                    {/* Step data */}
                    {step.data && Object.keys(step.data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-secondary-600 cursor-pointer hover:text-secondary-900">
                          View step data
                        </summary>
                        <pre className="mt-1 p-2 bg-secondary-50 border border-secondary-200 rounded text-xs overflow-x-auto">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current step indicator */}
          {selectedJourney.status === 'running' && selectedJourney.currentStep && (
            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center space-x-2">
                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-blue-800">
                  Currently executing: {selectedJourney.currentStep}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}