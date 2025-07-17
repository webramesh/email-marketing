/**
 * Role-Based Access Control (RBAC) System
 * Defines permissions and resources for the email marketing platform
 */

import { UserRole } from '@/types'

/**
 * Resource enum defines all available resources in the system
 * Resources are entities or objects that users can perform actions on
 */
export enum Resource {
  // User Management
  USERS = 'users',
  USER_ROLES = 'user_roles',
  
  // Campaign Management
  CAMPAIGNS = 'campaigns',
  EMAIL_TEMPLATES = 'email_templates',
  
  // Subscriber Management
  SUBSCRIBERS = 'subscribers',
  LISTS = 'lists',
  SEGMENTS = 'segments',
  
  // Automation
  AUTOMATIONS = 'automations',
  WORKFLOWS = 'workflows',
  
  // Analytics & Reporting
  ANALYTICS = 'analytics',
  REPORTS = 'reports',
  
  // Email Infrastructure
  SENDING_SERVERS = 'sending_servers',
  DOMAINS = 'domains',
  EMAIL_VERIFICATION = 'email_verification',
  
  // Forms & Lead Generation
  FORMS = 'forms',
  LANDING_PAGES = 'landing_pages',
  
  // Support System
  SUPPORT_TICKETS = 'support_tickets',
  
  // Billing & Payments
  BILLING = 'billing',
  PAYMENTS = 'payments',
  SUBSCRIPTION_PLANS = 'subscription_plans',
  
  // API & Integrations
  API_KEYS = 'api_keys',
  WEBHOOKS = 'webhooks',
  
  // System Administration
  TENANT_SETTINGS = 'tenant_settings',
  AUDIT_LOGS = 'audit_logs',
  SYSTEM_SETTINGS = 'system_settings',
}

// Define all available actions
export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // Full access (create, read, update, delete)
  EXECUTE = 'execute', // For actions like sending campaigns, running automations
  EXPORT = 'export',
  IMPORT = 'import',
}

// Permission interface
export interface Permission {
  resource: Resource
  actions: Action[]
}

