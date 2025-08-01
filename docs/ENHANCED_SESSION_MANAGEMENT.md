# Enhanced Session Management and Security

This document describes the enhanced session management and security features implemented for the email marketing platform.

## Overview

The enhanced session management system provides comprehensive session tracking, device management, security monitoring, and threat detection capabilities. It extends the basic NextAuth.js session management with advanced security features.

## Features

### 1. Session Timeout and Automatic Renewal

- **Configurable session timeouts**: Users can set session timeouts from 30 minutes to 24 hours
- **Automatic session renewal**: Sessions are automatically extended on user activity
- **Sliding window expiration**: Session expiration time is updated with each request
- **Grace period handling**: Sessions have a grace period before hard expiration

### 2. Device Tracking and Management

- **Device fingerprinting**: Unique device identification based on browser, OS, and other factors
- **Device information parsing**: Extracts browser, OS, device type from user agent
- **Session device binding**: Sessions are bound to specific devices for security
- **Device name generation**: Human-readable device names (e.g., "Chrome on Windows")

### 3. Concurrent Session Limits

- **Configurable limits**: Users can set maximum concurrent sessions (1-10)
- **Automatic session termination**: Oldest sessions are terminated when limit is exceeded
- **Session management UI**: Users can view and terminate active sessions
- **Real-time session monitoring**: Track active sessions across devices

### 4. Session Activity Logging

- **Comprehensive activity tracking**: All user actions are logged with context
- **Risk score calculation**: Each activity is assigned a risk score
- **IP address tracking**: Monitor IP changes and unusual locations
- **User agent monitoring**: Detect browser/device changes
- **Metadata collection**: Store additional context for security analysis

### 5. Suspicious Activity Detection

- **Failed login monitoring**: Track and limit failed login attempts
- **Unusual location detection**: Alert on logins from new geographic locations
- **Rapid IP changes**: Detect potential session hijacking attempts
- **Concurrent session abuse**: Monitor for excessive concurrent sessions
- **Behavioral analysis**: Pattern recognition for suspicious activities

### 6. Remember Me Functionality

- **Secure token management**: Long-lived tokens for persistent authentication
- **Device-specific tokens**: Remember me tokens are bound to specific devices
- **Configurable expiration**: 30-day default expiration with user control
- **Secure storage**: Tokens are hashed and stored securely
- **Automatic cleanup**: Expired tokens are automatically removed

## Database Schema

### UserSession Table

