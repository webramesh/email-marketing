# Multi-Factor Authentication Implementation

This document describes the Multi-Factor Authentication (MFA) implementation for the Email Marketing Platform.

## Overview

The MFA system provides an additional layer of security by requiring users to verify their identity using a second factor beyond just their password. The implementation supports:

1. **TOTP (Time-based One-Time Password)** - Compatible with authenticator apps like Google Authenticator, Microsoft Authenticator, Authy, etc.
2. **Email OTP (One-Time Password)** - Sends a verification code to the user's email address
3. **Backup Codes** - Single-use recovery codes for when the primary methods are unavailable

## Architecture

The MFA implementation consists of the following components:

### Core MFA Library (`src/lib/mfa.ts`)

- Handles generation and verification of TOTP secrets
- Manages email OTP generation and verification
- Provides backup code generation and verification
- Stores MFA state in the database

### MFA Middleware (`src/lib/mfa-middleware.ts`)

- Enforces MFA for sensitive operations
- Manages MFA sessions to prevent requiring verification for every request
- Provides route protection for both API routes and frontend pages

### UI Components

- `MFASetup.tsx` - Guides users through the MFA setup process
- `MFAVerification.tsx` - Handles verification using any of the supported methods

### API Routes

- `/api/auth/mfa/setup` - Generates TOTP setup data
- `/api/auth/mfa/enable` - Enables MFA after verification
- `/api/auth/mfa/disable` - Disables MFA (requires verification)
- `/api/auth/mfa/verify` - Verifies MFA tokens and creates MFA sessions
- `/api/auth/mfa/send-otp` - Sends email OTP codes
- `/api/auth/mfa/status` - Gets current MFA status

## Database Schema

The User model includes the following MFA-related fields:

```prisma
model User {
  // Other fields...
  mfaEnabled        Boolean     @default(false)
  mfaSecret         String?
  mfaBackupCodes    String[]    @default([])
  mfaLastVerified   DateTime?
}
```

- `mfaEnabled` - Whether MFA is enabled for the user
- `mfaSecret` - The TOTP secret key (stored encrypted)
- `mfaBackupCodes` - Array of hashed backup codes
- `mfaLastVerified` - Timestamp of the last successful verification

## Security Considerations

1. **Secret Storage**: TOTP secrets are stored in the database. In a production environment, these should be encrypted at rest.
2. **Backup Codes**: Backup codes are hashed using SHA-256 before storage.
3. **Session Management**: MFA sessions expire after 30 minutes of inactivity.
4. **Rate Limiting**: The implementation includes attempt limiting for email OTP verification.

## User Flow

### MFA Setup

1. User initiates MFA setup
2. System generates TOTP secret and QR code
3. User scans QR code with authenticator app
4. User verifies setup by entering a code from their authenticator app
5. System generates backup codes for the user
6. User saves backup codes
7. MFA is enabled for the user's account

### MFA Verification

1. User attempts to access a protected resource
2. System checks if user has MFA enabled
3. If MFA is enabled and no valid MFA session exists, user is redirected to verification
4. User chooses verification method (TOTP, Email OTP, or Backup Code)
5. User enters verification code
6. System verifies the code and creates an MFA session
7. User is granted access to the protected resource

## Protected Operations

The following operations require MFA verification:

- Disabling MFA
- Deleting user account
- Changing payment information
- Accessing admin functionality
- Deleting sensitive data (campaigns, subscribers, domains, etc.)

## Testing

The implementation includes comprehensive tests:

- Unit tests for core MFA functions
- Integration tests for API routes
- End-to-end tests for the complete MFA flow

A test user with MFA enabled is created in the seed data for testing purposes.

## Future Improvements

1. **SMS Verification**: Add support for SMS-based verification
2. **Push Notifications**: Implement push notification verification
3. **Hardware Key Support**: Add support for WebAuthn/FIDO2 hardware security keys
4. **Risk-Based MFA**: Implement risk scoring to require MFA only for suspicious activities
5. **Remember Device**: Allow users to remember trusted devices