// Role-based permissions configuration
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Full access to all resources
    { resource: Resource.USERS, actions: [Action.MANAGE] },
    { resource: Resource.USER_ROLES, actions: [Action.MANAGE] },
    { resource: Resource.CAMPAIGNS, actions: [Action.MANAGE, Action.EXECUTE] },
    { resource: Resource.EMAIL_TEMPLATES, actions: [Action.MANAGE] },
    { resource: Resource.SUBSCRIBERS, actions: [Action.MANAGE, Action.IMPORT, Action.EXPORT] },
    { resource: Resource.LISTS, actions: [Action.MANAGE] },
    { resource: Resource.SEGMENTS, actions: [Action.MANAGE] },
    { resource: Resource.AUTOMATIONS, actions: [Action.MANAGE, Action.EXECUTE] },
    { resource: Resource.WORKFLOWS, actions: [Action.MANAGE] },
    { resource: Resource.ANALYTICS, actions: [Action.READ, Action.EXPORT] },
    { resource: Resource.REPORTS, actions: [Action.MANAGE, Action.EXPORT] },
    { resource: Resource.SENDING_SERVERS, actions: [Action.MANAGE] },
    { resource: Resource.DOMAINS, actions: [Action.MANAGE] },
    { resource: Resource.EMAIL_VERIFICATION, actions: [Action.MANAGE] },
    { resource: Resource.FORMS, actions: [Action.MANAGE] },
    { resource: Resource.LANDING_PAGES, actions: [Action.MANAGE] },
    { resource: Resource.SUPPORT_TICKETS, actions: [Action.MANAGE] },
    { resource: Resource.BILLING, actions: [Action.READ] },
    { resource: Resource.PAYMENTS, actions: [Action.READ] },
    { resource: Resource.SUBSCRIPTION_PLANS, actions: [Action.READ] },
    { resource: Resource.API_KEYS, actions: [Action.MANAGE] },
    { resource: Resource.WEBHOOKS, actions: [Action.MANAGE] },
    { resource: Resource.TENANT_SETTINGS, actions: [Action.MANAGE] },
    { resource: Resource.AUDIT_LOGS, actions: [Action.READ, Action.EXPORT] },
    { resource: Resource.SYSTEM_SETTINGS, actions: [Action.MANAGE] },
  ],

  [UserRole.USER]: [
    // Standard user permissions
    { resource: Resource.CAMPAIGNS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
    { resource: Resource.EMAIL_TEMPLATES, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.SUBSCRIBERS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.IMPORT, Action.EXPORT] },
    { resource: Resource.LISTS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.SEGMENTS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.AUTOMATIONS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE] },
    { resource: Resource.WORKFLOWS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.ANALYTICS, actions: [Action.READ] },
    { resource: Resource.REPORTS, actions: [Action.CREATE, Action.READ, Action.EXPORT] },
    { resource: Resource.DOMAINS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.EMAIL_VERIFICATION, actions: [Action.CREATE, Action.READ] },
    { resource: Resource.FORMS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.LANDING_PAGES, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.SUPPORT_TICKETS, actions: [Action.CREATE, Action.READ, Action.UPDATE] },
    { resource: Resource.API_KEYS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
    { resource: Resource.WEBHOOKS, actions: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
  ],

  [UserRole.SUPPORT]: [
    // Support staff permissions
    { resource: Resource.USERS, actions: [Action.READ] },
    { resource: Resource.CAMPAIGNS, actions: [Action.READ] },
    { resource: Resource.EMAIL_TEMPLATES, actions: [Action.READ] },
    { resource: Resource.SUBSCRIBERS, actions: [Action.READ, Action.UPDATE] },
    { resource: Resource.LISTS, actions: [Action.READ] },
    { resource: Resource.SEGMENTS, actions: [Action.READ] },
    { resource: Resource.AUTOMATIONS, actions: [Action.READ] },
    { resource: Resource.WORKFLOWS, actions: [Action.READ] },
    { resource: Resource.ANALYTICS, actions: [Action.READ] },
    { resource: Resource.REPORTS, actions: [Action.READ, Action.EXPORT] },
    { resource: Resource.SENDING_SERVERS, actions: [Action.READ] },
    { resource: Resource.DOMAINS, actions: [Action.READ] },
    { resource: Resource.EMAIL_VERIFICATION, actions: [Action.READ] },
    { resource: Resource.FORMS, actions: [Action.READ] },
    { resource: Resource.LANDING_PAGES, actions: [Action.READ] },
    { resource: Resource.SUPPORT_TICKETS, actions: [Action.MANAGE] },
    { resource: Resource.BILLING, actions: [Action.READ] },
    { resource: Resource.PAYMENTS, actions: [Action.READ] },
    { resource: Resource.AUDIT_LOGS, actions: [Action.READ] },
  ],
}

/**
 * Check if a user role has permission to perform an action on a resource
 * @param userRole The user's role
 * @param resource The resource being accessed
 * @param action The action being performed
 * @returns boolean indicating if the user has permission
 */
export function hasPermission(
  userRole: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole]
  
  if (!rolePermissions) {
    return false
  }

  const resourcePermission = rolePermissions.find(p => p.resource === resource)
  
  if (!resourcePermission) {
    return false
  }

  // Check if user has the specific action or MANAGE permission (which includes all actions)
  return resourcePermission.actions.includes(action) || 
         resourcePermission.actions.includes(Action.MANAGE)
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || []
}

/**
 * Get all resources a user role can access
 */
export function getAccessibleResources(userRole: UserRole): Resource[] {
  const permissions = getRolePermissions(userRole)
  return permissions.map(p => p.resource)
}

/**
 * Get all actions a user role can perform on a specific resource
 */
export function getResourceActions(userRole: UserRole, resource: Resource): Action[] {
  const permissions = getRolePermissions(userRole)
  const resourcePermission = permissions.find(p => p.resource === resource)
  
  if (!resourcePermission) {
    return []
  }

  // If user has MANAGE permission, return all actions
  if (resourcePermission.actions.includes(Action.MANAGE)) {
    return [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.EXECUTE, Action.EXPORT, Action.IMPORT]
  }

  return resourcePermission.actions
}

/**
 * Check if a user role can manage other users
 */
export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, Resource.USERS, Action.MANAGE) ||
         hasPermission(userRole, Resource.USER_ROLES, Action.MANAGE)
}

/**
 * Check if a user role has admin privileges
 */
export function isAdminRole(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN
}

/**
 * Check if a user role has support privileges
 */
export function isSupportRole(userRole: UserRole): boolean {
  return userRole === UserRole.SUPPORT || userRole === UserRole.ADMIN
}