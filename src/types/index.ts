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

// Tenant context
export interface TenantContext {
  tenant: Tenant | null;
  tenantId: string | null;
}