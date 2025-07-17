'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface MFASetupProps {
  qrCodeUrl: string
  secret: string
  backupCodes: string[]
  onVerify: (token: string) => Promise<boolean>
  onComplete: () => void
  onCancel: () => void
}

export function MFASetup({
  qrCodeUrl,
  secret,
  backupCodes,
  onVerify,
  onComplete,
  onCancel
}: MFASetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup')
  const [token, setToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [backupCodesDownloaded, setBackupCodesDownloaded] = useState(false)
  const [backupCodesCopied, setBackupCodesCopied] = useState(false)

  const handleVerify = async () => {
    if (!token.trim()) {
      setError('Please enter the verification code')
      return
    }

    if (token.length !== 6) {
      setError('Verification code must be 6 digits')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const isValid = await onVerify(token)
      if (isValid) {
        setStep('backup')
      } else {
        setError('Invalid verification code. Please try again.')
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleComplete = () => {
    if (!backupCodesDownloaded && !backupCodesCopied) {
      setError('Please download or copy your backup codes before continuing')
      return
    }
    onComplete()
  }

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
      .then(() => {
        setBackupCodesCopied(true)
        setTimeout(() => setBackupCodesCopied(false), 3000)
      })
      .catch(err => {
        console.error('Failed to copy backup codes:', err)
      })
  }

  const handleDownloadBackupCodes = () => {
    const codesText = `BACKUP CODES FOR YOUR ACCOUNT\n\n${backupCodes.join('\n')}\n\nKeep these codes safe and secure. Each code can only be used once.`
    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mfa-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setBackupCodesDownloaded(true)
  }

  if (step === 'setup') {
    return (
      <Card className="max-w-md mx-auto p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Set Up Two-Factor Authentication</h2>
          <p className="text-gray-600">
            Scan the QR code below with your authenticator app
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center">
            <img 
              src={qrCodeUrl} 
              alt="QR Code for 2FA setup" 
              className="border rounded-lg"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Manual Entry Key:</p>
            <code className="text-sm bg-white p-2 rounded border block break-all">
              {secret}
            </code>
          </div>

          <div className="text-sm text-gray-600">
            <p className="mb-2">Popular authenticator apps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => setStep('verify')}
              className="flex-1"
            >
              Continue
            </Button>
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card className="max-w-md mx-auto p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Verify Setup</h2>
          <p className="text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest"
              maxLength={6}
            />
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleVerify}
              disabled={isVerifying || token.length !== 6}
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setStep('setup')}
              className="flex-1"
            >
              Back
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (step === 'backup') {
    return (
      <Card className="max-w-md mx-auto p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Save Backup Codes</h2>
          <p className="text-gray-600">
            Store these codes safely. You can use them to access your account if you lose your authenticator device.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <code key={index} className="text-sm bg-white p-2 rounded border text-center">
                  {code}
                </code>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleCopyBackupCodes}
              className="flex-1"
            >
              {backupCodesCopied ? 'Copied!' : 'Copy Codes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadBackupCodes}
              className="flex-1"
            >
              Download Codes
            </Button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Save these codes in a secure location. Each code can only be used once.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <Button 
            onClick={handleComplete}
            className="w-full"
          >
            Complete Setup
          </Button>
        </div>
      </Card>
    )
  }

  return null
}