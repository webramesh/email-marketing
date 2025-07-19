'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmailBlock } from './EmailBuilder'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  preheader?: string
  templateType: 'CAMPAIGN' | 'AUTOMATION' | 'TRANSACTIONAL'
  isPublic: boolean
  thumbnailUrl?: string
  blocks?: EmailBlock[]
  createdAt: Date
  updatedAt: Date
}

interface EmailTemplatesProps {
  onSelectTemplate?: (template: EmailTemplate) => void
  onCreateFromTemplate?: (template: EmailTemplate) => void
  showCreateButton?: boolean
}

// Predefined template blocks for common email types
const templateBlocks = {
  welcome: [
    {
      id: '1',
      type: 'text' as const,
      content: {
        text: '<h1 style="color: #333; margin-bottom: 20px;">Welcome to Our Platform!</h1>',
        fontSize: '24px',
        color: '#333333',
        textAlign: 'center',
        fontWeight: 'bold'
      }
    },
    {
      id: '2',
      type: 'text' as const,
      content: {
        text: 'Thank you for joining us. We\'re excited to have you on board and can\'t wait to help you get started.',
        fontSize: '16px',
        color: '#666666',
        textAlign: 'center',
        fontWeight: 'normal'
      }
    },
    {
      id: '3',
      type: 'button' as const,
      content: {
        text: 'Get Started',
        link: '#',
        backgroundColor: '#007bff',
        textColor: '#ffffff',
        borderRadius: '6px',
        padding: '14px 28px',
        textAlign: 'center'
      }
    },
    {
      id: '4',
      type: 'spacer' as const,
      content: {
        height: '30px'
      }
    }
  ],
  newsletter: [
    {
      id: '1',
      type: 'text' as const,
      content: {
        text: '<h1 style="color: #333; margin-bottom: 10px;">Monthly Newsletter</h1>',
        fontSize: '28px',
        color: '#333333',
        textAlign: 'left',
        fontWeight: 'bold'
      }
    },
    {
      id: '2',
      type: 'text' as const,
      content: {
        text: '<h2 style="color: #666; margin-bottom: 15px;">What\'s New This Month</h2>',
        fontSize: '20px',
        color: '#666666',
        textAlign: 'left',
        fontWeight: 'bold'
      }
    },
    {
      id: '3',
      type: 'text' as const,
      content: {
        text: 'Here are the latest updates and news from our team. We\'ve been working hard to bring you new features and improvements.',
        fontSize: '16px',
        color: '#666666',
        textAlign: 'left',
        fontWeight: 'normal'
      }
    },
    {
      id: '4',
      type: 'divider' as const,
      content: {
        height: '2px',
        color: '#e5e5e5',
        margin: '25px 0'
      }
    },
    {
      id: '5',
      type: 'text' as const,
      content: {
        text: '<h3 style="color: #333;">Featured Article</h3>',
        fontSize: '18px',
        color: '#333333',
        textAlign: 'left',
        fontWeight: 'bold'
      }
    },
    {
      id: '6',
      type: 'text' as const,
      content: {
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        fontSize: '16px',
        color: '#666666',
        textAlign: 'left',
        fontWeight: 'normal'
      }
    },
    {
      id: '7',
      type: 'button' as const,
      content: {
        text: 'Read More',
        link: '#',
        backgroundColor: '#28a745',
        textColor: '#ffffff',
        borderRadius: '4px',
        padding: '12px 24px',
        textAlign: 'left'
      }
    }
  ],
  promotion: [
    {
      id: '1',
      type: 'text' as const,
      content: {
        text: '<h1 style="color: #dc3545; margin-bottom: 15px;">🎉 Special Offer - 50% Off!</h1>',
        fontSize: '32px',
        color: '#dc3545',
        textAlign: 'center',
        fontWeight: 'bold'
      }
    },
    {
      id: '2',
      type: 'text' as const,
      content: {
        text: 'Limited time offer! Get 50% off on all our premium plans. Don\'t miss out on this amazing deal.',
        fontSize: '18px',
        color: '#333333',
        textAlign: 'center',
        fontWeight: 'normal'
      }
    },
    {
      id: '3',
      type: 'spacer' as const,
      content: {
        height: '20px'
      }
    },
    {
      id: '4',
      type: 'button' as const,
      content: {
        text: 'Claim Your Discount',
        link: '#',
        backgroundColor: '#dc3545',
        textColor: '#ffffff',
        borderRadius: '8px',
        padding: '16px 32px',
        textAlign: 'center'
      }
    },
    {
      id: '5',
      type: 'spacer' as const,
      content: {
        height: '20px'
      }
    },
    {
      id: '6',
      type: 'text' as const,
      content: {
        text: '<small style="color: #999;">Offer expires in 7 days. Terms and conditions apply.</small>',
        fontSize: '14px',
        color: '#999999',
        textAlign: 'center',
        fontWeight: 'normal'
      }
    }
  ],
  announcement: [
    {
      id: '1',
      type: 'text' as const,
      content: {
        text: '<h1 style="color: #333; margin-bottom: 20px;">📢 Important Announcement</h1>',
        fontSize: '26px',
        color: '#333333',
        textAlign: 'center',
        fontWeight: 'bold'
      }
    },
    {
      id: '2',
      type: 'text' as const,
      content: {
        text: 'We have some important news to share with you. Please take a moment to read this update.',
        fontSize: '16px',
        color: '#666666',
        textAlign: 'left',
        fontWeight: 'normal'
      }
    },
    {
      id: '3',
      type: 'spacer' as const,
      content: {
        height: '25px'
      }
    },
    {
      id: '4',
      type: 'text' as const,
      content: {
        text: 'Your announcement content goes here. You can include multiple paragraphs, links, and other important information.',
        fontSize: '16px',
        color: '#333333',
        textAlign: 'left',
        fontWeight: 'normal'
      }
    },
    {
      id: '5',
      type: 'divider' as const,
      content: {
        height: '1px',
        color: '#e5e5e5',
        margin: '30px 0'
      }
    },
    {
      id: '6',
      type: 'text' as const,
      content: {
        text: 'If you have any questions, please don\'t hesitate to contact our support team.',
        fontSize: '14px',
        color: '#666666',
        textAlign: 'left',
        fontWeight: 'normal'
      }
    }
  ]
}

