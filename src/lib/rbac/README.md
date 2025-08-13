# Advanced Authorization and Package-Based Permissions

This directory contains the implementation of an advanced authorization system that combines role-based access control (RBAC) with package-based permissions for the email marketing platform.

## Overview

The system provides multi-layered authorization:

1. **Role-Based Permissions**: Traditional RBAC based on user roles (SUPERADMIN, ADMIN, USER, SUPPORT)
2. **Package-Based Permissions**: Dynamic permissions based on purchased packages and their features/quotas
3. **Feature Gates**: Control access to specific features based on package tiers
4. **Quota Management**: Enforce usage limits and track consumption
5. **Audit Trail**: Comprehensive logging of permission changes and access attempts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Enhanced Authorization                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Role-Based      │  │ Package-Based   │  │ Feature      │ │
│  │ Permissions     │  │ Permissions     │  │ Gates        │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Quota Management                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Usage Tracking  │  │ Limit Checking  │  │ Auto Update  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Audit Logging                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Permission      │  │ Quota Events    │  │ Security     │ │
│  │ Changes         │  │                 │  │ Events       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Package Permission Templates (`package-permissions.ts`)

Defines permission templates for different package tiers:

```typescript
export enum PackageTier {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD', 
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  UNLIMITED = 'UNLIMITED'
}
```

Each template includes:
- **Features**: Boolean flags for feature availability
- **Quotas**: Numeric limits for resource usage
- **Permissions**: Resource-action mappings with conditions
- **Restrictions**: Blocked features with user-friendly messages

### 2. Enhanced Authorization Service (`enhanced-authorization.ts`)

Main service that orchestrates permission checking:

```typescript
const result = await authService.checkEnhancedPermission(
  request,
  Resource.CAMPAIGNS,
  Action.CREATE
);

if (result.allowed && result.context) {
  // User has both role and package permissions
  // Access granted with full context
}
```

### 3. Permission Audit Service (`permission-audit.ts`)

Tracks all permission-related events:

```typescript
await auditService.logPermissionDenied(
  userId,
  tenantId,
  Resource.CAMPAIGNS,
  Action.CREATE,
  'Package permissions insufficient'
);
```

### 4. Package Permission Management (`package-permission.service.ts`)

Handles assignment and management of package-based permissions:

```typescript
await permissionService.assignPackageToUser({
  userId: 'user-123',
  tenantId: 'tenant-456',
  packageId: 'package-789',
  assignedBy: 'admin-001',
  reason: 'Upgrade to Standard plan'
});
```

## Middleware Usage

### Basic Enhanced Permission Check

```typescript
import { withEnhancedPermission } from '@/lib/rbac/authorization';

export const GET = withEnhancedPermission(
  handler,
  Resource.CAMPAIGNS,
  Action.READ
);
```

### Advanced Permission with Feature and Quota Checks

```typescript
import { withAdvancedPermission } from '@/lib/rbac/package-middleware';

export const POST = withAdvancedPermission(handler, {
  resource: Resource.CAMPAIGNS,
  action: Action.CREATE,
  feature: 'email_builder',
  quota: {
    type: 'monthly_campaigns',
    increment: 1,
    updateAfter: true
  }
});
```

### Feature-Only Check

```typescript
import { withFeatureCheck } from '@/lib/rbac/package-middleware';

export const POST = withFeatureCheck(
  handler,
  'advanced_analytics',
  Resource.ANALYTICS,
  Action.READ
);
```

### Quota-Only Check

```typescript
import { withQuotaCheck } from '@/lib/rbac/package-middleware';

export const POST = withQuotaCheck(
  handler,
  'monthly_emails',
  1000, // Increment by 1000 emails
  true  // Update usage after success
);
```

## React Hooks

### Permission Context Hook

```typescript
import { usePermissionContext } from '@/hooks/usePermissions';

function MyComponent() {
  const { context, loading, error } = usePermissionContext();
  
  if (context) {
    console.log('User packages:', context.packages);
    console.log('Available features:', context.features);
    console.log('Quota status:', context.quotaStatus);
  }
}
```

### Permission Check Hook

```typescript
import { useHasPermission } from '@/hooks/usePermissions';

function CampaignButton() {
  const { allowed, loading } = useHasPermission(
    Resource.CAMPAIGNS,
    Action.CREATE
  );
  
  return (
    <Button disabled={!allowed || loading}>
      Create Campaign
    </Button>
  );
}
```

### Feature Check Hook

