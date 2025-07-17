import type { Session } from 'next-auth'

// Mock NextAuth for testing
const mockAuth = jest.fn<Promise<Session | null>, []>()

const mockSignIn = jest.fn()
const mockSignOut = jest.fn()

const mockHandlers = {
  GET: jest.fn(),
  POST: jest.fn()
}

const mockAuthOptions = {
  providers: [],
  session: { strategy: 'jwt' as const },
  callbacks: {},
  pages: { signIn: '/auth/signin' }
}

export default function NextAuth() {
  return {
    handlers: mockHandlers,
    auth: mockAuth,
    signIn: mockSignIn,
    signOut: mockSignOut
  }
}

export const auth = mockAuth
export const signIn = mockSignIn
export const signOut = mockSignOut
export const handlers = mockHandlers
export const authOptions = mockAuthOptions