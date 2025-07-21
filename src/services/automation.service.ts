import { prisma } from '@/lib/prisma';
import {
  Automation,
  AutomationWithDetails,
  CreateAutomationRequest,
  UpdateAutomationRequest,
  AutomationStatus,
  WorkflowNode,
  WorkflowConnection,
  TriggerType,
  WorkflowNodeType,
  TriggerConfiguration,
  ActionConfiguration,
  PaginatedResponse,
  PaginationParams,
} from '@/types';

export class AutomationService {
  /**
   * Get all automations for a tenant with pagination
   */
  async getAutomations(
    tenantId: string,
    params: PaginationParams & {
      status?: AutomationStatus;
      search?: string;
    }
  ): Promise<PaginatedResponse<AutomationWithDetails>> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        name: {
          contains: search,
        },
      }),
    };

    const [automations, total] = await Promise.all([
      prisma.automation.findMany({
        where,
        include: {
          workflowSteps: {
            orderBy: { position: 'asc' },
          },
          executions: {
            take: 5,
            orderBy: { startedAt: 'desc' },
            include: {
              subscriber: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              executions: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.automation.count({ where }),
    ]);

    return {
      data: automations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single automation by ID
   */
  async getAutomation(id: string, tenantId: string): Promise<AutomationWithDetails | null> {
    return prisma.automation.findFirst({
      where: { id, tenantId },
      include: {
        workflowSteps: {
          orderBy: { position: 'asc' },
        },
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          include: {
            subscriber: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });
  }

  /**
   * Create a new automation
   */
  async createAutomation(
    tenantId: string,
    data: CreateAutomationRequest
  ): Promise<Automation> {
    // Validate workflow data
    this.validateWorkflowData(data.workflowData);

    // Convert workflow nodes to workflow steps
    const workflowSteps = this.convertNodesToSteps(data.workflowData.nodes);

    return prisma.automation.create({
      data: {
        name: data.name,
        status: AutomationStatus.DRAFT,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        workflowData: data.workflowData,
        tenantId,
        workflowSteps: {
          create: workflowSteps,
        },
      },
    });
  }

  /**
   * Update an automation
   */
  async updateAutomation(
    id: string,
    tenantId: string,
    data: UpdateAutomationRequest
  ): Promise<Automation> {
    const automation = await prisma.automation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw new Error('Automation not found');
    }

    // If workflow data is being updated, validate and convert to steps
    let workflowStepsUpdate = {};
    if (data.workflowData) {
      this.validateWorkflowData(data.workflowData);
      const workflowSteps = this.convertNodesToSteps(data.workflowData.nodes);
      
      workflowStepsUpdate = {
        workflowSteps: {
          deleteMany: { automationId: id },
          create: workflowSteps,
        },
      };
    }

    return prisma.automation.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.status && { status: data.status }),
        ...(data.triggerType && { triggerType: data.triggerType }),
        ...(data.triggerConfig && { triggerConfig: data.triggerConfig }),
        ...(data.workflowData && { workflowData: data.workflowData }),
        ...workflowStepsUpdate,
      },
    });
  }

  /**
   * Delete an automation
   */
  async deleteAutomation(id: string, tenantId: string): Promise<void> {
    const automation = await prisma.automation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw new Error('Automation not found');
    }

    // Can't delete active automations
    if (automation.status === AutomationStatus.ACTIVE) {
      throw new Error('Cannot delete active automation. Please pause it first.');
    }

    await prisma.automation.delete({
      where: { id },
    });
  }

  /**
   * Duplicate an automation
   */
  async duplicateAutomation(id: string, tenantId: string): Promise<Automation> {
    const automation = await this.getAutomation(id, tenantId);
    
    if (!automation) {
      throw new Error('Automation not found');
    }

    return this.createAutomation(tenantId, {
      name: `${automation.name} (Copy)`,
      triggerType: automation.triggerType,
      triggerConfig: automation.triggerConfig,
      workflowData: automation.workflowData,
    });
  }

  /**
   * Get available trigger configurations
   */
  getTriggerConfigurations(): TriggerConfiguration[] {
    return [
      {
        type: TriggerType.SUBSCRIPTION,
        name: 'New Subscription',
        description: 'Triggered when someone subscribes to a list',
        icon: '👤',
        config: {
          fields: [
            {
              key: 'listId',
              label: 'List',
              type: 'list',
              required: true,
              description: 'Select the list to monitor for new subscriptions',
            },
          ],
        },
      },
      {
        type: TriggerType.DATE_BASED,
        name: 'Date/Time',
        description: 'Triggered at a specific date and time',
        icon: '📅',
        config: {
          fields: [
            {
              key: 'date',
              label: 'Date',
              type: 'date',
              required: true,
              description: 'Select the date to trigger the automation',
            },
            {
              key: 'recurring',
              label: 'Recurring',
              type: 'boolean',
              required: false,
              description: 'Should this trigger repeat?',
            },
            {
              key: 'interval',
              label: 'Interval',
              type: 'select',
              required: false,
              options: [
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ],
              description: 'How often should this repeat?',
            },
          ],
        },
      },
      {
        type: TriggerType.EMAIL_OPENED,
        name: 'Email Opened',
        description: 'Triggered when a subscriber opens an email',
        icon: '📧',
        config: {
          fields: [
            {
              key: 'campaignId',
              label: 'Campaign',
              type: 'select',
              required: false,
              description: 'Specific campaign to monitor (leave empty for any campaign)',
            },
            {
              key: 'delay',
              label: 'Delay (minutes)',
              type: 'number',
              required: false,
              placeholder: '0',
              description: 'Wait time before triggering (in minutes)',
            },
          ],
        },
      },
      {
        type: TriggerType.EMAIL_CLICKED,
        name: 'Email Clicked',
        description: 'Triggered when a subscriber clicks a link in an email',
        icon: '🖱️',
        config: {
          fields: [
            {
              key: 'campaignId',
              label: 'Campaign',
              type: 'select',
              required: false,
              description: 'Specific campaign to monitor (leave empty for any campaign)',
            },
            {
              key: 'linkUrl',
              label: 'Link URL',
              type: 'text',
              required: false,
              placeholder: 'https://example.com',
              description: 'Specific link to monitor (leave empty for any link)',
            },
          ],
        },
      },
      {
        type: TriggerType.LIST_JOINED,
        name: 'List Joined',
        description: 'Triggered when a subscriber joins a specific list',
        icon: '📋',
        config: {
          fields: [
            {
              key: 'listId',
              label: 'List',
              type: 'list',
              required: true,
              description: 'Select the list to monitor',
            },
          ],
        },
      },
      {
        type: TriggerType.CUSTOM_FIELD_CHANGED,
        name: 'Custom Field Changed',
        description: 'Triggered when a custom field value changes',
        icon: '🏷️',
        config: {
          fields: [
            {
              key: 'fieldName',
              label: 'Field Name',
              type: 'text',
              required: true,
              placeholder: 'field_name',
              description: 'Name of the custom field to monitor',
            },
            {
              key: 'value',
              label: 'Value',
              type: 'text',
              required: false,
              placeholder: 'specific value',
              description: 'Specific value to monitor (leave empty for any change)',
            },
          ],
        },
      },
    ];
  }

  /**
   * Get available action configurations
   */
  getActionConfigurations(): ActionConfiguration[] {
    return [
      {
        type: 'send_email',
        name: 'Send Email',
        description: 'Send an email to the subscriber',
        icon: '📧',
        category: 'email',
        config: {
          fields: [
            {
              key: 'templateId',
              label: 'Email Template',
              type: 'template',
              required: true,
              description: 'Select the email template to send',
            },
            {
              key: 'subject',
              label: 'Subject Line',
              type: 'text',
              required: true,
              placeholder: 'Email subject',
              description: 'Subject line for the email',
            },
            {
              key: 'fromName',
              label: 'From Name',
              type: 'text',
              required: false,
              placeholder: 'Your Name',
              description: 'Sender name (optional)',
            },
            {
              key: 'fromEmail',
              label: 'From Email',
              type: 'email',
              required: false,
              placeholder: 'you@example.com',
              description: 'Sender email (optional)',
            },
          ],
        },
      },
      {
        type: 'add_to_list',
        name: 'Add to List',
        description: 'Add subscriber to a list',
        icon: '➕',
        category: 'list',
        config: {
          fields: [
            {
              key: 'listId',
              label: 'List',
              type: 'list',
              required: true,
              description: 'Select the list to add the subscriber to',
            },
          ],
        },
      },
      {
        type: 'remove_from_list',
        name: 'Remove from List',
        description: 'Remove subscriber from a list',
        icon: '➖',
        category: 'list',
        config: {
          fields: [
            {
              key: 'listId',
              label: 'List',
              type: 'list',
              required: true,
              description: 'Select the list to remove the subscriber from',
            },
          ],
        },
      },
      {
        type: 'update_field',
        name: 'Update Custom Field',
        description: 'Update a custom field value',
        icon: '🏷️',
        category: 'subscriber',
        config: {
          fields: [
            {
              key: 'fieldName',
              label: 'Field Name',
              type: 'text',
              required: true,
              placeholder: 'field_name',
              description: 'Name of the custom field to update',
            },
            {
              key: 'value',
              label: 'Value',
              type: 'text',
              required: true,
              placeholder: 'new value',
              description: 'New value for the field',
            },
          ],
        },
      },
      {
        type: 'wait',
        name: 'Wait',
        description: 'Wait for a specified amount of time',
        icon: '⏰',
        category: 'delay',
        config: {
          fields: [
            {
              key: 'duration',
              label: 'Duration',
              type: 'number',
              required: true,
              placeholder: '1',
              description: 'How long to wait',
            },
            {
              key: 'unit',
              label: 'Unit',
              type: 'select',
              required: true,
              options: [
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
                { value: 'weeks', label: 'Weeks' },
              ],
              description: 'Time unit',
            },
          ],
        },
      },
      {
        type: 'condition',
        name: 'Condition',
        description: 'Branch based on subscriber data',
        icon: '🔀',
        category: 'condition',
        config: {
          fields: [
            {
              key: 'field',
              label: 'Field',
              type: 'text',
              required: true,
              placeholder: 'email',
              description: 'Field to check (email, firstName, lastName, or custom field)',
            },
            {
              key: 'operator',
              label: 'Operator',
              type: 'select',
              required: true,
              options: [
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' },
                { value: 'contains', label: 'Contains' },
                { value: 'not_contains', label: 'Does Not Contain' },
                { value: 'starts_with', label: 'Starts With' },
                { value: 'ends_with', label: 'Ends With' },
                { value: 'is_empty', label: 'Is Empty' },
                { value: 'is_not_empty', label: 'Is Not Empty' },
              ],
              description: 'Comparison operator',
            },
            {
              key: 'value',
              label: 'Value',
              type: 'text',
              required: false,
              placeholder: 'comparison value',
              description: 'Value to compare against',
            },
          ],
        },
      },
    ];
  }

  /**
   * Validate workflow data structure
   */
  private validateWorkflowData(workflowData: { nodes: WorkflowNode[]; connections: WorkflowConnection[] }): void {
    const { nodes, connections } = workflowData;

    // Must have at least one trigger node
    const triggerNodes = nodes.filter(node => node.type === WorkflowNodeType.TRIGGER);
    if (triggerNodes.length === 0) {
      throw new Error('Workflow must have at least one trigger node');
    }

    // Validate node connections
    for (const connection of connections) {
      const sourceNode = nodes.find(node => node.id === connection.sourceNodeId);
      const targetNode = nodes.find(node => node.id === connection.targetNodeId);

      if (!sourceNode || !targetNode) {
        throw new Error('Invalid connection: source or target node not found');
      }
    }

    // Validate that all nodes (except triggers) have incoming connections
    for (const node of nodes) {
      if (node.type !== WorkflowNodeType.TRIGGER) {
        const hasIncomingConnection = connections.some(conn => conn.targetNodeId === node.id);
        if (!hasIncomingConnection) {
          throw new Error(`Node "${node.data.label}" has no incoming connections`);
        }
      }
    }
  }

  /**
   * Convert workflow nodes to workflow steps for database storage
   */
  private convertNodesToSteps(nodes: WorkflowNode[]): Array<{
    stepType: string;
    stepConfig: Record<string, any>;
    position: number;
  }> {
    return nodes
      .filter(node => node.type !== WorkflowNodeType.TRIGGER)
      .map((node, index) => ({
        stepType: node.type,
        stepConfig: {
          ...node.data.config,
          nodeId: node.id,
          label: node.data.label,
          description: node.data.description,
        },
        position: index,
      }));
  }
}

export const automationService = new AutomationService();