'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { WorkflowNode, WorkflowNodeType } from '@/types';

export interface WorkflowNodeComponentProps {
  /**
   * The workflow node to render
   */
  node: WorkflowNode;
  
  /**
   * Callback when the node is selected
   */
  onSelect?: (node: WorkflowNode) => void;
  
  /**
   * Callback when the node is deleted
   */
  onDelete?: (nodeId: string) => void;
  
  /**
   * Callback when a connection starts from this node
   */
  onConnectionStart?: (
    nodeId: string,
    handle: string | undefined,
    position: { x: number; y: number }
  ) => void;
  
  /**
   * Callback when a connection ends at this node
   */
  onConnectionEnd?: (nodeId: string, handle?: string) => void;
  
  /**
   * Callback when node drag starts
   */
  onDragStart?: (node: WorkflowNode, event: React.MouseEvent) => void;
  
  /**
   * Whether the node is in read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Additional styles
   */
  style?: React.CSSProperties;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Individual workflow node component
 */
export function WorkflowNodeComponent({
  node,
  onSelect,
  onDelete,
  onConnectionStart,
  onConnectionEnd,
  onDragStart,
  readOnly = false,
  style,
  className,
}: WorkflowNodeComponentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get node styling based on type
  const getNodeStyling = () => {
    const baseClasses = 'border-2 rounded-lg shadow-sm transition-all duration-200';
    
    switch (node.type) {
      case WorkflowNodeType.TRIGGER:
        return {
          container: cn(
            baseClasses,
            'bg-green-50 border-green-200 hover:border-green-300',
            node.data.isValid === false && 'border-red-300 bg-red-50',
            className
          ),
          header: 'bg-green-100 text-green-800',
          icon: '🚀',
        };
      case WorkflowNodeType.ACTION:
        return {
          container: cn(
            baseClasses,
            'bg-blue-50 border-blue-200 hover:border-blue-300',
            node.data.isValid === false && 'border-red-300 bg-red-50',
            className
          ),
          header: 'bg-blue-100 text-blue-800',
          icon: '⚡',
        };
      case WorkflowNodeType.CONDITION:
        return {
          container: cn(
            baseClasses,
            'bg-yellow-50 border-yellow-200 hover:border-yellow-300',
            node.data.isValid === false && 'border-red-300 bg-red-50',
            className
          ),
          header: 'bg-yellow-100 text-yellow-800',
          icon: '🔀',
        };
      case WorkflowNodeType.DELAY:
        return {
          container: cn(
            baseClasses,
            'bg-purple-50 border-purple-200 hover:border-purple-300',
            node.data.isValid === false && 'border-red-300 bg-red-50',
            className
          ),
          header: 'bg-purple-100 text-purple-800',
          icon: '⏰',
        };
      default:
        return {
          container: cn(
            baseClasses,
            'bg-gray-50 border-gray-200 hover:border-gray-300',
            node.data.isValid === false && 'border-red-300 bg-red-50',
            className
          ),
          header: 'bg-gray-100 text-gray-800',
          icon: '📦',
        };
    }
  };

  const styling = getNodeStyling();

  // Handle mouse down for dragging
  const handleMouseDown = (event: React.MouseEvent) => {
    if (readOnly) return;
    
    event.preventDefault();
    setIsDragging(true);
    onDragStart?.(node, event);
  };

  // Handle connection start
  const handleConnectionStart = (event: React.MouseEvent, handle?: string) => {
    if (readOnly) return;
    
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.right,
      y: rect.top + rect.height / 2,
    };
    
    onConnectionStart?.(node.id, handle, position);
  };

  // Handle connection end
  const handleConnectionEnd = (event: React.MouseEvent, handle?: string) => {
    if (readOnly) return;
    
    event.stopPropagation();
    onConnectionEnd?.(node.id, handle);
  };

  // Handle node click
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isDragging) {
      onSelect?.(node);
    }
    setIsDragging(false);
  };

  // Handle delete
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete?.(node.id);
  };

  return (
    <div
      className={styling.container}
      style={{
        width: 300,
        minHeight: 80,
        cursor: readOnly ? 'default' : 'grab',
        ...style,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Input connection point */}
      {node.type !== WorkflowNodeType.TRIGGER && (
        <div
          className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full cursor-crosshair hover:border-blue-500 transition-colors"
          onMouseUp={(e) => handleConnectionEnd(e)}
          title="Input connection"
        />
      )}

      {/* Node header */}
      <div className={cn('px-3 py-2 rounded-t-md flex items-center justify-between', styling.header)}>
        <div className="flex items-center space-x-2">
          <span className="text-sm">{styling.icon}</span>
          <span className="text-sm font-medium truncate">{node.data.label}</span>
        </div>
        
        {/* Node actions */}
        {isHovered && !readOnly && (
          <div className="flex items-center space-x-1">
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-700 rounded"
              onClick={handleDelete}
              title="Delete node"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Node content */}
      <div className="px-3 py-2">
        {node.data.description && (
          <p className="text-xs text-gray-600 mb-2">{node.data.description}</p>
        )}
        
        {/* Configuration summary */}
        {Object.keys(node.data.config).length > 0 && (
          <div className="space-y-1">
            {Object.entries(node.data.config).slice(0, 2).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="font-medium text-gray-700">{key}:</span>{' '}
                <span className="text-gray-600">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
            {Object.keys(node.data.config).length > 2 && (
              <div className="text-xs text-gray-500">
                +{Object.keys(node.data.config).length - 2} more...
              </div>
            )}
          </div>
        )}
        
        {/* Validation errors */}
        {node.data.errors && node.data.errors.length > 0 && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs">
            <div className="flex items-center space-x-1 text-red-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Configuration required</span>
            </div>
          </div>
        )}
      </div>

      {/* Output connection point */}
      <div
        className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full cursor-crosshair hover:border-blue-500 transition-colors"
        onMouseDown={(e) => handleConnectionStart(e)}
        title="Output connection"
      />

      {/* Status indicator */}
      <div className="absolute -top-1 -right-1">
        {node.data.isValid === false ? (
          <div className="w-3 h-3 bg-red-500 rounded-full border border-white" title="Configuration required" />
        ) : node.data.isValid === true ? (
          <div className="w-3 h-3 bg-green-500 rounded-full border border-white" title="Configured" />
        ) : (
          <div className="w-3 h-3 bg-yellow-500 rounded-full border border-white" title="Needs configuration" />
        )}
      </div>
    </div>
  );
}