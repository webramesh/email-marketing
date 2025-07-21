/**
 * Common types used throughout the application
 */

// Tenant types
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// User types
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SUPPORT = 'SUPPORT',
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  tenantId: string;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Campaign types
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export enum CampaignType {
  REGULAR = 'REGULAR',
  AB_TEST = 'AB_TEST',
  AUTOMATION = 'AUTOMATION',
  TRANSACTIONAL = 'TRANSACTIONAL',
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader?: string | null;
  content: string;
  plainTextContent?: string | null;
  status: CampaignStatus;
  campaignType: CampaignType;
  
  // Scheduling
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  
  // Settings
  fromName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  trackOpens: boolean;
  trackClicks: boolean;
  
  // A/B Testing
  isAbTest: boolean;
  abTestSettings?: any;
  
  // Lists and Segments
  targetLists?: string[] | null;
  targetSegments?: string[] | null;
  
  // Template and Design
  templateData?: any;
  customCss?: string | null;
  
  // Statistics
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalBounced: number;
  totalComplained: number;
  
  // Metadata
  tags?: string[] | null;
  notes?: string | null;
  
  tenantId: string;
  templateId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignWithDetails extends Campaign {
  template?: {
    id: string;
    name: string;
    subject: string;
  } | null;
  abTestVariants?: CampaignVariant[];
  analytics?: CampaignAnalytics;
}

export interface CampaignVariant {
  id: string;
  campaignId: string;
  name: string;
  subject: string;
  preheader?: string | null;
  content: string;
  templateData?: any;
  percentage: number;
  
  // Statistics
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalBounced: number;
  totalComplained: number;
  
  // A/B test results
  conversionRate: number;
  isWinner: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignAnalytics {
  id: string;
  campaignId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  totalBounced: number;
  totalComplained: number;
  createdAt: Date;
  updatedAt: Date;
}

// Campaign creation and update DTOs
export interface CreateCampaignRequest {
  name: string;
  subject: string;
  preheader?: string;
  content?: string;
  campaignType?: CampaignType;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  targetLists?: string[];
  targetSegments?: string[];
  templateId?: string;
  tags?: string[];
  notes?: string;
  scheduledAt?: Date;
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  status?: CampaignStatus;
  templateData?: any;
  customCss?: string;
}

// Subscriber types
export enum SubscriberStatus {
  ACTIVE = 'ACTIVE',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  BOUNCED = 'BOUNCED',
  COMPLAINED = 'COMPLAINED',
  INVALID = 'INVALID',
}

export interface Subscriber {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: SubscriberStatus;
  customFields?: Record<string, any> | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriberWithDetails extends Subscriber {
  lists: Array<{
    id: string;
    list: {
      id: string;
      name: string;
    };
  }>;
  emailEvents?: Array<{
    id: string;
    type: string;
    createdAt: Date;
    campaign?: {
      id: string;
      name: string;
      subject: string;
    };
  }>;
  _count?: {
    emailEvents: number;
  };
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// List types
export interface List {
  id: string;
  name: string;
  description?: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListWithDetails extends List {
  subscribers: Array<{
    id: string;
    subscriber: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      status: SubscriberStatus;
    };
    createdAt: Date;
  }>;
  _count?: {
    subscribers: number;
  };
}

export interface ListAnalytics {
  id: string;
  listId: string;
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedSubscribers: number;
  bouncedSubscribers: number;
  complainedSubscribers: number;
  invalidSubscribers: number;
  growthRate: number;
  engagementRate: number;
  lastUpdated: Date;
}

// Segment types
export interface SegmentCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'between' | 'not_between';
  value?: any;
  secondValue?: any;
}

export interface SegmentConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: SegmentCondition[];
  groups?: SegmentConditionGroup[];
}

export interface SegmentConditions {
  operator: 'AND' | 'OR';
  rules: SegmentCondition[];
  groups?: SegmentConditionGroup[];
}

export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  conditions: any;
  subscriberCount: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
}

export interface SegmentField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  options?: Array<{ value: any; label: string }>;
  operators: string[];
}

