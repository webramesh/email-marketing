'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';

interface TimelineData {
  timestamp: string;
  [key: string]: any;
}

interface EngagementTimelineProps {
  timeline: TimelineData[];
}

export function EngagementTimeline({ timeline }: EngagementTimelineProps) {
  // Process timeline data for visualization
  const processedData = timeline.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    opens: item.OPENED || 0,
    clicks: item.CLICKED || 0,
    unsubscribes: item.UNSUBSCRIBED || 0,
    total: (item.OPENED || 0) + (item.CLICKED || 0) + (item.UNSUBSCRIBED || 0),
  }));

  const maxValue = Math.max(...processedData.map(d => d.total), 1);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Engagement Timeline</h3>
          <p className="text-sm text-gray-600">Last 24 hours activity</p>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Opens</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Clicks</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Unsubscribes</span>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Chart Area */}
        <div className="h-64 flex items-end justify-between space-x-1">
          {processedData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center group">
              {/* Bars */}
              <div className="relative w-full max-w-8 flex flex-col justify-end h-48">
                {/* Unsubscribes */}
                {data.unsubscribes > 0 && (
                  <div
                    className="bg-red-500 rounded-t-sm"
                    style={{
                      height: `${(data.unsubscribes / maxValue) * 100}%`,
                      minHeight: data.unsubscribes > 0 ? '2px' : '0',
                    }}
                  ></div>
                )}
                
                {/* Clicks */}
                {data.clicks > 0 && (
                  <div
                    className={`bg-green-500 ${data.unsubscribes === 0 ? 'rounded-t-sm' : ''}`}
                    style={{
                      height: `${(data.clicks / maxValue) * 100}%`,
                      minHeight: data.clicks > 0 ? '2px' : '0',
                    }}
                  ></div>
                )}
                
                {/* Opens */}
                {data.opens > 0 && (
                  <div
                    className={`bg-blue-500 ${data.clicks === 0 && data.unsubscribes === 0 ? 'rounded-t-sm' : ''}`}
                    style={{
                      height: `${(data.opens / maxValue) * 100}%`,
                      minHeight: data.opens > 0 ? '2px' : '0',
                    }}
                  ></div>
                )}
                
                {/* Empty state */}
                {data.total === 0 && (
                  <div className="bg-gray-200 rounded-sm h-1"></div>
                )}
              </div>

              {/* Time label */}
              <div className="mt-2 text-xs text-gray-500 transform -rotate-45 origin-center">
                {data.time}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="text-center">
                  <div>Opens: {data.opens}</div>
                  <div>Clicks: {data.clicks}</div>
                  <div>Unsubscribes: {data.unsubscribes}</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-xs text-gray-500 -ml-8">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {processedData.reduce((sum, d) => sum + d.opens, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Opens</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {processedData.reduce((sum, d) => sum + d.clicks, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Clicks</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {processedData.reduce((sum, d) => sum + d.unsubscribes, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Unsubscribes</div>
        </div>
      </div>
    </Card>
  );
}