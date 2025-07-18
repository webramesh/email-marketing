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

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: CampaignStatus;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
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

// Tenant context
export interface TenantContext {
  tenant: Tenant | null;
  tenantId: string | null;
}