```typescript
import { useHasFeature } from '@/hooks/usePermissions';

function AdvancedAnalytics() {
  const { available } = useHasFeature('advanced_analytics');
  
  if (!available) {
    return <UpgradePrompt feature="Advanced Analytics" />;
  }
  
  return <AnalyticsDashboard />;
}
```

### Quota Status Hook

```typescript
import { useQuotaStatus } from '@/hooks/usePermissions';

function EmailQuotaIndicator() {
  const { usage, checkBeforeAction } = useQuotaStatus('monthly_emails');
  
  const handleSendEmail = async () => {
    const result = await checkBeforeAction(1000);
    if (result.allowed) {
      // Proceed with sending
    } else {
      // Show quota exceeded message
    }
  };
  
  return (
    <div>
      <ProgressBar 
        value={usage?.used || 0} 
        max={usage?.limit || 0} 
      />
      <Button onClick={handleSendEmail}>Send Email</Button>
    </div>
  );
}
```

## API Endpoints

### Package Management

- `GET /api/permissions/packages` - Get user packages and templates
- `POST /api/permissions/packages` - Assign package or bulk update
- `PUT /api/permissions/packages` - Update package permissions
- `DELETE /api/permissions/packages` - Remove package from user

### Permission Checking

- `GET /api/permissions/check` - Get current user's permission context
- `POST /api/permissions/check` - Check specific permissions, quotas, or features

### Audit Logs

- `GET /api/permissions/audit` - Get permission audit history
- `POST /api/permissions/audit` - Get audit statistics or cleanup logs

## Package Templates

### Basic Package
- **Features**: Basic email builder, templates, tracking, analytics
- **Quotas**: 10K emails/month, 2K subscribers, 5 lists, 10 campaigns
- **Restrictions**: No automation, advanced segmentation, or custom domains

### Standard Package  
- **Features**: All Basic + automation, advanced analytics, A/B testing, API access
- **Quotas**: 50K emails/month, 10K subscribers, 25 lists, 50 campaigns, 10 automations
- **Restrictions**: No custom domains or white labeling

### Professional Package
- **Features**: All Standard + custom domains, white labeling, priority support
- **Quotas**: 250K emails/month, 50K subscribers, unlimited lists/campaigns
- **Restrictions**: Platform-specific limitations only

### Enterprise Package
- **Features**: All Professional + dedicated support, custom integrations
- **Quotas**: 1M+ emails/month, unlimited subscribers, advanced SLA
- **Restrictions**: None

## Security Considerations

1. **Principle of Least Privilege**: Users only get permissions from their active packages
2. **Defense in Depth**: Multiple layers of authorization (role + package + feature + quota)
3. **Audit Trail**: All permission changes and denials are logged
4. **Quota Enforcement**: Hard limits prevent resource abuse
5. **Feature Gates**: Granular control over feature access
6. **Secure Defaults**: Restrictive permissions by default

## Testing

Run the test suite:

```bash
npm test src/lib/rbac/__tests__/
```

Tests cover:
- Package permission checking logic
- Quota calculations and enforcement
- Feature availability checks
- Permission template validation
- Audit logging functionality

## Migration Guide

### From Basic RBAC to Enhanced Permissions

1. Replace `withPermission` with `withEnhancedPermission`:
```typescript
// Before
export const GET = withPermission(handler, Resource.CAMPAIGNS, Action.READ);

// After  
export const GET = withEnhancedPermission(handler, Resource.CAMPAIGNS, Action.READ);
```

2. Add quota checking for resource creation:
```typescript
export const POST = withAdvancedPermission(handler, {
  resource: Resource.CAMPAIGNS,
  action: Action.CREATE,
  quota: {
    type: 'monthly_campaigns',
    increment: 1,
    updateAfter: true
  }
});
```

3. Add feature gates for premium features:
```typescript
export const GET = withFeatureCheck(
  handler,
  'advanced_analytics',
  Resource.ANALYTICS,
  Action.READ
);
```

## Performance Considerations

1. **Caching**: Permission contexts are cached per request
2. **Lazy Loading**: Package data is only loaded when needed
3. **Batch Operations**: Bulk permission updates are optimized
4. **Async Updates**: Usage tracking happens asynchronously
5. **Database Indexes**: Proper indexing on permission-related queries

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check both role and package permissions
2. **Quota Exceeded**: Verify current usage vs. limits
3. **Feature Unavailable**: Confirm package includes required feature
4. **Audit Logs Missing**: Check audit service configuration

### Debug Mode

Enable debug logging:
```typescript
process.env.RBAC_DEBUG = 'true';
```

This will log detailed permission checking information to help diagnose issues.