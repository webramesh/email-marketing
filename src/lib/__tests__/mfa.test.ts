import { 
  generateEmailOTP, 
  verifyEmailOTP, 
  generateTOTPSetup, 
  verifyTOTP, 
  enableMFA, 
  disableMFA, 
  isMFAEnabled, 
  verifyMFAToken 
} from '../mfa'

// Mock Prisma
jest.mock('@/generated/prisma', () => {
  const mockPrismaInstance = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
    __mockPrismaInstance: mockPrismaInstance,
  }
})

// Mock otplib
jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn(() => 'TESTSECRET123456'),
    keyuri: jest.fn(() => 'otpauth://totp/test'),
    verify: jest.fn(() => true),
  },
}))

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,test')),
}))

// Get the mock instance
const { __mockPrismaInstance: mockPrismaInstance } = jest.requireMock('@/generated/prisma')

describe('MFA Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Email OTP', () => {
    test('should generate email OTP', async () => {
      const code = await generateEmailOTP('test@example.com', 'tenant1')
      expect(code).toMatch(/^\d{6}$/)
    })

    test('should verify valid email OTP', async () => {
      const email = 'test@example.com'
      const tenantId = 'tenant1'
      
      // Generate OTP first
      const code = await generateEmailOTP(email, tenantId)
      
      // Verify the same code
      const isValid = await verifyEmailOTP(email, tenantId, code)
      expect(isValid).toBe(true)
    })

    test('should reject invalid email OTP', async () => {
      const email = 'test@example.com'
      const tenantId = 'tenant1'
      
      // Generate OTP but verify with wrong code
      await generateEmailOTP(email, tenantId)
      const isValid = await verifyEmailOTP(email, tenantId, '000000')
      expect(isValid).toBe(false)
    })

    test('should reject expired email OTP', async () => {
      const email = 'test@example.com'
      const tenantId = 'tenant1'
      
      // Generate OTP
      const code = await generateEmailOTP(email, tenantId)
      
      // Mock expired time
      jest.useFakeTimers()
      jest.advanceTimersByTime(11 * 60 * 1000) // 11 minutes
      
      const isValid = await verifyEmailOTP(email, tenantId, code)
      expect(isValid).toBe(false)
      
      jest.useRealTimers()
    })
  })

  describe('TOTP Setup', () => {
    test('should generate TOTP setup data', async () => {
      const setupData = await generateTOTPSetup('user1', 'test@example.com', 'Test Tenant')
      
      expect(setupData).toHaveProperty('secret')
      expect(setupData).toHaveProperty('qrCodeUrl')
      expect(setupData).toHaveProperty('backupCodes')
      expect(setupData.backupCodes).toHaveLength(8)
      expect(setupData.secret).toBe('TESTSECRET123456')
      expect(setupData.qrCodeUrl).toBe('data:image/png;base64,test')
    })

    test('should verify TOTP token', () => {
      const isValid = verifyTOTP('TESTSECRET123456', '123456')
      expect(isValid).toBe(true)
    })
  })

  describe('MFA Management', () => {
    test('should enable MFA successfully', async () => {
      mockPrismaInstance.user.update.mockResolvedValue({} as any)

      const success = await enableMFA('user1', 'tenant1', 'TESTSECRET123456', '123456')
      expect(success).toBe(true)
      // Check that update was called with the right user ID and tenant ID
      expect(mockPrismaInstance.user.update).toHaveBeenCalled()
      const updateCall = mockPrismaInstance.user.update.mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'user1', tenantId: 'tenant1' })
      expect(updateCall.data.mfaEnabled).toBe(true)
      expect(updateCall.data.mfaSecret).toBe('TESTSECRET123456')
    })

    test('should disable MFA successfully', async () => {
      mockPrismaInstance.user.update.mockResolvedValue({} as any)

      const success = await disableMFA('user1', 'tenant1')
      expect(success).toBe(true)
      // Check that update was called with the right user ID and tenant ID
      expect(mockPrismaInstance.user.update).toHaveBeenCalled()
      const updateCall = mockPrismaInstance.user.update.mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'user1', tenantId: 'tenant1' })
      expect(updateCall.data.mfaEnabled).toBe(false)
      expect(updateCall.data.mfaSecret).toBeNull()
    })

    test('should check MFA status', async () => {
      mockPrismaInstance.user.findUnique.mockResolvedValue({ mfaEnabled: true } as any)

      const isEnabled = await isMFAEnabled('user1', 'tenant1')
      expect(isEnabled).toBe(true)
      expect(mockPrismaInstance.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1', tenantId: 'tenant1' },
        select: { mfaEnabled: true }
      })
    })

    test('should verify MFA token with TOTP', async () => {
      mockPrismaInstance.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        mfaEnabled: true,
        mfaSecret: 'TESTSECRET123456'
      } as any)

      const isValid = await verifyMFAToken('user1', 'tenant1', '123456', 'totp')
      expect(isValid).toBe(true)
    })

    test('should verify MFA token with email OTP', async () => {
      mockPrismaInstance.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        mfaEnabled: true,
        mfaSecret: 'TESTSECRET123456'
      } as any)

      // Generate email OTP first
      const code = await generateEmailOTP('test@example.com', 'tenant1')
      
      const isValid = await verifyMFAToken('user1', 'tenant1', code, 'email')
      expect(isValid).toBe(true)
    })
  })
})