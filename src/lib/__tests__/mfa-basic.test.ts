import { 
  generateEmailOTP, 
  verifyEmailOTP, 
  verifyTOTP 
} from '../mfa'

// Simple tests without complex mocking
describe('MFA Basic Functions', () => {
  describe('Email OTP', () => {
    test('should generate 6-digit email OTP', async () => {
      const code = await generateEmailOTP('test@example.com', 'tenant1')
      expect(code).toMatch(/^\d{6}$/)
      expect(code.length).toBe(6)
    })

    test('should verify valid email OTP', async () => {
      const email = 'test@example.com'
      const tenantId = 'tenant1'
      
      // Generate OTP first
      const code = await generateEmailOTP(email, tenantId)
      
      // Verify the same code immediately
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

    test('should reject non-existent email OTP', async () => {
      const isValid = await verifyEmailOTP('nonexistent@example.com', 'tenant1', '123456')
      expect(isValid).toBe(false)
    })
  })

  describe('TOTP', () => {
    test('should verify TOTP with valid secret and token', () => {
      // Mock the authenticator.verify to return true for testing
      const originalVerify = require('otplib').authenticator.verify
      require('otplib').authenticator.verify = jest.fn(() => true)
      
      const isValid = verifyTOTP('TESTSECRET123456', '123456')
      expect(isValid).toBe(true)
      
      // Restore original function
      require('otplib').authenticator.verify = originalVerify
    })

    test('should handle TOTP verification errors gracefully', () => {
      // Mock the authenticator.verify to throw an error
      const originalVerify = require('otplib').authenticator.verify
      require('otplib').authenticator.verify = jest.fn(() => {
        throw new Error('Test error')
      })
      
      const isValid = verifyTOTP('TESTSECRET123456', '123456')
      expect(isValid).toBe(false)
      
      // Restore original function
      require('otplib').authenticator.verify = originalVerify
    })
  })
})