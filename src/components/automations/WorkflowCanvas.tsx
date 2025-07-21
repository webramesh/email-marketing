'use client';

import React, { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WorkflowNode, WorkflowConnection, WorkflowNodeType } from '@/types';
import { WorkflowNodeComponent } from './WorkflowNodeComponent';
import { WorkflowConnectionComponent } from './WorkflowConnectionComponent';

export interface WorkflowCanvasProps {
  /**
   * Workflow nodes
   */
  nodes: WorkflowNode[];
  
  /**
   * Workflow connections
   */
  connections: WorkflowConnection[];
  
  /**
   * Callback when a node is selected
   */
  onNodeSelect?: (node: WorkflowNode) => void;
  
  /**
   * Callback when a node is deleted
   */
  onNodeDelete?: (nodeId: string) => void;
  
  /**
   * Callback when a connection is created
   */
  onConnectionCreate?: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => void;
  
  /**
   * Callback when a connection is deleted
   */
  onConnectionDelete?: (connectionId: string) => void;
  
  /**
   * Callback when something is dropped on the canvas
   */
  onDrop?: (event: React.DragEvent, position: { x: number; y: number }) => void;
  
  /**
   * Whether the canvas is in read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Workflow canvas component for displaying and editing workflow nodes and connections
 */
export const WorkflowCanvas = forwardRef<HTMLDivElement, WorkflowCanvasProps>(
  ({
    nodes,
    connections,
    onNodeSelect,
    onNodeDelete,
    onConnectionCreate,
    onConnectionDelete,
    onDrop,
    readOnly = false,
    className,
  }, ref) => {
    const [draggedNode, setDraggedNode] = useState<WorkflowNode | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStart, setConnectionStart] = useState<{
      nodeId: string;
      handle?: string;
      position: { x: number; y: number };
    } | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);

