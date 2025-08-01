'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface SessionInfo {
  id: string
  deviceName?: string
  deviceType?: string
  browser?: string
  os?: string
  ipAddress: string
  location?: {
    country?: string
    city?: string
  }
  lastActivityAt: string
  createdAt: string
  isCurrent: boolean
}

interface SessionActivity {
  id: string
  action: string
  resource?: string
  ipAddress: string
  location?: any
  riskScore?: number
  isBlocked: boolean
  blockReason?: string
  createdAt: string
  session?: {
    deviceName?: string
    deviceType?: string
    browser?: string
  }
}

interface SecurityEvent {
  id: string
  eventType: string
  severity: string
  description: string
  ipAddress?: string
  location?: any
  isResolved: boolean
  createdAt: string
}

interface SessionPreferences {
  sessionTimeout: number
  maxConcurrentSessions: number
  rememberMeEnabled: boolean
}

export function SessionManager() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activities, setActivities] = useState<SessionActivity[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [preferences, setPreferences] = useState<SessionPreferences>({
    sessionTimeout: 86400,
    maxConcurrentSessions: 5,
    rememberMeEnabled: false
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sessions' | 'activities' | 'security' | 'preferences'>('sessions')
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)

  useEffect(() => {
    loadSessionData()
  }, [])

  const loadSessionData = async () => {
    try {
      setLoading(true)
      
      // Load sessions
      const sessionsResponse = await fetch('/api/auth/session')
      if (sessionsResponse.ok) {
        const data = await sessionsResponse.json()
        setSessions(data.activeSessions || [])
      }

      // Load activities
      const activitiesResponse = await fetch('/api/auth/session/activities?type=activities&limit=20')
      if (activitiesResponse.ok) {
        const data = await activitiesResponse.json()
        setActivities(data.activities || [])
      }

      // Load security events
      const securityResponse = await fetch('/api/auth/session/activities?type=security&limit=20')
      if (securityResponse.ok) {
        const data = await securityResponse.json()
        setSecurityEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const terminateSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/session?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId))
      }
    } catch (error) {
      console.error('Error terminating session:', error)
    }
  }

  const terminateAllSessions = async () => {
    try {
      const response = await fetch('/api/auth/session?all=true', {
        method: 'DELETE'
      })

      if (response.ok) {
        setSessions([])
        // Redirect to login since all sessions are terminated
        window.location.href = '/auth/signin'
      }
    } catch (error) {
      console.error('Error terminating all sessions:', error)
    }
  }

  const resolveSecurityEvent = async (eventId: string) => {
    try {
      const response = await fetch('/api/auth/session/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId,
          action: 'resolve'
        })
      })

      if (response.ok) {
        setSecurityEvents(events => 
          events.map(event => 
            event.id === eventId 
              ? { ...event, isResolved: true }
              : event
          )
        )
      }
    } catch (error) {
      console.error('Error resolving security event:', error)
    }
  }

  const updatePreferences = async (newPreferences: Partial<SessionPreferences>) => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      })

      if (response.ok) {
        setPreferences(prev => ({ ...prev, ...newPreferences }))
        setShowPreferencesModal(false)
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return '📱'
      case 'tablet': return '📱'
      default: return '💻'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getRiskScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800'
    if (score >= 70) return 'bg-red-100 text-red-800'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Session Management</h2>
        <Button
          onClick={() => setShowPreferencesModal(true)}
          variant="outline"
        >
          Preferences
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'sessions', label: 'Active Sessions', count: sessions.length },
            { key: 'activities', label: 'Recent Activity', count: activities.length },
            { key: 'security', label: 'Security Events', count: securityEvents.filter(e => !e.isResolved).length }
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
              {tab.count > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              You have {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </p>
            {sessions.length > 1 && (
              <Button
                onClick={terminateAllSessions}
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                Terminate All Sessions
              </Button>
            )}
          </div>

          <div className="grid gap-4">
            {sessions.map(session => (
              <Card key={session.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getDeviceIcon(session.deviceType)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {session.deviceName || 'Unknown Device'}
                        </h3>
                        {session.isCurrent && (
                          <Badge variant="primary">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {session.browser} • {session.ipAddress}
                        {session.location && (
                          <span> • {session.location.city}, {session.location.country}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last active: {formatDate(session.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      onClick={() => terminateSession(session.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {activities.map(activity => (
              <Card key={activity.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900 capitalize">
                        {activity.action.replace('_', ' ')}
                      </h3>
                      {activity.riskScore && (
                        <Badge className={getRiskScoreColor(activity.riskScore)}>
                          Risk: {activity.riskScore}
                        </Badge>
                      )}
                      {activity.isBlocked && (
                        <Badge className="bg-red-100 text-red-800">
                          Blocked
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {activity.resource && `${activity.resource} • `}
                      {activity.ipAddress}
                      {activity.session?.deviceName && ` • ${activity.session.deviceName}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(activity.createdAt)}
                    </p>
                    {activity.blockReason && (
                      <p className="text-xs text-red-600 mt-1">
                        {activity.blockReason}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Security Events Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {securityEvents.map(event => (
              <Card key={event.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">
                        {event.eventType.replace('_', ' ')}
                      </h3>
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      {event.isResolved && (
                        <Badge className="bg-green-100 text-green-800">
                          Resolved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.ipAddress && `${event.ipAddress} • `}
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                  {!event.isResolved && (
                    <Button
                      onClick={() => resolveSecurityEvent(event.id)}
                      variant="outline"
                      size="sm"
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <Modal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        title="Session Preferences"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Timeout (seconds)
            </label>
            <select
              value={preferences.sessionTimeout}
              onChange={(e) => setPreferences(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1800}>30 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={7200}>2 hours</option>
              <option value={14400}>4 hours</option>
              <option value={28800}>8 hours</option>
              <option value={86400}>24 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Concurrent Sessions
            </label>
            <select
              value={preferences.maxConcurrentSessions}
              onChange={(e) => setPreferences(prev => ({ ...prev, maxConcurrentSessions: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 session</option>
              <option value={2}>2 sessions</option>
              <option value={3}>3 sessions</option>
              <option value={5}>5 sessions</option>
              <option value={10}>10 sessions</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={preferences.rememberMeEnabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, rememberMeEnabled: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
              Enable "Remember Me" functionality
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowPreferencesModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updatePreferences(preferences)}
            >
              Save Preferences
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}