import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import MicrosoftEntraIDProvider from 'next-auth/providers/microsoft-entra-id';
import { UserService } from '@/services/user.service';
import { OAuthService } from '@/services/oauth.service';
import { validateRememberToken } from './session-management';
import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';
import type { Account, Profile } from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';

// Helper function to get tenant context from request
async function getTenantFromRequest(): Promise<string | undefined> {
  try {
    // In a real implementation, this would extract tenant from:
    // - Subdomain (e.g., tenant1.example.com)
    // - Custom domain (e.g., tenant1.com)
    // - Request headers
    // For now, we'll return undefined to handle tenant-less OAuth
    return undefined;
  } catch (error) {
    console.error('Error getting tenant from request:', error);
    return undefined;
  }
}

// Extend NextAuth types to include custom properties
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      tenantId: string;
      tenant: {
        id: string;
        name: string;
        subdomain: string;
        customDomain?: string;
      };
      availableTenants?: {
        id: string;
        name: string;
        subdomain: string;
        customDomain?: string;
      }[];
      requiresPasswordChange?: boolean;
    };
    sessionCreated: number;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    tenantId: string;
    tenant: {
      id: string;
      name: string;
      subdomain: string;
      customDomain?: string;
    };
    availableTenants?: {
      id: string;
      name: string;
      subdomain: string;
      customDomain?: string;
    }[];
    requiresPasswordChange?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    tenantId: string;
    tenant: {
      id: string;
      name: string;
      subdomain: string;
      customDomain?: string;
    };
    availableTenants?: {
      id: string;
      name: string;
      subdomain: string;
      customDomain?: string;
    }[];
    sessionCreated: number;
    requiresPasswordChange?: boolean;
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    MicrosoftEntraIDProvider({
      clientId: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_ENTRA_ID_TENANT_ID || 'common'}/v2.0`,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text', optional: true },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const tenantId = credentials.tenantId as string | undefined;

        try {
          // Use the new UserService for enhanced authentication
          const authResult = await UserService.validateCredentials(email, password, tenantId);

          if (!authResult.isValid || !authResult.user) {
            console.log('Authentication failed:', authResult.error);
            return null;
          }

          const user = authResult.user;

          // Update last login timestamp
          await UserService.updateLastLogin(user.id);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            tenant: {
              id: user.tenant.id,
              name: user.tenant.name,
              subdomain: user.tenant.subdomain,
              customDomain: user.tenant.customDomain || undefined,
            },
            availableTenants: authResult.availableTenants?.map(tenant => ({
              id: tenant.id,
              name: tenant.name,
              subdomain: tenant.subdomain,
              customDomain: tenant.customDomain || undefined,
            })),
            requiresPasswordChange: authResult.requiresPasswordChange,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  callbacks: {
    async signIn(params: {
      user: User | AdapterUser;
      account?: Account | null | undefined;
      profile?: Profile;
      email?: { verificationRequest?: boolean };
      credentials?: Record<string, any>;
    }) {
      const { user, account, profile, email } = params;
      // Handle OAuth sign-in
      if (account && account.provider !== 'credentials') {
        try {
          // Get tenant context from request (could be from subdomain or custom domain)
          const tenantId = await getTenantFromRequest();

          const oauthResult = await OAuthService.handleOAuthSignIn(
            {
              id: account.providerAccountId,
              email: user.email!,
              name: user.name || undefined,
              image: user.image || undefined,
              provider: account.provider,
            },
            {
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: typeof account.refresh_token === 'string' ? account.refresh_token : undefined,
              access_token: typeof account.access_token === 'string' ? account.access_token : undefined,
              expires_at: typeof account.expires_at === 'number' ? account.expires_at : undefined,
              token_type: typeof account.token_type === 'string' ? account.token_type : undefined,
              scope: typeof account.scope === 'string' ? account.scope : undefined,
              id_token: typeof account.id_token === 'string' ? account.id_token : undefined,
              session_state: typeof account.session_state === 'string' ? account.session_state : undefined,
            },
            tenantId
          );

          if (!oauthResult.success) {
            console.error('OAuth sign-in failed:', oauthResult.error);
            return false;
          }

          // Update user object with database user data
          if (oauthResult.user) {
            user.id = oauthResult.user.id;
            user.role = oauthResult.user.role;
            user.tenantId = oauthResult.user.tenantId;
            user.tenant = {
              id: oauthResult.user.tenant.id,
              name: oauthResult.user.tenant.name,
              subdomain: oauthResult.user.tenant.subdomain,
              customDomain: oauthResult.user.tenant.customDomain || undefined,
            };
            user.availableTenants = oauthResult.availableTenants?.map(tenant => ({
              id: tenant.id,
              name: tenant.name,
              subdomain: tenant.subdomain,
              customDomain: tenant.customDomain || undefined,
            }));
            user.requiresPasswordChange = false; // OAuth users don't need password change
          }

          return true;
        } catch (error) {
          console.error('OAuth sign-in error:', error);
          return false;
        }
      }

      // Handle credentials sign-in (existing logic)
      return true;
    },
    async jwt(params: {
      token: JWT;
      user?: User | AdapterUser;
      account?: Account | null | undefined;
      profile?: Profile;
      trigger?: 'signIn' | 'signUp' | 'update';
      isNewUser?: boolean;
      session?: any;
    }) {
      const { token, user, account, trigger } = params;
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenant = user.tenant;
        token.availableTenants = user.availableTenants;
        token.sessionCreated = Date.now();
        token.requiresPasswordChange = user.requiresPasswordChange;
      }

      // Update OAuth account usage
      if (account && account.provider !== 'credentials') {
        await OAuthService.updateOAuthAccountUsage(
          account.provider,
          account.providerAccountId
        );
      }

      // Check for remember me token on session update
      if (trigger === 'update' && !user) {
        // This could be used to validate remember me tokens
        // Implementation depends on how remember me is triggered
      }

      return token;
    },
    async session(params: {
      session: Session;
      token: JWT;
      user?: AdapterUser;
    }) {
      const { session, token } = params;
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.tenant = token.tenant;
        session.user.availableTenants = token.availableTenants;
        session.sessionCreated = token.sessionCreated;
        session.user.requiresPasswordChange = token.requiresPasswordChange;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
