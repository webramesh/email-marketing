'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface MFAVerificationProps {
  email: string
  onVerify: (token: string, type: 'totp' | 'email' | 'backup') => Promise<boolean>
  onSendEmailOTP?: () => Promise<boolean>
  onCancel: () => void
}

export function MFAVerification({
  email,
  onVerify,
  onSendEmailOTP,
  onCancel
}: MFAVerificationProps) {
  const [method, setMethod] = useState<'totp' | 'email' | 'backup'>('totp')
  const [token, setToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSendingOTP, setIsSendingOTP] = useState(false)
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const handleVerify = async () => {
    if (!token.trim()) {
      setError('Please enter the verification code')
      return
    }

    // Validate token format based on method
    if (method === 'totp' && token.length !== 6) {
      setError('Authenticator code must be 6 digits')
      return
    }
    
    if (method === 'email' && token.length !== 6) {
      setError('Email code must be 6 digits')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const isValid = await onVerify(token, method)
      if (!isValid) {
        setError('Invalid verification code. Please try again.')
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSendEmailOTP = async () => {
    if (!onSendEmailOTP) return

    setIsSendingOTP(true)
    setError('')

    try {
      const success = await onSendEmailOTP()
      if (success) {
        setOtpSent(true)
        setMethod('email')
      } else {
        setError('Failed to send email OTP. Please try again.')
      }
    } catch (err) {
      setError('Failed to send email OTP. Please try again.')
    } finally {
      setIsSendingOTP(false)
    }
  }

  const handleMethodChange = (newMethod: 'totp' | 'email' | 'backup') => {
    setMethod(newMethod)
    setToken('')
    setError('')
    
    // Reset OTP sent state when switching away from email
    if (newMethod !== 'email') {
      setOtpSent(false)
    }
  }

  const getInputPlaceholder = () => {
    switch (method) {
      case 'totp':
        return '000000'
      case 'email':
        return '000000'
      case 'backup':
        return 'XXXXXXXX'
      default:
        return ''
    }
  }

  const getInputMaxLength = () => {
    return method === 'backup' ? 8 : 6
  }

  const formatInput = (value: string) => {
    if (method === 'backup') {
      return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    } else {
      return value.replace(/\D/g, '').slice(0, 6)
    }
  }

  const isVerifyDisabled = () => {
    if (isVerifying) return true
    if (method === 'email' && !otpSent) return true
    if (method === 'totp' && token.length !== 6) return true
    if (method === 'email' && token.length !== 6) return true
    if (method === 'backup' && token.length !== 8) return true
    return false
  }

  return (
    <Card className="max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Two-Factor Authentication</h2>
        <p className="text-gray-600">
          Please verify your identity to continue
        </p>
      </div>

      <div className="space-y-4">
        {/* Method Selection */}
        <div className="flex flex-wrap rounded-lg border p-1">
          <button
            type="button"
            onClick={() => handleMethodChange('totp')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              method === 'totp'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Authenticator
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange('email')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              method === 'email'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Email Code
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange('backup')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              method === 'backup'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Backup Code
          </button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600">
          {method === 'totp' ? (
            <p>Enter the 6-digit code from your authenticator app</p>
          ) : method === 'email' ? (
            <p>
              {otpSent 
                ? `We've sent a verification code to ${email}`
                : 'Click below to receive a verification code via email'
              }
            </p>
          ) : (
            <p>Enter one of your 8-character backup codes</p>
          )}
        </div>

        {/* Email OTP Send Button */}
        {method === 'email' && !otpSent && onSendEmailOTP && (
          <Button
            onClick={handleSendEmailOTP}
            disabled={isSendingOTP}
            variant="outline"
            className="w-full"
          >
            {isSendingOTP ? 'Sending...' : 'Send Email Code'}
          </Button>
        )}

        {/* Token Input */}
        {(method === 'totp' || method === 'backup' || otpSent) && (
          <div>
            <Input
              type="text"
              placeholder={getInputPlaceholder()}
              value={token}
              onChange={(e) => setToken(formatInput(e.target.value))}
              className="text-center text-2xl tracking-widest"
              maxLength={getInputMaxLength()}
            />
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleVerify}
            disabled={isVerifyDisabled()}
            className="flex-1"
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>

        {/* Resend Email OTP */}
        {method === 'email' && otpSent && onSendEmailOTP && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleSendEmailOTP}
              disabled={isSendingOTP}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isSendingOTP ? 'Sending...' : "Didn't receive the code? Send again"}
            </button>
          </div>
        )}
        
        {/* Lost Access Help */}
        {method !== 'backup' && (
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => handleMethodChange('backup')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Lost access to your authenticator app or email?
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}