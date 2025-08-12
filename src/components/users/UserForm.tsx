'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Form } from '@/components/ui/Form'
import { UserRole } from '@/generated/prisma'
import { useSession } from 'next-auth/react'

interface UserWithDetails {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: UserRole
  isActive: boolean
  deactivationReason?: string
  packagePurchases?: Array<{
    id: string
    package: {
      id: string
      name: string
    }
  }>
}

interface UserFormProps {
  initialData?: Partial<UserWithDetails>
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  availablePackages?: Array<{
    id: string
    name: string
    price: number
    currency: string
  }>
}

export function UserForm({ initialData, onSubmit, onCancel, availablePackages = [] }: UserFormProps) {
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
    email: initialData?.email || '',
    name: initialData?.name || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    password: '',
    role: initialData?.role || UserRole.USER,
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    deactivationReason: initialData?.deactivationReason || '',
    packageId: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentUserRole = session?.user?.role as UserRole

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!initialData && !formData.password) {
      newErrors.password = 'Password is required for new users'
    } else if (!initialData && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.isActive && !formData.deactivationReason) {
      newErrors.deactivationReason = 'Deactivation reason is required when deactivating user'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      const submitData = { ...formData }
      if (initialData && !submitData.password) {
        delete submitData.password // Don't send empty password for updates
      }
      await onSubmit(submitData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const canEditRole = currentUserRole === UserRole.SUPERADMIN || 
    (currentUserRole === UserRole.ADMIN && formData.role !== UserRole.SUPERADMIN)

  const canAssignPackages = currentUserRole === UserRole.ADMIN && availablePackages.length > 0

  return (
    <Form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={errors.email}
            placeholder="user@example.com"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <Input
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="John Doe"
          />
        </div>

        {!initialData && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              placeholder="Enter secure password"
              required
            />
          </div>
        )}
      </div>

      {/* Role and Permissions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Role and Permissions</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value as UserRole)}
            disabled={!canEditRole}
          >
            {currentUserRole === UserRole.SUPERADMIN && (
              <option value={UserRole.SUPERADMIN}>Super Admin</option>
            )}
            <option value={UserRole.ADMIN}>Admin</option>
            <option value={UserRole.USER}>User</option>
            <option value={UserRole.SUPPORT}>Support</option>
          </select>
          {!canEditRole && (
            <p className="text-xs text-gray-500 mt-1">
              You don't have permission to change this user's role
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => handleInputChange('isActive', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
            Active User
          </label>
        </div>

        {!formData.isActive && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deactivation Reason *
            </label>
            <Input
              value={formData.deactivationReason}
              onChange={(e) => handleInputChange('deactivationReason', e.target.value)}
              error={errors.deactivationReason}
              placeholder="Reason for deactivating this user"
              required
            />
          </div>
        )}
      </div>

      {/* Package Assignment (for Admin users) */}
      {canAssignPackages && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Package Assignment</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Package
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.packageId}
              onChange={(e) => handleInputChange('packageId', e.target.value)}
            >
              <option value="">No package assigned</option>
              {availablePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {pkg.currency} {pkg.price}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Assign a package to this customer
            </p>
          </div>

          {initialData?.packagePurchases && initialData.packagePurchases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Packages
              </label>
              <div className="space-y-2">
                {initialData.packagePurchases.map((purchase) => (
                  <div key={purchase.id} className="p-3 bg-gray-50 rounded-md">
                    <span className="font-medium text-sm text-gray-700">
                      {purchase.package.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
        >
          {initialData ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </Form>
  )
}