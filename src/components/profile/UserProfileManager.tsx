'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { OAuthAccountManager } from '@/components/auth/OAuthAccountManager'

interface UserProfile {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  profilePicture?: string
  bio?: string
  phoneNumber?: string
  timezone?: string
  language?: string
  dateFormat?: string
  timeFormat?: string
  emailNotifications?: {
    campaigns: boolean
    system: boolean
    security: boolean
  }
  pushNotifications?: boolean
  smsNotifications?: boolean
  isActive: boolean
  deactivatedAt?: string
  deactivationReason?: string
  reactivatedAt?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  tenant: {
    id: string
    name: string
    subdomain: string
    customDomain?: string
  }
}

interface ActivityItem {
  id: string
  type: 'profile_change' | 'login_activity'
  action: string
  description: string
  ipAddress?: string
  location?: any
  metadata?: any
  createdAt: string
}

export function UserProfileManager() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'activity' | 'preferences'>('profile')
  
  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showPictureModal, setShowPictureModal] = useState(false)
  
  // Form states
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    name: '',
    bio: '',
    phoneNumber: '',
    timezone: 'UTC',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
  })
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  
  const [preferencesForm, setPreferencesForm] = useState({
    emailNotifications: {
      campaigns: true,
      system: true,
      security: true,
    },
    pushNotifications: true,
    smsNotifications: false,
  })
  
  const [deactivationReason, setDeactivationReason] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    loadProfile()
    loadActivities()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        
        // Initialize form data
        setProfileForm({
          firstName: data.profile.firstName || '',
          lastName: data.profile.lastName || '',
          name: data.profile.name || '',
          bio: data.profile.bio || '',
          phoneNumber: data.profile.phoneNumber || '',
          timezone: data.profile.timezone || 'UTC',
          language: data.profile.language || 'en',
          dateFormat: data.profile.dateFormat || 'MM/dd/yyyy',
          timeFormat: data.profile.timeFormat || '12h',
        })
        
        setPreferencesForm({
          emailNotifications: data.profile.emailNotifications || {
            campaigns: true,
            system: true,
            security: true,
          },
          pushNotifications: data.profile.pushNotifications ?? true,
          smsNotifications: data.profile.smsNotifications ?? false,
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadActivities = async () => {
    try {
      const response = await fetch('/api/profile/activity?type=timeline&limit=20')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.data || [])
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    }
  }

  const updateProfile = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileForm),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        alert('Profile updated successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const updatePreferences = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencesForm),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        alert('Preferences updated successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      alert('Failed to update preferences')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      if (response.ok) {
        alert('Password changed successfully!')
        setShowPasswordModal(false)
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const uploadProfilePicture = async () => {
    if (!selectedFile) return

    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('picture', selectedFile)

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(prev => prev ? { ...prev, profilePicture: data.pictureUrl } : null)
        setShowPictureModal(false)
        setSelectedFile(null)
        alert('Profile picture updated successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading picture:', error)
      alert('Failed to upload picture')
    } finally {
      setSaving(false)
    }
  }

  const removeProfilePicture = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/profile/picture', {
        method: 'DELETE',
      })

      if (response.ok) {
        setProfile(prev => prev ? { ...prev, profilePicture: undefined } : null)
        alert('Profile picture removed successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing picture:', error)
      alert('Failed to remove picture')
    } finally {
      setSaving(false)
    }
  }

  const deactivateAccount = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deactivate',
          reason: deactivationReason,
        }),
      })

      if (response.ok) {
        alert('Account deactivated successfully!')
        setShowDeactivateModal(false)
        setDeactivationReason('')
        // Redirect to login
        window.location.href = '/auth/signin'
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deactivating account:', error)
      alert('Failed to deactivate account')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getActivityIcon = (type: string, action: string) => {
    if (type === 'login_activity') {
      switch (action) {
        case 'login': return '🔓'
        case 'logout': return '🔒'
        case 'failed_login': return '❌'
        default: return '🔐'
      }
    } else {
      switch (action) {
        case 'PROFILE_UPDATE': return '✏️'
        case 'PASSWORD_CHANGE': return '🔑'
        case 'PROFILE_PICTURE_UPLOAD': return '📷'
        case 'ACCOUNT_DEACTIVATION': return '🚫'
        case 'ACCOUNT_REACTIVATION': return '✅'
        default: return '📝'
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        {!profile.isActive && (
          <Badge className="bg-red-100 text-red-800">
            Account Deactivated
          </Badge>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'profile', label: 'Profile' },
            { key: 'security', label: 'Security' },
            { key: 'preferences', label: 'Preferences' },
            { key: 'activity', label: 'Activity' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Picture */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Picture</h3>
            <div className="flex flex-col items-center space-y-4">
              <Avatar
                src={profile.profilePicture}
                alt={profile.name || profile.email}
                size="xl"
                fallback={profile.name?.[0] || profile.email[0]}
              />
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowPictureModal(true)}
                  variant="outline"
                  size="sm"
                >
                  Upload
                </Button>
                {profile.profilePicture && (
                  <Button
                    onClick={removeProfilePicture}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={saving}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Profile Information */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <Input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <Input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Enter last name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <Input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter display name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <Input
                  value={profileForm.phoneNumber}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={profileForm.timezone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={updateProfile}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Change your password to keep your account secure.
            </p>
            <Button
              onClick={() => setShowPasswordModal(true)}
              variant="outline"
            >
              Change Password
            </Button>
          </Card>

          {/* OAuth Account Management */}
          <OAuthAccountManager />

          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Account Status</p>
                  <p className="text-sm text-gray-600">
                    {profile.isActive ? 'Active' : 'Deactivated'}
                  </p>
                </div>
                <Badge className={profile.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {profile.isActive ? 'Active' : 'Deactivated'}
                </Badge>
              </div>
              
              {profile.isActive ? (
                <Button
                  onClick={() => setShowDeactivateModal(true)}
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  Deactivate Account
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Deactivated on: {profile.deactivatedAt ? formatDate(profile.deactivatedAt) : 'Unknown'}
                  </p>
                  {profile.deactivationReason && (
                    <p className="text-sm text-gray-600">
                      Reason: {profile.deactivationReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Email Notifications</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesForm.emailNotifications.campaigns}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      emailNotifications: {
                        ...prev.emailNotifications,
                        campaigns: e.target.checked,
                      },
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">Campaign updates</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesForm.emailNotifications.system}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      emailNotifications: {
                        ...prev.emailNotifications,
                        system: e.target.checked,
                      },
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">System notifications</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesForm.emailNotifications.security}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      emailNotifications: {
                        ...prev.emailNotifications,
                        security: e.target.checked,
                      },
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">Security alerts</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Other Notifications</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesForm.pushNotifications}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      pushNotifications: e.target.checked,
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">Push notifications</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesForm.smsNotifications}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      smsNotifications: e.target.checked,
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900">SMS notifications</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={updatePreferences}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </Card>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg">{getActivityIcon(activity.type, activity.action)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.description}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                    <span>{formatDate(activity.createdAt)}</span>
                    {activity.ipAddress && (
                      <>
                        <span>•</span>
                        <span>{activity.ipAddress}</span>
                      </>
                    )}
                    {activity.location?.city && (
                      <>
                        <span>•</span>
                        <span>{activity.location.city}, {activity.location.country}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-center text-gray-500 py-8">No recent activity</p>
            )}
          </div>
        </Card>
      )}

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowPasswordModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={changePassword}
              disabled={saving}
            >
              {saving ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Profile Picture Upload Modal */}
      <Modal
        isOpen={showPictureModal}
        onClose={() => setShowPictureModal(false)}
        title="Upload Profile Picture"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: JPEG, PNG, WebP. Maximum size: 5MB.
            </p>
          </div>
          {selectedFile && (
            <div className="text-sm text-gray-600">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowPictureModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={uploadProfilePicture}
              disabled={!selectedFile || saving}
            >
              {saving ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Account Deactivation Modal */}
      <Modal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        title="Deactivate Account"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Warning: This action cannot be undone
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Deactivating your account will:
                  </p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Log you out of all sessions</li>
                    <li>Prevent you from accessing your account</li>
                    <li>Require administrator assistance to reactivate</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deactivation (optional)
            </label>
            <textarea
              value={deactivationReason}
              onChange={(e) => setDeactivationReason(e.target.value)}
              placeholder="Please tell us why you're deactivating your account..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowDeactivateModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={deactivateAccount}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? 'Deactivating...' : 'Deactivate Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}