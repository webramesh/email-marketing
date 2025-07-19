/**
 * Email Personalization Engine
 * 
 * Handles merge tags, dynamic content, and subscriber data personalization
 */

import { Subscriber } from '@/types'
import { processSpintax } from './spintax'

export interface PersonalizationContext {
  subscriber?: Subscriber
  campaign?: {
    id: string
    name: string
    subject: string
  }
  company?: {
    name: string
    address?: string
    phone?: string
    website?: string
  }
  custom?: Record<string, any>
  unsubscribeUrl?: string
  webVersionUrl?: string
}

export interface MergeTag {
  tag: string
  label: string
  description: string
  category: 'subscriber' | 'campaign' | 'company' | 'system' | 'custom'
  example: string
  required?: boolean
}

// Default merge tags available in the system
export const defaultMergeTags: MergeTag[] = [
  // Subscriber tags
  {
    tag: '{{first_name}}',
    label: 'First Name',
    description: 'Subscriber\'s first name',
    category: 'subscriber',
    example: 'John'
  },
  {
    tag: '{{last_name}}',
    label: 'Last Name',
    description: 'Subscriber\'s last name',
    category: 'subscriber',
    example: 'Doe'
  },
  {
    tag: '{{full_name}}',
    label: 'Full Name',
    description: 'Subscriber\'s full name',
    category: 'subscriber',
    example: 'John Doe'
  },
  {
    tag: '{{email}}',
    label: 'Email Address',
    description: 'Subscriber\'s email address',
    category: 'subscriber',
    example: 'john@example.com'
  },
  
  // Campaign tags
  {
    tag: '{{campaign_name}}',
    label: 'Campaign Name',
    description: 'Name of the current campaign',
    category: 'campaign',
    example: 'Monthly Newsletter'
  },
  {
    tag: '{{campaign_subject}}',
    label: 'Campaign Subject',
    description: 'Subject line of the campaign',
    category: 'campaign',
    example: 'Your Monthly Update'
  },
  
  // Company tags
  {
    tag: '{{company_name}}',
    label: 'Company Name',
    description: 'Your company name',
    category: 'company',
    example: 'Acme Corp'
  },
  {
    tag: '{{company_address}}',
    label: 'Company Address',
    description: 'Your company address',
    category: 'company',
    example: '123 Main St, City, State 12345'
  },
  {
    tag: '{{company_phone}}',
    label: 'Company Phone',
    description: 'Your company phone number',
    category: 'company',
    example: '(555) 123-4567'
  },
  {
    tag: '{{company_website}}',
    label: 'Company Website',
    description: 'Your company website URL',
    category: 'company',
    example: 'https://example.com'
  },
  
  // System tags
  {
    tag: '{{unsubscribe_url}}',
    label: 'Unsubscribe URL',
    description: 'Link to unsubscribe from emails',
    category: 'system',
    example: 'https://example.com/unsubscribe/abc123',
    required: true
  },
  {
    tag: '{{web_version_url}}',
    label: 'Web Version URL',
    description: 'Link to view email in browser',
    category: 'system',
    example: 'https://example.com/email/view/abc123'
  },
  {
    tag: '{{current_date}}',
    label: 'Current Date',
    description: 'Current date when email is sent',
    category: 'system',
    example: 'January 15, 2024'
  },
  {
    tag: '{{current_year}}',
    label: 'Current Year',
    description: 'Current year when email is sent',
    category: 'system',
    example: '2024'
  }
]

/**
 * Process personalization tags in content
 */
export function personalizeContent(
  content: string,
  context: PersonalizationContext
): string {
  let personalizedContent = content

  // Process spintax first
  personalizedContent = processSpintax(personalizedContent)

  // Replace merge tags
  personalizedContent = replaceMergeTags(personalizedContent, context)

  return personalizedContent
}

/**
 * Replace merge tags with actual values
 */
function replaceMergeTags(content: string, context: PersonalizationContext): string {
  const { subscriber, campaign, company, custom, unsubscribeUrl, webVersionUrl } = context

  // Subscriber tags
  if (subscriber) {
    content = content.replace(/\{\{first_name\}\}/g, subscriber.firstName || '')
    content = content.replace(/\{\{last_name\}\}/g, subscriber.lastName || '')
    content = content.replace(/\{\{full_name\}\}/g, 
      [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || subscriber.email
    )
    content = content.replace(/\{\{email\}\}/g, subscriber.email)

    // Custom fields
    if (subscriber.customFields && typeof subscriber.customFields === 'object') {
      Object.entries(subscriber.customFields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        content = content.replace(regex, String(value || ''))
      })
    }
  }

  // Campaign tags
  if (campaign) {
    content = content.replace(/\{\{campaign_name\}\}/g, campaign.name)
    content = content.replace(/\{\{campaign_subject\}\}/g, campaign.subject)
  }

  // Company tags
  if (company) {
    content = content.replace(/\{\{company_name\}\}/g, company.name)
    content = content.replace(/\{\{company_address\}\}/g, company.address || '')
    content = content.replace(/\{\{company_phone\}\}/g, company.phone || '')
    content = content.replace(/\{\{company_website\}\}/g, company.website || '')
  }

  // System tags
  content = content.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl || '#')
  content = content.replace(/\{\{web_version_url\}\}/g, webVersionUrl || '#')
  
  const now = new Date()
  content = content.replace(/\{\{current_date\}\}/g, now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }))
  content = content.replace(/\{\{current_year\}\}/g, now.getFullYear().toString())

  // Custom tags
  if (custom) {
    Object.entries(custom).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      content = content.replace(regex, String(value || ''))
    })
  }

  return content
}

