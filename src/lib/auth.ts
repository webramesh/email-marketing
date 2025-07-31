import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { UserService } from "@/services/user.service"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant ID", type: "text", optional: true }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        const tenantId = credentials.tenantId as string | undefined

        try {
          // Use the new UserService for enhanced authentication
          const authResult = await UserService.validateCredentials(email, password, tenantId)

          if (!authResult.isValid || !authResult.user) {
            console.log("Authentication failed:", authResult.error)
            return null
          }

          const user = authResult.user

          // Update last login timestamp
          await UserService.updateLastLogin(user.id)

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
              customDomain: user.tenant.customDomain
            },
            availableTenants: authResult.availableTenants
          }
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: any }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenant = user.tenant
        token.availableTenants = user.availableTenants
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.tenant = token.tenant as any
        session.user.availableTenants = token.availableTenants as any
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)