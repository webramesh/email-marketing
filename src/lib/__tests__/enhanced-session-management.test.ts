import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  generateSessionToken,
  generateRememberToken,
  hashRememberToken,
  parseDeviceInfo,
  getClientIP,
  analyzeSessionSecurity,
  createUserSession,
  validateSession,
  invalidateSession,
  validateRememberToken
} from '../session-management'

// Mock NextRequest
const mockNextRequest = (url: string, options: any = {}) => {
  const headers = new Map(Object.entries(options.headers || {}))
  return {
    url,
    nextUrl: { pathname: new URL(url).pathname },
    headers: {
      get: (key: string) => headers.get(key) || null,
      has: (key: string) => headers.has(key),
      entries: () => headers.entries(),
      keys: () => headers.keys(),
      values: () => headers.values()
    },
    cookies: {
      get: (key: string) => ({ value: undefined }),
      has: (key: string) => false
    },
    ip: options.ip || '127.0.0.1'
  }
}

// Mock Prisma
jest.mock('@/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    sessionActivity: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    rememberToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    securityEvent: {
      create: jest.fn()
    }
  }))
}))

// Mock UA Parser
jest.mock('ua-parser-js', () => ({
  UAParser: jest.fn().mockImplementation(() => ({
    getResult: () => ({
      device: { type: 'desktop' },
      browser: { name: 'Chrome', version: '91.0' },
      os: { name: 'Windows', version: '10' }
    })
  }))
}))

