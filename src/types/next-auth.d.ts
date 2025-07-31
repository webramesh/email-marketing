import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      tenantId: string
      tenant: {
        id: string
        name: string
        subdomain: string
        customDomain?: string
      }
      availableTenants?: Array<{
        id: string
        name: string
        subdomain: string
        customDomain?: string
      }>
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: string
    tenantId: string
    tenant: {
      id: string
      name: string
      subdomain: string
      customDomain?: string
    }
    availableTenants?: Array<{
      id: string
      name: string
      subdomain: string
      customDomain?: string
    }>
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string
    tenantId: string
    tenant: {
      id: string
      name: string
      subdomain: string
      customDomain?: string
    }
    availableTenants?: Array<{
      id: string
      name: string
      subdomain: string
      customDomain?: string
    }>
  }
}