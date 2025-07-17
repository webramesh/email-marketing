import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@/generated/prisma"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"

const prisma = new PrismaClient()

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant ID", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        const tenantId = (credentials.tenantId as string) || ""

        try {
          // Find user by email and tenantId
          const user = await prisma.user.findUnique({
            where: {
              email_tenantId: {
                email: email,
                tenantId: tenantId
              }
            },
            include: {
              tenant: true
            }
          })

          if (!user) {
            return null
          }

          // Verify password
          const isPasswordValid = bcrypt.compareSync(password, user.password)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            tenant: {
              id: user.tenant.id,
              name: user.tenant.name,
              subdomain: user.tenant.subdomain
            }
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
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.tenant = token.tenant as any
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)