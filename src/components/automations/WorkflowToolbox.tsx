'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { TriggerConfiguration, ActionConfiguration } from '@/types';
import { Input } from '@/components/ui/Input';

export interface WorkflowToolboxProps {
  /**
   * Available trigger configurations
   */
  triggerConfigurations: TriggerConfiguration[];
  
  /**
   * Available action configurations
   */
  actionConfigurations: ActionConfiguration[];
  
  /**
   * Callback when drag starts
   */
  onDragStart: (
    type: 'trigger' | 'action',
    config: TriggerConfiguration | ActionConfiguration
  ) => void;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Workflow toolbox component with draggable triggers and actions
 */
export function WorkflowToolbox({
  triggerConfigurations,
  actionConfigurations,
  onDragStart,
  className,
}: WorkflowToolboxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'triggers' | 'actions'>('triggers');

  // Filter configurations based on search term
  const filteredTriggers = triggerConfigurations.filter(trigger =>
    trigger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trigger.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredActions = actionConfigurations.filter(action =>
    action.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    action.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group actions by category
  const actionsByCategory = filteredActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, ActionConfiguration[]>);

  const categoryIcons = {
    email: '📧',
    subscriber: '👤',
    list: '📋',
    webhook: '🔗',
    delay: '⏰',
    condition: '🔀',
  };

  const categoryNames = {
    email: 'Email',
    subscriber: 'Subscriber',
    list: 'List Management',
    webhook: 'Webhooks',
    delay: 'Timing',
    condition: 'Logic',
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-secondary-200">
        <h3 className="text-lg font-semibold text-secondary-900 mb-3">
          Workflow Components
        </h3>
        
        {/* Search */}
        <Input
          type="text"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-3"
        />

        {/* Tabs */}
        <div className="flex space-x-1 bg-secondary-100 rounded-md p-1">
          <button
            type="button"
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'triggers'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-secondary-600 hover:text-secondary-900'
            )}
            onClick={() => setActiveTab('triggers')}
          >
            Triggers
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'actions'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-secondary-600 hover:text-secondary-900'
            )}
            onClick={() => setActiveTab('actions')}
          >
            Actions
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'triggers' ? (
          <div className="space-y-2">
            {filteredTriggers.length === 0 ? (
              <div className="text-center py-8 text-secondary-500">
                <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="mt-2 text-sm">No triggers found</p>
              </div>
            ) : (
              filteredTriggers.map((trigger) => (
                <div
                  key={trigger.type}
                  className="p-3 border border-secondary-200 rounded-md bg-white cursor-grab hover:bg-secondary-50 hover:border-primary-300 transition-colors"
                  draggable
                  onDragStart={() => onDragStart('trigger', trigger)}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-lg flex-shrink-0">{trigger.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-secondary-900">
                        {trigger.name}
                      </h4>
                      <p className="text-xs text-secondary-600 mt-1">
                        {trigger.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.keys(actionsByCategory).length === 0 ? (
              <div className="text-center py-8 text-secondary-500">
                <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="mt-2 text-sm">No actions found</p>
              </div>
            ) : (
              Object.entries(actionsByCategory).map(([category, actions]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-secondary-700 mb-2 flex items-center space-x-2">
                    <span>{categoryIcons[category as keyof typeof categoryIcons]}</span>
                    <span>{categoryNames[category as keyof typeof categoryNames]}</span>
                  </h4>
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <div
                        key={action.type}
                        className="p-3 border border-secondary-200 rounded-md bg-white cursor-grab hover:bg-secondary-50 hover:border-primary-300 transition-colors"
                        draggable
                        onDragStart={() => onDragStart('action', action)}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-lg flex-shrink-0">{action.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-secondary-900">
                              {action.name}
                            </h5>
                            <p className="text-xs text-secondary-600 mt-1">
                              {action.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-secondary-200 bg-secondary-50">
        <p className="text-xs text-secondary-600 text-center">
          Drag components to the canvas to build your workflow
        </p>
      </div>
    </div>
  );
}