// Predefined templates
const predefinedTemplates: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to {{company_name}}!',
    content: '',
    preheader: 'Thanks for joining us - let\'s get you started',
    templateType: 'CAMPAIGN',
    isPublic: true,
    thumbnailUrl: '/templates/welcome.png',
    blocks: templateBlocks.welcome
  },
  {
    name: 'Monthly Newsletter',
    subject: '{{company_name}} Newsletter - {{month}} {{year}}',
    content: '',
    preheader: 'Your monthly update is here',
    templateType: 'CAMPAIGN',
    isPublic: true,
    thumbnailUrl: '/templates/newsletter.png',
    blocks: templateBlocks.newsletter
  },
  {
    name: 'Promotional Offer',
    subject: '🎉 Special Offer - Don\'t Miss Out!',
    content: '',
    preheader: 'Limited time offer inside',
    templateType: 'CAMPAIGN',
    isPublic: true,
    thumbnailUrl: '/templates/promotion.png',
    blocks: templateBlocks.promotion
  },
  {
    name: 'Announcement',
    subject: 'Important Update from {{company_name}}',
    content: '',
    preheader: 'We have some news to share',
    templateType: 'CAMPAIGN',
    isPublic: true,
    thumbnailUrl: '/templates/announcement.png',
    blocks: templateBlocks.announcement
  },
  {
    name: 'Blank Template',
    subject: 'Your Subject Here',
    content: '',
    preheader: '',
    templateType: 'CAMPAIGN',
    isPublic: true,
    thumbnailUrl: '/templates/blank.png',
    blocks: [
      {
        id: '1',
        type: 'text' as const,
        content: {
          text: 'Start building your email here...',
          fontSize: '16px',
          color: '#333333',
          textAlign: 'left',
          fontWeight: 'normal'
        }
      }
    ]
  }
]