// Email Verification types
export enum VerificationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  RISKY = 'RISKY',
  UNKNOWN = 'UNKNOWN',
}

export interface EmailVerification {
  id: string;
  email: string;
  status: VerificationStatus;
  verificationData?: Record<string, any> | null;
  verifiedAt?: Date | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  status: VerificationStatus;
  reason?: string;
  score?: number;
  details: {
    syntax: boolean;
    domain: boolean;
    mailbox?: boolean;
    disposable?: boolean;
    role?: boolean;
    free?: boolean;
    mx?: boolean;
    smtp?: boolean;
  };
  provider?: string;
  suggestion?: string;
}

export interface BulkVerificationJob {
  id: string;
  tenantId: string;
  totalEmails: number;
  processedEmails: number;
  validEmails: number;
  invalidEmails: number;
  riskyEmails: number;
  unknownEmails: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface BulkVerificationRequest {
  emails: string[];
  listId?: string;
  removeInvalid?: boolean;
  removeRisky?: boolean;
}

// Automation and Workflow types
export enum AutomationStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
}

export enum WorkflowNodeType {
  TRIGGER = 'TRIGGER',
  ACTION = 'ACTION',
  CONDITION = 'CONDITION',
  DELAY = 'DELAY',
  EMAIL = 'EMAIL',
  WAIT = 'WAIT',
  SPLIT = 'SPLIT',
  MERGE = 'MERGE',
}

export enum TriggerType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  DATE_BASED = 'DATE_BASED',
  BEHAVIOR_BASED = 'BEHAVIOR_BASED',
  API_TRIGGERED = 'API_TRIGGERED',
  EVENT_DRIVEN = 'EVENT_DRIVEN',
  EMAIL_OPENED = 'EMAIL_OPENED',
  EMAIL_CLICKED = 'EMAIL_CLICKED',
  LIST_JOINED = 'LIST_JOINED',
  CUSTOM_FIELD_CHANGED = 'CUSTOM_FIELD_CHANGED',
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    config: Record<string, any>;
    isValid?: boolean;
    errors?: string[];
  };
  connections: {
    inputs: string[];
    outputs: string[];
  };
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: {
    type: 'always' | 'conditional';
    expression?: string;
    value?: any;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  thumbnail?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  triggerType: string;
  triggerConfig: Record<string, any>;
  workflowData: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  };
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationWithDetails extends Automation {
  workflowSteps: WorkflowStep[];
  executions: AutomationExecution[];
  _count?: {
    executions: number;
  };
}

export interface WorkflowStep {
  id: string;
  automationId: string;
  stepType: string;
  stepConfig: Record<string, any>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  subscriberId: string;
  status: ExecutionStatus;
  currentStep: number;
  executionData?: Record<string, any> | null;
  startedAt: Date;
  completedAt?: Date | null;
  tenantId: string;
}

export interface AutomationExecutionWithDetails extends AutomationExecution {
  automation: {
    id: string;
    name: string;
  };
  subscriber: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface CreateAutomationRequest {
  name: string;
  triggerType: string;
  triggerConfig: Record<string, any>;
  workflowData: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  };
}

export interface UpdateAutomationRequest extends Partial<CreateAutomationRequest> {
  status?: AutomationStatus;
}

export interface TriggerConfiguration {
  type: TriggerType;
  name: string;
  description: string;
  icon: string;
  config: {
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'list' | 'segment';
      required: boolean;
      options?: Array<{ value: any; label: string }>;
      placeholder?: string;
      description?: string;
    }>;
  };
}

export interface ActionConfiguration {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: 'email' | 'subscriber' | 'list' | 'webhook' | 'delay' | 'condition';
  config: {
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'email' | 'template' | 'list' | 'segment';
      required: boolean;
      options?: Array<{ value: any; label: string }>;
      placeholder?: string;
      description?: string;
    }>;
  };
}

// Tenant context
export interface TenantContext {
  tenant: Tenant | null;
  tenantId: string | null;
}