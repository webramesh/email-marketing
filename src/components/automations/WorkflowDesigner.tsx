'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  WorkflowNode,
  WorkflowConnection,
  WorkflowNodeType,
  TriggerConfiguration,
  ActionConfiguration,
} from '@/types';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowToolbox } from './WorkflowToolbox';
import { WorkflowNodeEditor } from './WorkflowNodeEditor';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface WorkflowDesignerProps {
  /**
   * Initial workflow data
   */
  initialNodes?: WorkflowNode[];
  initialConnections?: WorkflowConnection[];
  
  /**
   * Available trigger configurations
   */
  triggerConfigurations: TriggerConfiguration[];
  
  /**
   * Available action configurations
   */
  actionConfigurations: ActionConfiguration[];
  
  /**
   * Callback when workflow data changes
   */
  onChange: (data: { nodes: WorkflowNode[]; connections: WorkflowConnection[] }) => void;
  
  /**
   * Whether the designer is in read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Visual workflow designer component with drag-and-drop functionality
 */
export function WorkflowDesigner({
  initialNodes = [],
  initialConnections = [],
  triggerConfigurations,
  actionConfigurations,
  onChange,
  readOnly = false,
  className,
}: WorkflowDesignerProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [connections, setConnections] = useState<WorkflowConnection[]>(initialConnections);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'trigger' | 'action';
    config: TriggerConfiguration | ActionConfiguration;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeIdCounter = useRef(1);

  // Generate unique node ID
  const generateNodeId = useCallback(() => {
    return `node_${nodeIdCounter.current++}`;
  }, []);

  // Handle adding a new node
  const handleAddNode = useCallback((
    type: WorkflowNodeType,
    config: TriggerConfiguration | ActionConfiguration,
    position: { x: number; y: number }
  ) => {
    const newNode: WorkflowNode = {
      id: generateNodeId(),
      type,
      position,
      data: {
        label: config.name,
        description: config.description,
        config: {},
        isValid: false,
        errors: [],
      },
      connections: {
        inputs: [],
        outputs: [],
      },
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    onChange({ nodes: updatedNodes, connections });
  }, [nodes, connections, onChange, generateNodeId]);

  // Handle node selection
  const handleNodeSelect = useCallback((node: WorkflowNode) => {
    setSelectedNode(node);
    setIsNodeEditorOpen(true);
  }, []);

  // Handle node update
  const handleNodeUpdate = useCallback((updatedNode: WorkflowNode) => {
    const updatedNodes = nodes.map(node =>
      node.id === updatedNode.id ? updatedNode : node
    );
    setNodes(updatedNodes);
    onChange({ nodes: updatedNodes, connections });
  }, [nodes, connections, onChange]);

  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId: string) => {
    const updatedNodes = nodes.filter(node => node.id !== nodeId);
    const updatedConnections = connections.filter(
      conn => conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId
    );
    
    setNodes(updatedNodes);
    setConnections(updatedConnections);
    onChange({ nodes: updatedNodes, connections: updatedConnections });
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setIsNodeEditorOpen(false);
    }
  }, [nodes, connections, selectedNode, onChange]);

  // Handle connection creation
  const handleConnectionCreate = useCallback((
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => {
    const connectionId = `conn_${Date.now()}`;
    const newConnection: WorkflowConnection = {
      id: connectionId,
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      targetHandle,
      condition: { type: 'always' },
    };

    const updatedConnections = [...connections, newConnection];
    setConnections(updatedConnections);
    onChange({ nodes, connections: updatedConnections });
  }, [nodes, connections, onChange]);

  // Handle connection deletion
  const handleConnectionDelete = useCallback((connectionId: string) => {
    const updatedConnections = connections.filter(conn => conn.id !== connectionId);
    setConnections(updatedConnections);
    onChange({ nodes, connections: updatedConnections });
  }, [nodes, connections, onChange]);

  // Handle drag start from toolbox
  const handleDragStart = useCallback((
    type: 'trigger' | 'action',
    config: TriggerConfiguration | ActionConfiguration
  ) => {
    setDraggedItem({ type, config });
  }, []);

  // Handle drop on canvas
  const handleCanvasDrop = useCallback((
    event: React.DragEvent,
    position: { x: number; y: number }
  ) => {
    event.preventDefault();
    
    if (!draggedItem) return;

    const nodeType = draggedItem.type === 'trigger' 
      ? WorkflowNodeType.TRIGGER 
      : WorkflowNodeType.ACTION;

    handleAddNode(nodeType, draggedItem.config, position);
    setDraggedItem(null);
  }, [draggedItem, handleAddNode]);

  // Validate workflow
  const validateWorkflow = useCallback(() => {
    const errors: string[] = [];
    
    // Check for trigger nodes
    const triggerNodes = nodes.filter(node => node.type === WorkflowNodeType.TRIGGER);
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger');
    }

    // Check for orphaned nodes (except triggers)
    const nonTriggerNodes = nodes.filter(node => node.type !== WorkflowNodeType.TRIGGER);
    for (const node of nonTriggerNodes) {
      const hasIncomingConnection = connections.some(conn => conn.targetNodeId === node.id);
      if (!hasIncomingConnection) {
        errors.push(`"${node.data.label}" has no incoming connections`);
      }
    }

    return errors;
  }, [nodes, connections]);

  // Update nodes when props change
  useEffect(() => {
    setNodes(initialNodes);
    setConnections(initialConnections);
  }, [initialNodes, initialConnections]);

  const validationErrors = validateWorkflow();
  const isValid = validationErrors.length === 0;

  return (
    <div className={cn('flex h-full bg-secondary-50', className)}>
      {/* Toolbox */}
      {!readOnly && (
        <WorkflowToolbox
          triggerConfigurations={triggerConfigurations}
          actionConfigurations={actionConfigurations}
          onDragStart={handleDragStart}
          className="w-80 border-r border-secondary-200 bg-white"
        />
      )}

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b border-secondary-200 bg-white px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-secondary-900">
              Workflow Designer
            </h2>
            {!isValid && (
              <div className="flex items-center space-x-2 text-red-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{validationErrors.length} error(s)</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-secondary-600">
              {nodes.length} node(s), {connections.length} connection(s)
            </span>
          </div>
        </div>

        {/* Canvas */}
        <WorkflowCanvas
          ref={canvasRef}
          nodes={nodes}
          connections={connections}
          onNodeSelect={handleNodeSelect}
          onNodeDelete={readOnly ? undefined : handleNodeDelete}
          onConnectionCreate={readOnly ? undefined : handleConnectionCreate}
          onConnectionDelete={readOnly ? undefined : handleConnectionDelete}
          onDrop={readOnly ? undefined : handleCanvasDrop}
          readOnly={readOnly}
          className="flex-1"
        />

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="border-t border-secondary-200 bg-red-50 p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">
              Workflow Validation Errors:
            </h3>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Node Editor Modal */}
      {selectedNode && (
        <Modal
          isOpen={isNodeEditorOpen}
          onClose={() => setIsNodeEditorOpen(false)}
          title={`Edit ${selectedNode.data.label}`}
          size="lg"
        >
          <WorkflowNodeEditor
            node={selectedNode}
            triggerConfigurations={triggerConfigurations}
            actionConfigurations={actionConfigurations}
            onUpdate={handleNodeUpdate}
            onClose={() => setIsNodeEditorOpen(false)}
            readOnly={readOnly}
          />
        </Modal>
      )}
    </div>
  );
}