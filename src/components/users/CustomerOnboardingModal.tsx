'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Form } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface Package {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  billingCycle: string
  features: any
  quotas: any
}

interface CustomerOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (customerData: any) => Promise<void>
  availablePackages: Package[]
}

export function CustomerOnboardingModal({
  isOpen,
  onClose,
  onComplete,
  availablePackages
}: CustomerOnboardingModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [customerData, setCustomerData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    companyName: '',
    packageId: '',
    sendWelcomeEmail: true,
    customMessage: ''
  })
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep = (stepNumber: number) => {
    const newErrors: Record<string, string> = {}

    if (stepNumber === 1) {
      if (!customerData.email) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (!customerData.firstName) {
        newErrors.firstName = 'First name is required'
      }

      if (!customerData.lastName) {
        newErrors.lastName = 'Last name is required'
      }
    }

    if (stepNumber === 2) {
      if (!customerData.packageId) {
        newErrors.packageId = 'Please select a package'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 2 && customerData.packageId) {
        const pkg = availablePackages.find(p => p.id === customerData.packageId)
        setSelectedPackage(pkg || null)
      }
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep(step)) return

    setLoading(true)
    try {
      await onComplete(customerData)
      onClose()
      // Reset form
      setStep(1)
      setCustomerData({
        email: '',
        firstName: '',
        lastName: '',
        companyName: '',
        packageId: '',
        sendWelcomeEmail: true,
        customMessage: ''
      })
      setSelectedPackage(null)
    } catch (error) {
      console.error('Customer onboarding failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setCustomerData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const formatPrice = (price: number, currency: string, billingCycle: string) => {
    return `${currency} ${price}/${billingCycle.toLowerCase()}`
  }

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Customer Information</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <Input
            value={customerData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            error={errors.firstName}
            placeholder="John"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <Input
            value={customerData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            error={errors.lastName}
            placeholder="Doe"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address *
        </label>
        <Input
          type="email"
          value={customerData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          error={errors.email}
          placeholder="john@company.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Name (Optional)
        </label>
        <Input
          value={customerData.companyName}
          onChange={(e) => handleInputChange('companyName', e.target.value)}
          placeholder="Acme Corp"
        />
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Select Package</h3>
      
      {errors.packageId && (
        <div className="text-sm text-red-600">{errors.packageId}</div>
      )}

      <div className="grid gap-4">
        {availablePackages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`p-4 cursor-pointer transition-all ${
              customerData.packageId === pkg.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleInputChange('packageId', pkg.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={customerData.packageId === pkg.id}
                    onChange={() => handleInputChange('packageId', pkg.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div>
                    <h4 className="font-medium text-gray-900">{pkg.name}</h4>
                    {pkg.description && (
                      <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {formatPrice(pkg.price, pkg.currency, pkg.billingCycle)}
                </div>
                <Badge color="blue" size="sm">
                  {pkg.billingCycle}
                </Badge>
              </div>
            </div>

            {pkg.features && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(pkg.features).slice(0, 3).map(([key, value]) => (
                    <Badge key={key} color="gray" size="sm">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                  {Object.keys(pkg.features).length > 3 && (
                    <Badge color="gray" size="sm">
                      +{Object.keys(pkg.features).length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {availablePackages.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No packages available. Create a package first to onboard customers.</p>
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Review & Welcome</h3>
      
      {/* Customer Summary */}
      <Card className="p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
        <div className="space-y-1 text-sm">
          <div><span className="font-medium">Name:</span> {customerData.firstName} {customerData.lastName}</div>
          <div><span className="font-medium">Email:</span> {customerData.email}</div>
          {customerData.companyName && (
            <div><span className="font-medium">Company:</span> {customerData.companyName}</div>
          )}
        </div>
      </Card>

      {/* Package Summary */}
      {selectedPackage && (
        <Card className="p-4 bg-blue-50">
          <h4 className="font-medium text-gray-900 mb-2">Selected Package</h4>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Package:</span> {selectedPackage.name}</div>
            <div><span className="font-medium">Price:</span> {formatPrice(selectedPackage.price, selectedPackage.currency, selectedPackage.billingCycle)}</div>
            {selectedPackage.description && (
              <div><span className="font-medium">Description:</span> {selectedPackage.description}</div>
            )}
          </div>
        </Card>
      )}

      {/* Welcome Email Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="sendWelcomeEmail"
            checked={customerData.sendWelcomeEmail}
            onChange={(e) => handleInputChange('sendWelcomeEmail', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="sendWelcomeEmail" className="text-sm font-medium text-gray-700">
            Send welcome email to customer
          </label>
        </div>

        {customerData.sendWelcomeEmail && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Welcome Message (Optional)
            </label>
            <textarea
              value={customerData.customMessage}
              onChange={(e) => handleInputChange('customMessage', e.target.value)}
              placeholder="Add a personal welcome message for your customer..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Onboarding"
      size="lg"
    >
      <div className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {stepNumber}
              </div>
              {stepNumber < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-96">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading || (step === 2 && availablePackages.length === 0)}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                loading={loading}
              >
                Complete Onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}