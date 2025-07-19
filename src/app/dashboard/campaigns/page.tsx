'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CampaignList } from '@/components/campaigns/CampaignList'
import { CampaignForm } from '@/components/campaigns/CampaignForm'
import { EmailBuilder } from '@/components/campaigns/EmailBuilder'
import { EmailTemplates } from '@/components/campaigns/EmailTemplates'
import { ABTestManager } from '@/components/campaigns/ABTestManager'
import { CampaignWithDetails } from '@/types'

type ViewMode = 'list' | 'create' | 'edit' | 'builder' | 'templates' | 'ab-test'

export default function CampaignsPage() {
  const [currentView, setCurrentView] = useState<ViewMode>('list')
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithDetails | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle URL-based navigation and reset view when route is accessed
  useEffect(() => {
    const view = searchParams.get('view') as ViewMode
    const campaignId = searchParams.get('id')
    
    if (view && ['list', 'create', 'edit', 'builder', 'templates', 'ab-test'].includes(view)) {
      setCurrentView(view)
      
      // If editing and we have a campaign ID, fetch the campaign
      if (view === 'edit' && campaignId && (!selectedCampaign || selectedCampaign.id !== campaignId)) {
        fetchCampaign(campaignId)
      }
    } else {
      // If no view parameter or invalid view, default to list
      setCurrentView('list')
      setSelectedCampaign(null)
    }
  }, [searchParams])

  // Fetch campaign by ID for editing
  const fetchCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSelectedCampaign(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    }
  }

  const handleCreateCampaign = () => {
    setSelectedCampaign(null)
    setCurrentView('create')
    router.push('/dashboard/campaigns?view=create')
  }

  const handleEditCampaign = (campaign: CampaignWithDetails) => {
    setSelectedCampaign(campaign)
    setCurrentView('edit')
    router.push(`/dashboard/campaigns?view=edit&id=${campaign.id}`)
  }

  const handleCampaignSaved = (campaign: CampaignWithDetails) => {
    setSelectedCampaign(campaign)
    setCurrentView('list')
    router.push('/dashboard/campaigns')
  }

  const handleTemplateSelected = () => {
    setCurrentView('builder')
    router.push('/dashboard/campaigns?view=builder')
  }

  const handleBackToList = () => {
    setSelectedCampaign(null)
    setCurrentView('list')
    router.push('/dashboard/campaigns')
  }

  return (
    <div className="space-y-6">
      {currentView === 'list' && (
        <CampaignList
          onCreateCampaign={handleCreateCampaign}
          onEditCampaign={handleEditCampaign}
        />
      )}

      {currentView === 'create' && (
        <CampaignForm
          onSave={handleCampaignSaved}
          onCancel={handleBackToList}
        />
      )}

      {currentView === 'edit' && selectedCampaign && (
        <CampaignForm
          campaign={selectedCampaign}
          onSave={handleCampaignSaved}
          onCancel={handleBackToList}
        />
      )}

      {currentView === 'builder' && (
        <EmailBuilder
          initialBlocks={selectedCampaign?.templateData?.blocks || []}
          onSave={(blocks, html) => {
            console.log('Email saved:', { blocks, html })
            handleBackToList()
          }}
          onCancel={handleBackToList}
        />
      )}

      {currentView === 'templates' && (
        <EmailTemplates
          onSelectTemplate={handleTemplateSelected}
          onCreateFromTemplate={handleTemplateSelected}
        />
      )}

      {currentView === 'ab-test' && selectedCampaign && (
        <ABTestManager
          campaignId={selectedCampaign.id}
          onClose={handleBackToList}
          onTestCreated={() => handleBackToList()}
        />
      )}
    </div>
  )
}