```sql
CREATE TABLE user_sessions (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  session_token VARCHAR(191) UNIQUE NOT NULL,
  device_id VARCHAR(191),
  device_name VARCHAR(191),
  device_type VARCHAR(191),
  browser VARCHAR(191),
  browser_version VARCHAR(191),
  os VARCHAR(191),
  os_version VARCHAR(191),
  ip_address VARCHAR(191) NOT NULL,
  location JSON,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### SessionActivity Table

```sql
CREATE TABLE session_activities (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  session_id VARCHAR(191),
  action VARCHAR(191) NOT NULL,
  resource VARCHAR(191),
  ip_address VARCHAR(191) NOT NULL,
  user_agent TEXT,
  location JSON,
  metadata JSON,
  risk_score FLOAT,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason VARCHAR(191),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### RememberToken Table

```sql
CREATE TABLE remember_tokens (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  token_hash VARCHAR(191) UNIQUE NOT NULL,
  device_id VARCHAR(191),
  device_fingerprint VARCHAR(191),
  ip_address VARCHAR(191) NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### SecurityEvent Table

```sql
CREATE TABLE security_events (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191),
  tenant_id VARCHAR(191),
  event_type ENUM('FAILED_LOGIN', 'SUSPICIOUS_LOGIN', 'MULTIPLE_FAILED_ATTEMPTS', ...),
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
  description TEXT NOT NULL,
  ip_address VARCHAR(191),
  user_agent TEXT,
  location JSON,
  metadata JSON,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at DATETIME,
  resolved_by VARCHAR(191),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Session Management

- `GET /api/auth/session` - Get current session info and active sessions
- `POST /api/auth/session` - Create enhanced session (login with tracking)
- `DELETE /api/auth/session` - Logout and invalidate session
- `PATCH /api/auth/session` - Update session preferences

### Session Activities

- `GET /api/auth/session/activities` - Get session activities and security events
- `POST /api/auth/session/activities` - Mark security events as resolved

## Security Features

### Risk Score Calculation

The system calculates a risk score (0-100) for each session based on:

- **Failed login attempts** (+50 points, blocks at 5 attempts)
- **New location** (+20 points)
- **Concurrent session limit** (+30 points)
- **Suspicious activity pattern** (+40 points)
- **Rapid IP changes** (+25 points)

### Automatic Blocking

Sessions are automatically blocked when:

- Risk score exceeds 70 points
- More than 5 failed login attempts in 1 hour
- Session hijacking is detected (IP/User-Agent mismatch)
- Concurrent session limit is exceeded

### Security Events

The system logs security events for:

- Failed login attempts
- Suspicious login patterns
- Multiple failed attempts
- Unusual location access
- Concurrent session limit violations
- Session hijacking attempts
- Brute force attempts
- Account lockouts

## Configuration

### User Preferences

Users can configure:

- **Session timeout**: 30 minutes to 24 hours
- **Max concurrent sessions**: 1 to 10 sessions
- **Remember me**: Enable/disable persistent authentication

### System Configuration

Administrators can configure:

- **Default session timeout**: System-wide default
- **Maximum failed attempts**: Before account lockout
- **Lockout duration**: How long accounts are locked
- **Risk score thresholds**: For automatic blocking
- **Cleanup intervals**: For expired sessions and tokens

## Usage Examples

### Creating an Enhanced Session

```typescript
import { createUserSession } from '@/lib/session-management';

const { sessionToken, rememberToken } = await createUserSession(
  userId,
  request,
  rememberMe,
  location
);
```

### Validating a Session

```typescript
import { validateSession } from '@/lib/session-management';

const sessionInfo = await validateSession(sessionToken, request);
if (!sessionInfo) {
  // Session is invalid or expired
}
```

### Using Enhanced Session Middleware

```typescript
import { withEnhancedSession } from '@/lib/enhanced-session-middleware';

export const GET = withEnhancedSession(async (request, sessionData) => {
  // Access enhanced session data
  const { userId, tenantId, securityScore, isSecure } = sessionData;

  if (!isSecure) {
    return NextResponse.json({ error: 'Secure session required' }, { status: 403 });
  }

  // Handle request with session context
});
```

### Session Management UI

```typescript
import { SessionManager } from '@/components/auth/SessionManager';

// In your settings page
<SessionManager />;
```

## Security Best Practices

1. **Always validate sessions**: Use the enhanced session middleware for sensitive operations
2. **Monitor security events**: Regularly review security events and resolve them
3. **Configure appropriate timeouts**: Balance security and user experience
4. **Limit concurrent sessions**: Prevent session abuse
5. **Enable remember me carefully**: Only for trusted devices
6. **Regular cleanup**: Ensure expired sessions and tokens are cleaned up
7. **Monitor risk scores**: Set up alerts for high-risk activities

## Monitoring and Maintenance

### Automatic Cleanup

The system automatically:

- Deactivates expired sessions
- Removes expired remember tokens
- Cleans up old session activities (90-day retention)
- Removes resolved security events (180-day retention)

### Health Monitoring

Monitor these metrics:

- Active session count
- Recent activity count
- Unresolved security events
- High-risk activities
- Failed login attempts

### Performance Considerations

- Session validation is optimized with database indexes
- Cleanup operations run during low-traffic periods
- Risk score calculation is cached for performance
- Device fingerprinting is lightweight and fast

## Troubleshooting

### Common Issues

1. **Sessions expiring too quickly**: Check session timeout configuration
2. **Too many security events**: Review risk score thresholds
3. **Users locked out**: Check failed attempt limits and lockout duration
4. **Performance issues**: Monitor database query performance and indexes
5. **Remember me not working**: Verify token expiration and device binding

### Debug Information

Enable debug logging to see:

- Session creation and validation details
- Risk score calculation factors
- Security event triggers
- Device fingerprinting results

## Migration Guide

When upgrading from basic session management:

1. Run database migrations to create new tables
2. Update authentication configuration
3. Add enhanced session middleware to your routes
4. Update UI components to use session management features
5. Configure cleanup service for production
6. Set up monitoring and alerting

## Future Enhancements

Planned improvements:

- Machine learning-based risk assessment
- Integration with external threat intelligence
- Advanced device fingerprinting
- Biometric authentication support
- Real-time session monitoring dashboard
- Advanced analytics and reporting
