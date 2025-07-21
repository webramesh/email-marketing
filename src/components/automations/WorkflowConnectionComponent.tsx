'use client';

import React, { useState } from 'react';
import { WorkflowConnection } from '@/types';

export interface WorkflowConnectionComponentProps {
  /**
   * The workflow connection to render
   */
  connection: WorkflowConnection;

  /**
   * Source node position
   */
  sourcePosition: { x: number; y: number };

  /**
   * Target node position
   */
  targetPosition: { x: number; y: number };

  /**
   * Callback when the connection is deleted
   */
  onDelete?: (connectionId: string) => void;
}

/**
 * Individual workflow connection component
 */
export function WorkflowConnectionComponent({
  connection,
  sourcePosition,
  targetPosition,
  onDelete,
}: WorkflowConnectionComponentProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate control points for smooth curve
  const dx = targetPosition.x - sourcePosition.x;
  const dy = targetPosition.y - sourcePosition.y;

  // Control point offset based on distance
  const controlOffset = Math.max(50, Math.abs(dx) * 0.3);

  const controlPoint1 = {
    x: sourcePosition.x + controlOffset,
    y: sourcePosition.y,
  };

  const controlPoint2 = {
    x: targetPosition.x - controlOffset,
    y: targetPosition.y,
  };

  // Create SVG path
  const pathData = `M ${sourcePosition.x} ${sourcePosition.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${targetPosition.x} ${targetPosition.y}`;

  // Calculate midpoint for delete button
  const midPoint = {
    x: (sourcePosition.x + targetPosition.x) / 2,
    y: (sourcePosition.y + targetPosition.y) / 2,
  };

  // Handle delete
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete?.(connection.id);
  };

  // Get connection styling based on condition type
  const getConnectionStyling = () => {
    if (connection.condition?.type === 'conditional') {
      return {
        stroke: '#f59e0b', // amber-500
        strokeWidth: 2,
        strokeDasharray: '5,5',
      };
    }

    return {
      stroke: '#6b7280', // gray-500
      strokeWidth: 2,
      strokeDasharray: 'none',
    };
  };

  const styling = getConnectionStyling();

  return (
    <g>
      {/* Invisible thick path for easier hover detection */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible connection path */}
      <path
        d={pathData}
        stroke={isHovered ? '#3b82f6' : styling.stroke}
        strokeWidth={isHovered ? styling.strokeWidth + 1 : styling.strokeWidth}
        strokeDasharray={styling.strokeDasharray}
        fill="none"
        markerEnd="url(#arrowhead)"
        className="transition-all duration-200 pointer-events-none"
      />

      {/* Connection label for conditional connections */}
      {connection.condition?.type === 'conditional' && (
        <g>
          <rect
            x={midPoint.x - 20}
            y={midPoint.y - 8}
            width="40"
            height="16"
            rx="8"
            fill="#f59e0b"
            className="pointer-events-none"
          />
          <text
            x={midPoint.x}
            y={midPoint.y + 1}
            textAnchor="middle"
            className="text-xs fill-white font-medium pointer-events-none"
          >
            IF
          </text>
        </g>
      )}

      {/* Delete button */}
      {isHovered && onDelete && (
        <g>
          <circle
            cx={midPoint.x}
            cy={midPoint.y}
            r="10"
            fill="#ef4444"
            className="cursor-pointer hover:fill-red-600 transition-colors"
            onClick={handleDelete}
          />
          <path
            d={`M ${midPoint.x - 4} ${midPoint.y - 4} L ${midPoint.x + 4} ${midPoint.y + 4} M ${midPoint.x + 4} ${midPoint.y - 4} L ${midPoint.x - 4} ${midPoint.y + 4}`}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </g>
      )}
    </g>
  );
}