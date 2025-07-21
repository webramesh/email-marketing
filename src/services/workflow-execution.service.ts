import { prisma } from '@/lib/prisma';
import { emailQueue } from '@/lib/queue';
import {
  WorkflowNode,
  WorkflowConnection,
  WorkflowNodeType,
  ExecutionStatus,
  Subscriber,
} from '@/types';

export interface WorkflowExecutionContext {
  tenantId: string;
  automationId: string;
  executionId: string;
  subscriber: Subscriber;
  currentNodeId: string;
  executionData: Record<string, any>;
  variables: Record<string, any>;
}

export interface StepExecutionResult {
  success: boolean;
  nextNodeId?: string;
  delay?: number; // in milliseconds
  error?: string;
  data?: Record<string, any>;
}

export class WorkflowExecutionService {
  /**
   * Execute a workflow step
   */
  async executeWorkflowStep(
    context: WorkflowExecutionContext,
    node: WorkflowNode,
    connections: WorkflowConnection[]
  ): Promise<StepExecutionResult> {
    try {
      // Update execution status
      await this.updateExecutionProgress(context, node.id);

      let result: StepExecutionResult;

      // Execute step based on node type
      switch (node.type) {
        case WorkflowNodeType.ACTION:
          result = await this.executeActionNode(context, node);
          break;
        case WorkflowNodeType.CONDITION:
          result = await this.executeConditionNode(context, node);
          break;
        case WorkflowNodeType.DELAY:
          result = await this.executeDelayNode(context, node);
          break;
        case WorkflowNodeType.EMAIL:
          result = await this.executeEmailNode(context, node);
          break;
        case WorkflowNodeType.WAIT:
          result = await this.executeWaitNode(context, node);
          break;
        default:
          result = {
            success: false,
            error: `Unknown node type: ${node.type}`,
          };
      }

      // If no specific next node is specified, find the next node from connections
      if (result.success && !result.nextNodeId) {
        result.nextNodeId = this.findNextNode(node.id, connections, result.data);
      }

      return result;
    } catch (error) {
      console.error('Error executing workflow step:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute an action node
   */
  private async executeActionNode(
    context: WorkflowExecutionContext,
    node: WorkflowNode
  ): Promise<StepExecutionResult> {
    const config = node.data.config;
    const actionType = config.actionType || config.type;

    switch (actionType) {
      case 'send_email':
        return this.executeSendEmailAction(context, config);
      case 'add_to_list':
        return this.executeAddToListAction(context, config);
      case 'remove_from_list':
        return this.executeRemoveFromListAction(context, config);
      case 'update_field':
        return this.executeUpdateFieldAction(context, config);
      default:
        return {
          success: false,
          error: `Unknown action type: ${actionType}`,
        };
    }
  }

  /**
   * Execute a condition node
   */
  private async executeConditionNode(
    context: WorkflowExecutionContext,
    node: WorkflowNode
  ): Promise<StepExecutionResult> {
    const config = node.data.config;
    const field = config.field;
    const operator = config.operator;
    const value = config.value;

    // Get field value from subscriber
    let fieldValue: any;
    switch (field) {
      case 'email':
        fieldValue = context.subscriber.email;
        break;
      case 'firstName':
        fieldValue = context.subscriber.firstName;
        break;
      case 'lastName':
        fieldValue = context.subscriber.lastName;
        break;
      case 'status':
        fieldValue = context.subscriber.status;
        break;
      default:
        // Custom field
        fieldValue = (context.subscriber.customFields as any)?.[field];
    }

    // Evaluate condition
    const conditionResult = this.evaluateCondition(fieldValue, operator, value);

    return {
      success: true,
      data: { conditionResult },
    };
  }

  /**
   * Execute a delay node
   */
  private async executeDelayNode(
    context: WorkflowExecutionContext,
    node: WorkflowNode
  ): Promise<StepExecutionResult> {
    const config = node.data.config;
    const duration = parseInt(config.duration) || 1;
    const unit = config.unit || 'minutes';

    let delayMs = 0;
    switch (unit) {
      case 'minutes':
        delayMs = duration * 60 * 1000;
        break;
      case 'hours':
        delayMs = duration * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = duration * 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        delayMs = duration * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        delayMs = duration * 60 * 1000; // Default to minutes
    }

    return {
      success: true,
      delay: delayMs,
    };
  }

  /**
   * Execute an email node
   */
  private async executeEmailNode(
    context: WorkflowExecutionContext,
    node: WorkflowNode
  ): Promise<StepExecutionResult> {
    const config = node.data.config;
    
    // This is similar to send_email action but specifically for email nodes
    return this.executeSendEmailAction(context, config);
  }

  /**
   * Execute a wait node
   */
  private async executeWaitNode(
    context: WorkflowExecutionContext,
    node: WorkflowNode
  ): Promise<StepExecutionResult> {
    // Wait nodes are similar to delay nodes
    return this.executeDelayNode(context, node);
  }

  /**
   * Execute send email action
   */
  private async executeSendEmailAction(
    context: WorkflowExecutionContext,
    config: Record<string, any>
  ): Promise<StepExecutionResult> {
    try {
      const subject = this.personalizeContent(config.subject || '', context.subscriber, context.variables);
      const content = this.personalizeContent(config.content || '', context.subscriber, context.variables);

      // Add email to queue
      await emailQueue.add('send-email', {
        tenantId: context.tenantId,
        message: {
          to: context.subscriber.email,
          from: config.fromEmail || 'noreply@example.com',
          fromName: config.fromName || 'System',
          subject,
          html: content,
        },
        subscriberId: context.subscriber.id,
        metadata: {
          automationId: context.automationId,
          executionId: context.executionId,
          nodeId: context.currentNodeId,
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Execute add to list action
   */
  private async executeAddToListAction(
    context: WorkflowExecutionContext,
    config: Record<string, any>
  ): Promise<StepExecutionResult> {
    try {
      const listId = config.listId;
      if (!listId) {
        return { success: false, error: 'List ID is required' };
      }

      // Check if subscriber is already in the list
      const existingMembership = await prisma.listSubscriber.findUnique({
        where: {
          listId_subscriberId: {
            listId,
            subscriberId: context.subscriber.id,
          },
        },
      });

      if (!existingMembership) {
        await prisma.listSubscriber.create({
          data: {
            listId,
            subscriberId: context.subscriber.id,
          },
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add to list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Execute remove from list action
   */
  private async executeRemoveFromListAction(
    context: WorkflowExecutionContext,
    config: Record<string, any>
  ): Promise<StepExecutionResult> {
    try {
      const listId = config.listId;
      if (!listId) {
        return { success: false, error: 'List ID is required' };
      }

      await prisma.listSubscriber.deleteMany({
        where: {
          listId,
          subscriberId: context.subscriber.id,
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove from list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Execute update field action
   */
  private async executeUpdateFieldAction(
    context: WorkflowExecutionContext,
    config: Record<string, any>
  ): Promise<StepExecutionResult> {
    try {
      const fieldName = config.fieldName;
      const value = config.value;

      if (!fieldName) {
        return { success: false, error: 'Field name is required' };
      }

      // Update subscriber custom field
      const currentCustomFields = (context.subscriber.customFields as Record<string, any>) || {};
      const updatedCustomFields = {
        ...currentCustomFields,
        [fieldName]: value,
      };

      await prisma.subscriber.update({
        where: { id: context.subscriber.id },
        data: { customFields: updatedCustomFields },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update field: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'not_equals':
        return fieldValue !== compareValue;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(compareValue));
      case 'starts_with':
        return String(fieldValue).startsWith(String(compareValue));
      case 'ends_with':
        return String(fieldValue).endsWith(String(compareValue));
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      case 'greater_than':
        return Number(fieldValue) > Number(compareValue);
      case 'less_than':
        return Number(fieldValue) < Number(compareValue);
      default:
        return false;
    }
  }

  /**
   * Find the next node to execute based on connections
   */
  private findNextNode(
    currentNodeId: string,
    connections: WorkflowConnection[],
    stepData?: Record<string, any>
  ): string | undefined {
    const outgoingConnections = connections.filter(conn => conn.sourceNodeId === currentNodeId);

    if (outgoingConnections.length === 0) {
      return undefined; // End of workflow
    }

    // For condition nodes, check if we have conditional connections
    if (stepData?.conditionResult !== undefined) {
      const conditionalConnection = outgoingConnections.find(
        conn => conn.condition?.type === 'conditional'
      );
      const defaultConnection = outgoingConnections.find(
        conn => conn.condition?.type === 'always' || !conn.condition
      );

      if (stepData.conditionResult && conditionalConnection) {
        return conditionalConnection.targetNodeId;
      } else if (!stepData.conditionResult && defaultConnection) {
        return defaultConnection.targetNodeId;
      }
    }

    // Default: return the first connection
    return outgoingConnections[0]?.targetNodeId;
  }

  /**
   * Personalize content with subscriber data and variables
   */
  private personalizeContent(
    content: string,
    subscriber: Subscriber,
    variables: Record<string, any> = {}
  ): string {
    let personalizedContent = content;

    // Replace subscriber fields
    personalizedContent = personalizedContent.replace(/\{\{email\}\}/g, subscriber.email || '');
    personalizedContent = personalizedContent.replace(/\{\{firstName\}\}/g, subscriber.firstName || '');
    personalizedContent = personalizedContent.replace(/\{\{lastName\}\}/g, subscriber.lastName || '');

    // Replace custom fields
    if (subscriber.customFields) {
      const customFields = subscriber.customFields as Record<string, any>;
      for (const [key, value] of Object.entries(customFields)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        personalizedContent = personalizedContent.replace(regex, String(value || ''));
      }
    }

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      personalizedContent = personalizedContent.replace(regex, String(value || ''));
    }

    return personalizedContent;
  }

  /**
   * Update execution progress
   */
  private async updateExecutionProgress(
    context: WorkflowExecutionContext,
    currentNodeId: string
  ): Promise<void> {
    await prisma.automationExecution.update({
      where: { id: context.executionId },
      data: {
        status: ExecutionStatus.RUNNING,
        executionData: {
          ...context.executionData,
          currentNodeId,
          lastStepExecuted: new Date(),
        },
      },
    });
  }

  /**
   * Complete workflow execution
   */
  async completeExecution(
    executionId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
        completedAt: new Date(),
        executionData: {
          completedAt: new Date(),
          success,
          ...(error && { error }),
        },
      },
    });
  }

  /**
   * Get execution timeline for visualization
   */
  async getExecutionTimeline(executionId: string): Promise<Array<{
    nodeId: string;
    nodeName: string;
    nodeType: string;
    executedAt: Date;
    status: 'completed' | 'failed' | 'skipped' | 'pending';
    duration?: number;
    error?: string;
    data?: Record<string, any>;
  }>> {
    const execution = await prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: {
        automation: true,
      },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    const timeline: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
      executedAt: Date;
      status: 'completed' | 'failed' | 'skipped' | 'pending';
      duration?: number;
      error?: string;
      data?: Record<string, any>;
    }> = [];

    // Parse execution data to build timeline
    const executionData = execution.executionData as any;
    
    if (execution.automation.workflowData && typeof execution.automation.workflowData === 'object') {
      // New workflow format
      const workflowData = execution.automation.workflowData as unknown as { nodes: WorkflowNode[]; connections: WorkflowConnection[] };
      const { nodes } = workflowData;

      // Build timeline from execution data
      const executedNodes = executionData?.executedNodes || [];
      const currentNodeId = executionData?.currentNodeId;
      const lastExecutedNode = executionData?.lastExecutedNode;

      for (const node of nodes) {
        if (node.type === 'TRIGGER') continue; // Skip trigger nodes in timeline

        let status: 'completed' | 'failed' | 'skipped' | 'pending' = 'pending';
        let executedAt = execution.startedAt;
        let duration: number | undefined;
        let error: string | undefined;
        let data: Record<string, any> | undefined;

        // Check if this node was executed
        const nodeExecution = executedNodes.find((n: any) => n.nodeId === node.id);
        if (nodeExecution) {
          status = nodeExecution.status || 'completed';
          executedAt = new Date(nodeExecution.executedAt);
          duration = nodeExecution.duration;
          error = nodeExecution.error;
          data = nodeExecution.data;
        } else if (node.id === currentNodeId) {
          status = 'pending';
        } else if (lastExecutedNode && nodes.findIndex(n => n.id === node.id) <= nodes.findIndex(n => n.id === lastExecutedNode)) {
          status = 'completed';
        }

        timeline.push({
          nodeId: node.id,
          nodeName: node.data.label || node.type,
          nodeType: node.type,
          executedAt,
          status,
          duration,
          error,
          data,
        });
      }
    } else {
      // Legacy workflow format
      const workflowSteps = await prisma.workflowStep.findMany({
        where: { automationId: execution.automationId },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        let status: 'completed' | 'failed' | 'skipped' | 'pending' = 'pending';

        if (i < execution.currentStep) {
          status = 'completed';
        } else if (i === execution.currentStep && execution.status === 'FAILED') {
          status = 'failed';
        } else if (i === execution.currentStep && execution.status === 'RUNNING') {
          status = 'pending';
        }

        timeline.push({
          nodeId: step.id,
          nodeName: (step.stepConfig && typeof step.stepConfig === 'object' && 'label' in step.stepConfig ? step.stepConfig.label as string : null) || step.stepType,
          nodeType: step.stepType,
          executedAt: execution.startedAt,
          status,
        });
      }
    }

    return timeline.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
  }
}

export const workflowExecutionService = new WorkflowExecutionService();