export function EmailTemplates({ onSelectTemplate, onCreateFromTemplate, showCreateButton = true }: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [showPreview, setShowPreview] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  // Load templates (in a real app, this would fetch from API)
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Convert predefined templates to full templates with IDs and dates
        const templatesWithIds: EmailTemplate[] = predefinedTemplates.map((template, index) => ({
          ...template,
          id: `template_${index + 1}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
        
        setTemplates(templatesWithIds)
      } catch (err) {
        setError('Failed to load templates')
        console.error('Error loading templates:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'all' || template.templateType === selectedType
    return matchesSearch && matchesType
  })

  // Handle template selection
  const handleSelectTemplate = (template: EmailTemplate) => {
    onSelectTemplate?.(template)
  }

  // Handle create from template
  const handleCreateFromTemplate = (template: EmailTemplate) => {
    onCreateFromTemplate?.(template)
  }

  // Handle preview
  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template)
    setShowPreview(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Templates</h2>
          <p className="text-gray-600">Choose a template to get started quickly</p>
        </div>
        {showCreateButton && (
          <Button variant="primary" onClick={() => handleSelectTemplate(templates[4])}>
            Start from Blank
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="CAMPAIGN">Campaign</option>
          <option value="AUTOMATION">Automation</option>
          <option value="TRANSACTIONAL">Transactional</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Template Thumbnail */}
            <div className="h-48 bg-gray-100 flex items-center justify-center">
              {template.thumbnailUrl ? (
                <img
                  src={template.thumbnailUrl}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 text-center">
                  <div className="text-4xl mb-2">📧</div>
                  <div>Email Template</div>
                </div>
              )}
            </div>

            {/* Template Info */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {template.name}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {template.subject}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {template.templateType}
                </span>
                {template.isPublic && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    Public
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSelectTemplate(template)}
                  className="flex-1"
                >
                  Use Template
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePreview(template)}
                >
                  Preview
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {searchTerm || selectedType !== 'all' 
              ? 'No templates match your criteria' 
              : 'No templates available'
            }
          </div>
          {(searchTerm || selectedType !== 'all') && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearchTerm('')
                setSelectedType('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={`Preview: ${previewTemplate?.name}`}
        size="lg"
      >
        {previewTemplate && (
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-semibold">Subject: {previewTemplate.subject}</h3>
              {previewTemplate.preheader && (
                <p className="text-sm text-gray-600">Preheader: {previewTemplate.preheader}</p>
              )}
            </div>
            <div className="max-h-96 overflow-auto bg-gray-50 p-4 rounded">
              <div className="bg-white max-w-2xl mx-auto p-6 rounded shadow">
                {previewTemplate.blocks?.map((block, index) => (
                  <div key={block.id} className="mb-4">
                    {block.type === 'text' && (
                      <div
                        style={{
                          fontSize: block.content.fontSize,
                          color: block.content.color,
                          textAlign: block.content.textAlign,
                          fontWeight: block.content.fontWeight
                        }}
                        dangerouslySetInnerHTML={{ __html: block.content.text }}
                      />
                    )}
                    {block.type === 'button' && (
                      <div style={{ textAlign: block.content.textAlign }}>
                        <button
                          style={{
                            backgroundColor: block.content.backgroundColor,
                            color: block.content.textColor,
                            padding: block.content.padding,
                            borderRadius: block.content.borderRadius,
                            border: 'none',
                            fontWeight: 'bold'
                          }}
                        >
                          {block.content.text}
                        </button>
                      </div>
                    )}
                    {block.type === 'spacer' && (
                      <div style={{ height: block.content.height }} />
                    )}
                    {block.type === 'divider' && (
                      <div
                        style={{
                          height: block.content.height,
                          backgroundColor: block.content.color,
                          margin: block.content.margin
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleSelectTemplate(previewTemplate)
                  setShowPreview(false)
                }}
              >
                Use This Template
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}