# OAuth Integration Setup Guide

This guide explains how to set up OAuth authentication with Google, GitHub, and Microsoft Entra ID for the email marketing platform.

## Overview

The platform supports OAuth authentication with the following providers:

- **Google OAuth 2.0** - For users with Google accounts
- **GitHub OAuth** - For developer-focused users
- **Microsoft Entra ID (Azure AD)** - For enterprise users

## Features

- **Account Linking**: Users can link multiple OAuth accounts to their existing account
- **Automatic Tenant Detection**: OAuth users are automatically assigned to the correct tenant
- **Social Sign-in**: Users can sign in using their social accounts
- **Account Management**: Users can manage their connected accounts from the profile page
- **Security**: OAuth tokens are securely stored and managed

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Microsoft Entra ID (Azure AD) OAuth
MICROSOFT_ENTRA_ID_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_ENTRA_ID_CLIENT_SECRET="your-microsoft-client-secret"
MICROSOFT_ENTRA_ID_TENANT_ID="your-microsoft-tenant-id"
```

## Provider Setup

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. Copy the Client ID and Client Secret to your `.env` file

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: Your app URL
   - Authorization callback URL:
     - `http://localhost:3000/api/auth/callback/github` (development)
     - `https://yourdomain.com/api/auth/callback/github` (production)
4. Copy the Client ID and Client Secret to your `.env` file

### Microsoft Entra ID Setup

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Fill in the application details:
   - Name: Your app name
   - Supported account types: Choose appropriate option
   - Redirect URI:
     - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (development)
     - `https://yourdomain.com/api/auth/callback/microsoft-entra-id` (production)
5. Go to "Certificates & secrets" and create a new client secret
6. Copy the Application (client) ID, Client Secret, and Directory (tenant) ID to your `.env` file

## Database Schema

The OAuth integration uses the `Account` model to store OAuth account information:

```prisma
model Account {
  id                String      @id @default(cuid())
  user              User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId            String
  type              String      // oauth, email, credentials
  provider          String      // google, github, microsoft-entra-id
  providerAccountId String      // The account ID from the provider
  refresh_token     String?     @db.LongText
  access_token      String?     @db.LongText
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?     @db.LongText
  session_state     String?

  // Additional OAuth data
  email             String?     // Email from OAuth provider
  name              String?     // Name from OAuth provider
  image             String?     // Profile image from OAuth provider

  // Linking metadata
  linkedAt          DateTime    @default(now())
  lastUsedAt        DateTime?
  isActive          Boolean     @default(true)

  // Security and audit
  ipAddress         String?
  userAgent         String?

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@index([provider])
  @@index([isActive])
  @@map("accounts")
}
```

## API Endpoints

### OAuth Account Management

- `GET /api/auth/oauth/accounts` - Get user's OAuth accounts
- `POST /api/auth/oauth/link` - Link OAuth account to user
- `POST /api/auth/oauth/unlink` - Unlink OAuth account from user

### NextAuth.js Callbacks

The OAuth integration uses NextAuth.js callbacks to handle:

- Account linking during sign-in
- Automatic tenant detection
- User creation for new OAuth users
- Token management and updates

## Components

### OAuthSignInButtons

Displays OAuth sign-in buttons on the login page:

```tsx
import { OAuthSignInButtons } from '@/components/auth/OAuthSignInButtons';

<OAuthSignInButtons callbackUrl="/dashboard" />;
```

### OAuthAccountManager

Manages connected OAuth accounts in the user profile:

```tsx
import { OAuthAccountManager } from '@/components/auth/OAuthAccountManager';

<OAuthAccountManager />;
```

## Security Considerations

1. **Token Storage**: OAuth tokens are stored securely in the database with encryption
2. **Scope Management**: Only necessary scopes are requested from OAuth providers
3. **Account Linking**: Prevents linking accounts that are already linked to other users
4. **Audit Logging**: All OAuth operations are logged for security auditing
5. **Session Management**: OAuth sessions are properly managed and expired

## Usage Flow

### New User OAuth Sign-in

1. User clicks OAuth provider button
2. User is redirected to provider for authentication
3. Provider redirects back with authorization code
4. System exchanges code for access token
5. System creates new user account and links OAuth account
6. User is signed in and redirected to dashboard

### Existing User OAuth Sign-in

1. User clicks OAuth provider button
2. User is redirected to provider for authentication
3. Provider redirects back with authorization code
4. System finds existing OAuth account
5. User is signed in and redirected to dashboard

### Account Linking

1. Signed-in user goes to profile page
2. User clicks "Connect" on desired OAuth provider
3. User is redirected to provider for authentication
4. Provider redirects back with authorization code
5. System links OAuth account to existing user account

### Account Unlinking

1. Signed-in user goes to profile page
2. User clicks "Unlink" on connected OAuth provider
3. System marks OAuth account as inactive
4. User can no longer sign in using that OAuth provider

## Troubleshooting

### Common Issues

1. **Invalid Redirect URI**: Ensure redirect URIs match exactly in provider settings
2. **Missing Scopes**: Verify required scopes are configured for each provider
3. **Token Expiration**: OAuth tokens are automatically refreshed when possible
4. **Account Already Linked**: Users cannot link accounts that are already linked to other users

### Debug Mode

Enable debug logging by setting `NEXTAUTH_DEBUG=true` in your environment variables.

## Testing

Run the OAuth service tests:

```bash
npm test -- oauth.service.test.ts
```

The tests cover:

- OAuth account finding and creation
- Account linking and unlinking
- OAuth sign-in flow
- Error handling scenarios
