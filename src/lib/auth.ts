import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { UserService } from '@/services/user.service';
import { validateRememberToken } from './session-management';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';

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
    async jwt({ token, user, trigger }: { token: JWT; user: any; trigger?: string }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenant = user.tenant;
        token.availableTenants = user.availableTenants;
        token.sessionCreated = Date.now();
        token.requiresPasswordChange = user.requiresPasswordChange;
      }

      // Check for remember me token on session update
      if (trigger === 'update' && !user) {
        // This could be used to validate remember me tokens
        // Implementation depends on how remember me is triggered
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
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
