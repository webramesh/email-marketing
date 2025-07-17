'use client'

import { useState } from 'react'
import { MFASetup } from '@/components/auth/MFASetup'
import { MFAVerification } from '@/components/auth/MFAVerification'
import { Button } from '@/components/ui/Button'

export default function MFADemoPage() {
  const [currentView, setCurrentView] = useState<'menu' | 'setup' | 'verify'>('menu')
  const [setupData, setSetupData] = useState<any>(null)

  const handleSetupMFA = async () => {
    try {
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        setSetupData(data.data)
        setCurrentView('setup')
      } else {
        alert('Failed to setup MFA. Please ensure you are logged in.')
      }
    } catch (error) {
      console.error('Setup error:', error)
      alert('Failed to setup MFA')
    }
  }

  const handleVerifySetup = async (token: string) => {
    try {
      const response = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: setupData.secret,
          token: token
        })
      })
      
      return response.ok
    } catch (error) {
      console.error('Verification error:', error)
      return false
    }
  }

  const handleVerifyMFA = async (token: string, type: 'totp' | 'email' | 'backup') => {
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          type: type
        })
      })
      
      if (response.ok) {
        alert('MFA verification successful!')
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error('Verification error:', error)
      return false
    }
  }

  const handleSendEmailOTP = async () => {
    try {
      const response = await fetch('/api/auth/mfa/send-otp', {
        method: 'POST',
      })
      
      return response.ok
    } catch (error) {
      console.error('Send OTP error:', error)
      return false
    }
  }

  const handleSetupComplete = () => {
    alert('MFA setup completed successfully!')
    setCurrentView('menu')
    setSetupData(null)
  }

  const handleCancel = () => {
    setCurrentView('menu')
    setSetupData(null)
  }

  if (currentView === 'setup' && setupData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <MFASetup
          qrCodeUrl={setupData.qrCodeUrl}
          secret={setupData.secret}
          backupCodes={setupData.backupCodes}
          onVerify={handleVerifySetup}
          onComplete={handleSetupComplete}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  if (currentView === 'verify') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <MFAVerification
          email="demo@example.com"
          onVerify={handleVerifyMFA}
          onSendEmailOTP={handleSendEmailOTP}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">MFA Demo</h1>
        
        <div className="space-y-4">
          <Button 
            onClick={handleSetupMFA}
            className="w-full"
          >
            Setup MFA
          </Button>
          
          <Button 
            onClick={() => setCurrentView('verify')}
            variant="outline"
            className="w-full"
          >
            Test MFA Verification
          </Button>
          
          <div className="text-sm text-gray-600 text-center">
            <p>This demo page allows you to test the MFA setup and verification flows.</p>
            <p className="mt-2">Note: You need to be logged in to use the setup functionality.</p>
          </div>
        </div>
      </div>
    </div>
  )
}