/**
 * Extract merge tags from content
 */
export function extractMergeTags(content: string): string[] {
  const mergeTagRegex = /\{\{([^}]+)\}\}/g
  const tags: string[] = []
  let match

  while ((match = mergeTagRegex.exec(content)) !== null) {
    const fullTag = match[0]
    if (!tags.includes(fullTag)) {
      tags.push(fullTag)
    }
  }

  return tags
}

/**
 * Validate merge tags in content
 */
export function validateMergeTags(content: string): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  requiredTags: string[]
  unknownTags: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const extractedTags = extractMergeTags(content)
  const knownTags = defaultMergeTags.map(tag => tag.tag)
  const requiredTags = defaultMergeTags.filter(tag => tag.required).map(tag => tag.tag)
  
  // Check for unknown tags
  const unknownTags = extractedTags.filter(tag => !knownTags.includes(tag))
  
  // Check for required tags
  const missingRequiredTags = requiredTags.filter(tag => !extractedTags.includes(tag))
  
  if (missingRequiredTags.length > 0) {
    errors.push(`Missing required merge tags: ${missingRequiredTags.join(', ')}`)
  }
  
  if (unknownTags.length > 0) {
    warnings.push(`Unknown merge tags found: ${unknownTags.join(', ')}`)
  }

  // Check for malformed tags
  const malformedTags = content.match(/\{[^}]*\{|\}[^{]*\}/g)
  if (malformedTags) {
    errors.push('Malformed merge tags found. Ensure tags are properly formatted as {{tag_name}}')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiredTags: missingRequiredTags,
    unknownTags
  }
}

/**
 * Preview personalized content with sample data
 */
export function previewPersonalization(
  content: string,
  sampleData?: Partial<PersonalizationContext>
): string {
  const defaultSampleData: PersonalizationContext = {
    subscriber: {
      id: 'sample-id',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      status: 'ACTIVE' as any,
      customFields: {
        company: 'Acme Corp',
        position: 'Marketing Manager'
      },
      tenantId: 'sample-tenant',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    campaign: {
      id: 'sample-campaign',
      name: 'Monthly Newsletter',
      subject: 'Your Monthly Update'
    },
    company: {
      name: 'Your Company',
      address: '123 Main Street, City, State 12345',
      phone: '(555) 123-4567',
      website: 'https://yourcompany.com'
    },
    unsubscribeUrl: 'https://example.com/unsubscribe/sample',
    webVersionUrl: 'https://example.com/email/view/sample'
  }

  const mergedData = { ...defaultSampleData, ...sampleData }
  return personalizeContent(content, mergedData)
}

/**
 * Generate personalized subject line
 */
export function personalizeSubject(
  subject: string,
  context: PersonalizationContext
): string {
  return personalizeContent(subject, context)
}

/**
 * Generate personalized preheader
 */
export function personalizePreheader(
  preheader: string,
  context: PersonalizationContext
): string {
  return personalizeContent(preheader, context)
}

/**
 * Get merge tags by category
 */
export function getMergeTagsByCategory(category?: string): MergeTag[] {
  if (!category) {
    return defaultMergeTags
  }
  return defaultMergeTags.filter(tag => tag.category === category)
}

/**
 * Create custom merge tag
 */
export function createCustomMergeTag(
  tag: string,
  label: string,
  description: string,
  example: string
): MergeTag {
  return {
    tag: `{{${tag}}}`,
    label,
    description,
    category: 'custom',
    example
  }
}

/**
 * Batch personalize content for multiple subscribers
 */
export function batchPersonalize(
  content: string,
  subscribers: Subscriber[],
  baseContext: Omit<PersonalizationContext, 'subscriber'>
): Array<{ subscriberId: string; personalizedContent: string }> {
  return subscribers.map(subscriber => ({
    subscriberId: subscriber.id,
    personalizedContent: personalizeContent(content, {
      ...baseContext,
      subscriber
    })
  }))
}