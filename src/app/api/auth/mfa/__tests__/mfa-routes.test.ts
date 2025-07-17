import { NextRequest } from 'next/server'
import { POST as setupPOST } from '../setup/route'
import { POST as enablePOST } from '../enable/route'
import { POST as sendOtpPOST } from '../send-otp/route'
import { POST as verifyPOST } from '../verify/route'
import { auth } from '@/lib/auth'
import { generateTOTPSetup, enableMFA, disableMFA, verifyMFAToken, generateEmailOTP, sendEmailOTP } from '@/lib/mfa'
import { createMFASession } from '@/lib/mfa-middleware'
import type { Session } from 'next-auth'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/lib/mfa')
jest.mock('@/lib/mfa-middleware')

const mockAuth = jest.mocked(auth)
const mockGenerateTOTPSetup = jest.mocked(generateTOTPSetup)
const mockEnableMFA = jest.mocked(enableMFA)
const mockDisableMFA = jest.mocked(disableMFA)
const mockVerifyMFAToken = jest.mocked(verifyMFAToken)
const mockGenerateEmailOTP = jest.mocked(generateEmailOTP)
const mockSendEmailOTP = jest.mocked(sendEmailOTP)
const mockCreateMFASession = jest.mocked(createMFASession)

const createMockRequest = (body?: any) => {
  return {
    json: jest.fn().mockResolvedValue(body || {})
  } as unknown as NextRequest
}

const createMockSession = (): Session => ({
  user: {
    id: 'user1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    tenantId: 'tenant1',
    tenant: {
      id: 'tenant1',
      name: 'Test Tenant',
      subdomain: 'test'
    }
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
})

describe('MFA API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/mfa/setup', () => {
    test('should generate TOTP setup data', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGenerateTOTPSetup.mockResolvedValue({
        secret: 'TESTSECRET123456',
        qrCodeUrl: 'data:image/png;base64,test',
        backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8']
      })

      const request = createMockRequest()
      const response = await setupPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('secret')
      expect(data.data).toHaveProperty('qrCodeUrl')
      expect(data.data).toHaveProperty('backupCodes')
    })

    test('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null)

      const request = createMockRequest()
      const response = await setupPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/auth/mfa/enable', () => {
    test('should enable MFA successfully', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockEnableMFA.mockResolvedValue(true)

      const request = createMockRequest({
        secret: 'TESTSECRET123456',
        token: '123456'
      })
      const response = await enablePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('MFA enabled successfully')
    })

    test('should return 400 for invalid token', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockEnableMFA.mockResolvedValue(false)

      const request = createMockRequest({
        secret: 'TESTSECRET123456',
        token: '000000'
      })
      const response = await enablePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid verification token')
    })

    test('should return 400 for invalid request data', async () => {
      mockAuth.mockResolvedValue(createMockSession())

      const request = createMockRequest({
        secret: '',
        token: '12345' // Too short
      })
      const response = await enablePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })
  })



  describe('POST /api/auth/mfa/send-otp', () => {
    test('should send email OTP successfully', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGenerateEmailOTP.mockResolvedValue('123456')
      mockSendEmailOTP.mockResolvedValue(true)

      const request = createMockRequest()
      const response = await sendOtpPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Email OTP sent successfully')
    })

    test('should return 500 if email sending fails', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGenerateEmailOTP.mockResolvedValue('123456')
      mockSendEmailOTP.mockResolvedValue(false)

      const request = createMockRequest()
      const response = await sendOtpPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to send email OTP')
    })
  })

  describe('POST /api/auth/mfa/verify', () => {
    test('should verify MFA token successfully', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockVerifyMFAToken.mockResolvedValue(true)

      const request = createMockRequest({
        token: '123456',
        type: 'totp'
      })
      const response = await verifyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('MFA verification successful')
      expect(mockCreateMFASession).toHaveBeenCalledWith('user1', 'tenant1')
    })

    test('should return 400 for invalid token', async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockVerifyMFAToken.mockResolvedValue(false)

      const request = createMockRequest({
        token: '000000',
        type: 'totp'
      })
      const response = await verifyPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid verification token')
    })
  })
})