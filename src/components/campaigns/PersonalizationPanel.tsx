'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { 
  defaultMergeTags, 
  extractMergeTags, 
  validateMergeTags,
  previewPersonalization
} from '@/lib/personalization'
import { 
  validateSpintax, 
  previewSpintax, 
  extractSpintaxOptions,
  countSpintaxCombinations
} from '@/lib/spintax'

interface PersonalizationPanelProps {
  content: string
  onInsertTag?: (tag: string) => void
  onPreview?: (previewContent: string) => void
}

export function PersonalizationPanel({ content, onInsertTag, onPreview }: PersonalizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'merge-tags' | 'spintax'>('merge-tags')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [showSpintaxHelper, setShowSpintaxHelper] = useState(false)

  // Filter merge tags
  const filteredMergeTags = defaultMergeTags.filter(tag => {
    const matchesCategory = selectedCategory === 'all' || tag.category === selectedCategory
    const matchesSearch = tag.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tag.tag.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(defaultMergeTags.map(tag => tag.category)))]

  // Validate current content
  const mergeTagValidation = validateMergeTags(content)
  const spintaxValidation = validateSpintax(content)
  const extractedTags = extractMergeTags(content)
  const spintaxOptions = extractSpintaxOptions(content)
  const spintaxCombinations = countSpintaxCombinations(content)

  // Handle preview
  const handlePreview = () => {
    const preview = previewPersonalization(content)
    setPreviewContent(preview)
    setShowPreview(true)
    onPreview?.(preview)
  }

  // Handle spintax preview
  const handleSpintaxPreview = () => {
    const variations = previewSpintax(content, 5)
    const preview = variations.join('\n\n---\n\n')
    setPreviewContent(preview)
    setShowPreview(true)
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Personalization</h3>
        <div className="flex mt-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('merge-tags')}
            className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === 'merge-tags'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Merge Tags
          </button>
          <button
            onClick={() => setActiveTab('spintax')}
            className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === 'spintax'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Spintax
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'merge-tags' && (
          <div className="p-4 space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <Input
                placeholder="Search merge tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Merge Tags List */}
            <div className="space-y-2">
              {filteredMergeTags.map((tag) => (
                <Card key={tag.tag} className="p-3 hover:bg-gray-50 cursor-pointer">
                  <div onClick={() => onInsertTag?.(tag.tag)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{tag.label}</span>
                      {tag.required && (
                        <span className="text-xs bg-red-100 text-red-800 px-1 rounded">Required</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">{tag.description}</div>
                    <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      {tag.tag}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Example: {tag.example}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Validation Status */}
            {extractedTags.length > 0 && (
              <Card className="p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Content Analysis</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium">Tags found:</span> {extractedTags.length}
                  </div>
                  {mergeTagValidation.errors.length > 0 && (
                    <div className="text-red-600">
                      <span className="font-medium">Errors:</span>
                      <ul className="list-disc list-inside mt-1">
                        {mergeTagValidation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mergeTagValidation.warnings.length > 0 && (
                    <div className="text-orange-600">
                      <span className="font-medium">Warnings:</span>
                      <ul className="list-disc list-inside mt-1">
                        {mergeTagValidation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mergeTagValidation.isValid && (
                    <div className="text-green-600">
                      ✓ All merge tags are valid
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'spintax' && (
          <div className="p-4 space-y-4">
            {/* Spintax Helper */}
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">Spintax Helper</h4>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSpintaxHelper(true)}
                >
                  Help
                </Button>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Format: {'{option1|option2|option3}'}</div>
                <div>Example: {'{Hello|Hi|Hey}'} there!</div>
              </div>
            </Card>

            {/* Quick Insert */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Quick Insert</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onInsertTag?.('{Hello|Hi|Hey}')}
                >
                  Greeting
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onInsertTag?.('{Thanks|Thank you}')}
                >
                  Thanks
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onInsertTag?.('{Best|Kind} regards')}
                >
                  Closing
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onInsertTag?.('{amazing|great|fantastic}')}
                >
                  Adjective
                </Button>
              </div>
            </div>

            {/* Spintax Analysis */}
            {spintaxOptions.length > 0 && (
              <Card className="p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Spintax Analysis</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium">Groups found:</span> {spintaxOptions.length}
                  </div>
                  <div>
                    <span className="font-medium">Total combinations:</span> {spintaxCombinations.toLocaleString()}
                  </div>
                  
                  {spintaxOptions.map((option, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded">
                      <div className="font-mono text-xs mb-1">{option.original}</div>
                      <div className="text-gray-600">
                        Options: {option.options.join(', ')}
                      </div>
                    </div>
                  ))}

                  {!spintaxValidation.isValid && (
                    <div className="text-red-600">
                      <span className="font-medium">Errors:</span>
                      <ul className="list-disc list-inside mt-1">
                        {spintaxValidation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {spintaxValidation.isValid && spintaxOptions.length > 0 && (
                    <div className="text-green-600">
                      ✓ Spintax syntax is valid
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handlePreview}
          className="w-full"
        >
          Preview Personalization
        </Button>
        {activeTab === 'spintax' && spintaxOptions.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSpintaxPreview}
            className="w-full"
          >
            Preview Spintax Variations
          </Button>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Personalization Preview"
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            This is how your content will look with sample data:
          </div>
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
            <div className="whitespace-pre-wrap font-mono text-sm">
              {previewContent}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Spintax Help Modal */}
      <Modal
        isOpen={showSpintaxHelper}
        onClose={() => setShowSpintaxHelper(false)}
        title="Spintax Help"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">What is Spintax?</h4>
            <p className="text-sm text-gray-600">
              Spintax allows you to create multiple variations of your content automatically. 
              Each time an email is sent, a random variation will be selected.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">How to use Spintax:</h4>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Basic format:</strong> <code className="bg-gray-100 px-1 rounded">{'{option1|option2|option3}'}</code>
              </div>
              <div>
                <strong>Example:</strong> <code className="bg-gray-100 px-1 rounded">{'{Hello|Hi|Hey}'} there!</code>
              </div>
              <div>
                <strong>Result:</strong> "Hello there!" or "Hi there!" or "Hey there!"
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Best Practices:</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Use spintax for greetings, adjectives, and call-to-action phrases</li>
              <li>Keep variations similar in tone and meaning</li>
              <li>Test your spintax with the preview function</li>
              <li>Don't overuse spintax - it can make content feel unnatural</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowSpintaxHelper(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}