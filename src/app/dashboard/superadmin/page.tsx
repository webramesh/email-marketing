'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { UserRole } from '@/types'
import { PlatformMetricsOverview } from '@/components/superadmin/PlatformMetricsOverview'
import { TenantManagement } from '@/components/superadmin/TenantManagement'
import { PlatformHealthMonitor } from '@/components/superadmin/PlatformHealthMonitor'
import { RevenueTracker } from '@/components/superadmin/RevenueTracker'
import { Button } from '@/components/ui/Button'

export default function SuperAdminDashboard() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState('overview')
  
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
    redirect('/forbidden')
  }

  const tabs = [
    { id: 'overview', label: 'Platform Overview', icon: '📊' },
    { id: 'health', label: 'System Health', icon: '🏥' },
    { id: 'tenants', label: 'Tenant Management', icon: '🏢' },
    { id: 'revenue', label: 'Revenue Analytics', icon: '💰' },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <PlatformMetricsOverview />
      case 'health':
        return <PlatformHealthMonitor />
      case 'tenants':
        return <TenantManagement />
      case 'revenue':
        return <RevenueTracker />
      default:
        return <PlatformMetricsOverview />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Superadmin Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Platform-wide analytics, monitoring, and management
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              🔒 SUPERADMIN ACCESS
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-screen">
        {renderTabContent()}
      </div>
    </div>
  )
}