describe('Enhanced Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Token Generation', () => {
    it('should generate unique session tokens', () => {
      const token1 = generateSessionToken()
      const token2 = generateSessionToken()
      
      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
      expect(token1).toHaveLength(64) // 32 bytes * 2 (hex)
    })

    it('should generate unique remember tokens', () => {
      const token1 = generateRememberToken()
      const token2 = generateRememberToken()
      
      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
      expect(token1).toHaveLength(96) // 48 bytes * 2 (hex)
    })

    it('should hash remember tokens consistently', () => {
      const token = 'test-token'
      const hash1 = hashRememberToken(token)
      const hash2 = hashRememberToken(token)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex
    })
  })

  describe('Device Information Parsing', () => {
    it('should parse device info from user agent', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      
      const deviceInfo = parseDeviceInfo(userAgent)
      
      expect(deviceInfo).toEqual({
        deviceType: 'desktop',
        browser: 'Chrome',
        browserVersion: '91.0',
        os: 'Windows',
        osVersion: '10',
        userAgent
      })
    })
  })

  describe('IP Address Extraction', () => {
    it('should extract IP from CloudFlare header', () => {
      const request = mockNextRequest('http://localhost', {
        headers: {
          'cf-connecting-ip': '192.168.1.1',
          'x-forwarded-for': '10.0.0.1',
          'x-real-ip': '172.16.0.1'
        }
      }) as any

      const ip = getClientIP(request)
      expect(ip).toBe('192.168.1.1')
    })

    it('should extract IP from x-real-ip header', () => {
      const request = mockNextRequest('http://localhost', {
        headers: {
          'x-real-ip': '172.16.0.1',
          'x-forwarded-for': '10.0.0.1'
        }
      }) as any

      const ip = getClientIP(request)
      expect(ip).toBe('172.16.0.1')
    })

    it('should extract IP from x-forwarded-for header', () => {
      const request = mockNextRequest('http://localhost', {
        headers: {
          'x-forwarded-for': '10.0.0.1, 192.168.1.1'
        }
      }) as any

      const ip = getClientIP(request)
      expect(ip).toBe('10.0.0.1')
    })

    it('should fallback to default IP', () => {
      const request = mockNextRequest('http://localhost') as any

      const ip = getClientIP(request)
      expect(ip).toBe('127.0.0.1')
    })
  })

  describe('Security Analysis', () => {
    it('should calculate risk score based on failed attempts', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      mockPrisma.sessionActivity.count.mockResolvedValueOnce(3) // Recent failures
      mockPrisma.userSession.findMany.mockResolvedValueOnce([]) // No recent sessions
      mockPrisma.userSession.count.mockResolvedValueOnce(2) // Active sessions
      mockPrisma.user.findUnique.mockResolvedValueOnce({ maxConcurrentSessions: 5 })
      mockPrisma.sessionActivity.count
        .mockResolvedValueOnce(0) // Suspicious activities
        .mockResolvedValueOnce(0) // Recent IPs

      const analysis = await analyzeSessionSecurity('user1', '192.168.1.1', 'test-agent')

      expect(analysis.riskScore).toBeGreaterThan(0)
      expect(analysis.isBlocked).toBe(false)
      expect(analysis.factors).toContain('Multiple failed login attempts')
    })

    it('should block user after max failed attempts', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      mockPrisma.sessionActivity.count.mockResolvedValueOnce(5) // Max failures reached

      const analysis = await analyzeSessionSecurity('user1', '192.168.1.1', 'test-agent')

      expect(analysis.isBlocked).toBe(true)
      expect(analysis.blockReason).toBe('Too many failed login attempts')
    })
  })

  describe('Session Creation', () => {
    it('should create session with proper device info', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      // Mock security analysis (low risk)
      mockPrisma.sessionActivity.count.mockResolvedValue(0)
      mockPrisma.userSession.findMany.mockResolvedValue([])
      mockPrisma.userSession.count.mockResolvedValue(1)
      mockPrisma.user.findUnique.mockResolvedValue({
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        rememberMeEnabled: true
      })

      // Mock session creation
      mockPrisma.userSession.create.mockResolvedValue({
        id: 'session1',
        sessionToken: 'token123',
        userId: 'user1'
      })
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.sessionActivity.create.mockResolvedValue({})

      const request = mockNextRequest('http://localhost', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }) as any

      const result = await createUserSession('user1', request, false)

      expect(result.sessionToken).toBeDefined()
      expect(mockPrisma.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            deviceType: 'desktop',
            browser: 'Chrome',
            os: 'Windows'
          })
        })
      )
    })

    it('should create remember token when requested', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      // Mock all required calls
      mockPrisma.sessionActivity.count.mockResolvedValue(0)
      mockPrisma.userSession.findMany.mockResolvedValue([])
      mockPrisma.userSession.count.mockResolvedValue(1)
      mockPrisma.user.findUnique.mockResolvedValue({
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        rememberMeEnabled: true
      })
      mockPrisma.userSession.create.mockResolvedValue({
        id: 'session1',
        sessionToken: 'token123'
      })
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.sessionActivity.create.mockResolvedValue({})
      mockPrisma.rememberToken.create.mockResolvedValue({})

      const request = mockNextRequest('http://localhost') as any
      const result = await createUserSession('user1', request, true)

      expect(result.rememberToken).toBeDefined()
      expect(mockPrisma.rememberToken.create).toHaveBeenCalled()
    })
  })

  describe('Session Validation', () => {
    it('should validate active session', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      const mockSession = {
        id: 'session1',
        sessionToken: 'token123',
        userId: 'user1',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        lastActivityAt: new Date(),
        createdAt: new Date(),
        user: {
          id: 'user1',
          sessionTimeout: 3600
        }
      }

      mockPrisma.userSession.findUnique.mockResolvedValue(mockSession)
      mockPrisma.userSession.update.mockResolvedValue(mockSession)
      mockPrisma.user.update.mockResolvedValue({})

      const request = mockNextRequest('http://localhost', {
        headers: {
          'user-agent': 'test-agent'
        }
      }) as any

      const result = await validateSession('token123', request)

      expect(result).toBeDefined()
      expect(result?.sessionToken).toBe('token123')
      expect(mockPrisma.userSession.update).toHaveBeenCalled()
    })

    it('should reject expired session', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      const mockSession = {
        id: 'session1',
        sessionToken: 'token123',
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        user: { sessionTimeout: 3600 }
      }

      mockPrisma.userSession.findUnique.mockResolvedValue(mockSession)
      mockPrisma.userSession.update.mockResolvedValue({})

      const request = mockNextRequest('http://localhost') as any
      const result = await validateSession('token123', request)

      expect(result).toBeNull()
      expect(mockPrisma.userSession.update).toHaveBeenCalledWith({
        where: { id: 'session1' },
        data: { isActive: false }
      })
    })
  })

  describe('Remember Token Validation', () => {
    it('should validate active remember token', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      const token = 'remember-token'
      const tokenHash = hashRememberToken(token)

      mockPrisma.rememberToken.findUnique.mockResolvedValue({
        id: 'token1',
        userId: 'user1',
        tokenHash,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        user: {
          id: 'user1',
          rememberMeEnabled: true
        }
      })
      mockPrisma.rememberToken.update.mockResolvedValue({})

      const result = await validateRememberToken(token)

      expect(result).toBe('user1')
      expect(mockPrisma.rememberToken.update).toHaveBeenCalled()
    })

    it('should reject expired remember token', async () => {
      const { PrismaClient } = await import('@/generated/prisma')
      const mockPrisma = new PrismaClient() as any

      const token = 'remember-token'
      const tokenHash = hashRememberToken(token)

      mockPrisma.rememberToken.findUnique.mockResolvedValue({
        id: 'token1',
        userId: 'user1',
        tokenHash,
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        user: {
          id: 'user1',
          rememberMeEnabled: true
        }
      })
      mockPrisma.rememberToken.update.mockResolvedValue({})

      const result = await validateRememberToken(token)

      expect(result).toBeNull()
      expect(mockPrisma.rememberToken.update).toHaveBeenCalledWith({
        where: { id: 'token1' },
        data: { isActive: false }
      })
    })
  })
})