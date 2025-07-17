import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"

export async function getSession() {
  return await auth()
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    redirect("/auth/signin")
  }
  return session
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth()
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized")
  }
  return session
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function isAdmin(user: any): boolean {
  return user?.role === "ADMIN"
}

export function isSupport(user: any): boolean {
  return user?.role === "SUPPORT"
}

export function hasRole(user: any, role: string): boolean {
  return user?.role === role
}