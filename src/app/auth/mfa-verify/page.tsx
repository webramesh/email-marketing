'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MFAVerification } from '@/components/auth/MFAVerification'
import { useSession } from 'next-auth/react'

// Main page component that wraps the content with Suspense
export default function MFAVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <MFAVerifyContent />
    </Suspense>
  )
}

// This component uses hooks that require Suspense
function MFAVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  
  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      return
    }
    
    // If authenticated, check if MFA is required
    if (status === 'authenticated') {
      setIsLoading(false)
    }
  }, [status, router, callbackUrl])
  
  const handleVerify = async (token: string, type: 'totp' | 'email' | 'backup') => {
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          type
        })
      })
      
      if (response.ok) {
        // Redirect to the callback URL after successful verification
        router.push(callbackUrl)
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
  
  const handleCancel = () => {
    // Redirect to dashboard or home page
    router.push('/dashboard')
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <MFAVerification
        email={session?.user?.email || ''}
        onVerify={handleVerify}
        onSendEmailOTP={handleSendEmailOTP}
        onCancel={handleCancel}
      />
    </div>
  )
}