    const canvasRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Handle mouse move for connection drawing
    const handleMouseMove = useCallback((event: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: (event.clientX - rect.left - canvasOffset.x) / scale,
          y: (event.clientY - rect.top - canvasOffset.y) / scale,
        });
      }
    }, [canvasOffset, scale]);

    // Handle mouse up for connection completion
    const handleMouseUp = useCallback(() => {
      if (isConnecting) {
        setIsConnecting(false);
        setConnectionStart(null);
      }
    }, [isConnecting]);

    // Set up mouse event listeners
    useEffect(() => {
      if (isConnecting) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isConnecting, handleMouseMove, handleMouseUp]);

    // Handle node drag start
    const handleNodeDragStart = useCallback((node: WorkflowNode, event: React.MouseEvent) => {
      if (readOnly) return;
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDraggedNode(node);
        setDragOffset({
          x: (event.clientX - rect.left - canvasOffset.x) / scale - node.position.x,
          y: (event.clientY - rect.top - canvasOffset.y) / scale - node.position.y,
        });
      }
    }, [readOnly, canvasOffset, scale]);

    // Handle node drag
    const handleNodeDrag = useCallback((event: React.MouseEvent) => {
      if (!draggedNode || readOnly) return;
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newPosition = {
          x: (event.clientX - rect.left - canvasOffset.x) / scale - dragOffset.x,
          y: (event.clientY - rect.top - canvasOffset.y) / scale - dragOffset.y,
        };
        
        // Update node position
        const updatedNode = { ...draggedNode, position: newPosition };
        setDraggedNode(updatedNode);
      }
    }, [draggedNode, readOnly, canvasOffset, scale, dragOffset]);

    // Handle node drag end
    const handleNodeDragEnd = useCallback(() => {
      if (draggedNode) {
        // Update the actual node in the parent component
        onNodeSelect?.(draggedNode);
        setDraggedNode(null);
      }
    }, [draggedNode, onNodeSelect]);

    // Handle connection start
    const handleConnectionStart = useCallback((
      nodeId: string,
      handle: string | undefined,
      position: { x: number; y: number }
    ) => {
      if (readOnly) return;
      
      setIsConnecting(true);
      setConnectionStart({ nodeId, handle, position });
    }, [readOnly]);

    // Handle connection end
    const handleConnectionEnd = useCallback((
      nodeId: string,
      handle?: string
    ) => {
      if (!connectionStart || !onConnectionCreate || readOnly) return;
      
      // Don't allow self-connections
      if (connectionStart.nodeId === nodeId) {
        setIsConnecting(false);
        setConnectionStart(null);
        return;
      }
      
      onConnectionCreate(
        connectionStart.nodeId,
        nodeId,
        connectionStart.handle,
        handle
      );
      
      setIsConnecting(false);
      setConnectionStart(null);
    }, [connectionStart, onConnectionCreate, readOnly]);

    // Handle canvas drop
    const handleCanvasDrop = useCallback((event: React.DragEvent) => {
      if (!onDrop || readOnly) return;
      
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      
      if (rect) {
        const position = {
          x: (event.clientX - rect.left - canvasOffset.x) / scale,
          y: (event.clientY - rect.top - canvasOffset.y) / scale,
        };
        
        onDrop(event, position);
      }
    }, [onDrop, readOnly, canvasOffset, scale]);

    // Handle canvas drag over
    const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
      event.preventDefault();
    }, []);

    // Handle zoom
    const handleWheel = useCallback((event: React.WheelEvent) => {
      event.preventDefault();
      
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(2, scale * delta));
      
      setScale(newScale);
    }, [scale]);

    // Get node position (considering drag state)
    const getNodePosition = useCallback((node: WorkflowNode) => {
      if (draggedNode && draggedNode.id === node.id) {
        return draggedNode.position;
      }
      return node.position;
    }, [draggedNode]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full h-full overflow-hidden bg-gray-50',
          'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]',
          className
        )}
        onWheel={handleWheel}
      >
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onMouseMove={handleNodeDrag}
          onMouseUp={handleNodeDragEnd}
        >
          {/* SVG for connections */}
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#6b7280"
                />
              </marker>
            </defs>
            
            {/* Existing connections */}
            {connections.map((connection) => {
              const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
              const targetNode = nodes.find(n => n.id === connection.targetNodeId);
              
              if (!sourceNode || !targetNode) return null;
              
              const sourcePos = getNodePosition(sourceNode);
              const targetPos = getNodePosition(targetNode);
              
              return (
                <WorkflowConnectionComponent
                  key={connection.id}
                  connection={connection}
                  sourcePosition={{ x: sourcePos.x + 150, y: sourcePos.y + 40 }}
                  targetPosition={{ x: targetPos.x, y: targetPos.y + 40 }}
                  onDelete={readOnly ? undefined : onConnectionDelete}
                />
              );
            })}
            
            {/* Temporary connection while dragging */}
            {isConnecting && connectionStart && (
              <line
                x1={connectionStart.position.x}
                y1={connectionStart.position.y}
                x2={mousePosition.x}
                y2={mousePosition.y}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            )}
          </svg>
          
          {/* Nodes */}
          {nodes.map((node) => {
            const position = getNodePosition(node);
            
            return (
              <WorkflowNodeComponent
                key={node.id}
                node={{ ...node, position }}
                onSelect={onNodeSelect}
                onDelete={readOnly ? undefined : onNodeDelete}
                onDragStart={handleNodeDragStart}
                onConnectionStart={handleConnectionStart}
                onConnectionEnd={handleConnectionEnd}
                readOnly={readOnly}
                style={{
                  position: 'absolute',
                  left: position.x,
                  top: position.y,
                  zIndex: draggedNode?.id === node.id ? 1000 : 1,
                }}
              />
            );
          })}
        </div>
        
        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-secondary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-secondary-900">
                No workflow components
              </h3>
              <p className="mt-1 text-sm text-secondary-500">
                {readOnly 
                  ? 'This workflow is empty.'
                  : 'Get started by dragging a trigger from the toolbox.'
                }
              </p>
            </div>
          </div>
        )}
        
        {/* Canvas controls */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-white rounded-md shadow-sm border border-secondary-200 p-2">
          <button
            type="button"
            className="p-1 text-secondary-600 hover:text-secondary-900"
            onClick={() => setScale(Math.min(2, scale * 1.2))}
            title="Zoom in"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          
          <span className="text-xs text-secondary-600 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            type="button"
            className="p-1 text-secondary-600 hover:text-secondary-900"
            onClick={() => setScale(Math.max(0.1, scale * 0.8))}
            title="Zoom out"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          
          <div className="w-px h-4 bg-secondary-300" />
          
          <button
            type="button"
            className="p-1 text-secondary-600 hover:text-secondary-900"
            onClick={() => {
              setScale(1);
              setCanvasOffset({ x: 0, y: 0 });
            }}
            title="Reset view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

WorkflowCanvas.displayName = 'WorkflowCanvas';