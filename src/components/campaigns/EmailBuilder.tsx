'use client'

import { useState, useCallback } from 'react'
// Note: @hello-pangea/dnd needs to be installed: npm install @hello-pangea/dnd
// For now, we'll create a simplified version without drag-and-drop
// import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

// Email block types
export interface EmailBlock {
  id: string
  type: 'text' | 'image' | 'button' | 'divider' | 'social' | 'spacer'
  content: any
  styles?: any
}

interface EmailBuilderProps {
  initialBlocks?: EmailBlock[]
  onSave?: (blocks: EmailBlock[], html: string) => void
  onCancel?: () => void
}

// Default block templates
const blockTemplates: Record<string, Omit<EmailBlock, 'id'>> = {
  text: {
    type: 'text',
    content: {
      text: 'Enter your text here...',
      fontSize: '16px',
      color: '#333333',
      textAlign: 'left',
      fontWeight: 'normal'
    }
  },
  image: {
    type: 'image',
    content: {
      src: '',
      alt: 'Image',
      width: '100%',
      height: 'auto',
      link: ''
    }
  },
  button: {
    type: 'button',
    content: {
      text: 'Click Here',
      link: '#',
      backgroundColor: '#007bff',
      textColor: '#ffffff',
      borderRadius: '4px',
      padding: '12px 24px',
      textAlign: 'center'
    }
  },
  divider: {
    type: 'divider',
    content: {
      height: '1px',
      color: '#e5e5e5',
      margin: '20px 0'
    }
  },
  social: {
    type: 'social',
    content: {
      platforms: [
        { name: 'facebook', url: '#', icon: '📘' },
        { name: 'twitter', url: '#', icon: '🐦' },
        { name: 'instagram', url: '#', icon: '📷' }
      ],
      alignment: 'center'
    }
  },
  spacer: {
    type: 'spacer',
    content: {
      height: '20px'
    }
  }
}

export function EmailBuilder({ initialBlocks = [], onSave, onCancel }: EmailBuilderProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    initialBlocks.length > 0 
      ? initialBlocks 
      : [{ id: '1', ...blockTemplates.text }]
  )
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Generate unique ID for new blocks
  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  // Move block up
  const moveBlockUp = useCallback((index: number) => {
    if (index === 0) return
    const newBlocks = [...blocks]
    const [block] = newBlocks.splice(index, 1)
    newBlocks.splice(index - 1, 0, block)
    setBlocks(newBlocks)
  }, [blocks])

  // Move block down
  const moveBlockDown = useCallback((index: number) => {
    if (index === blocks.length - 1) return
    const newBlocks = [...blocks]
    const [block] = newBlocks.splice(index, 1)
    newBlocks.splice(index + 1, 0, block)
    setBlocks(newBlocks)
  }, [blocks])

  // Add new block
  const addBlock = (type: keyof typeof blockTemplates) => {
    const newBlock: EmailBlock = {
      id: generateId(),
      ...blockTemplates[type]
    }
    setBlocks(prev => [...prev, newBlock])
  }

  // Delete block
  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(block => block.id !== blockId))
    if (selectedBlock === blockId) {
      setSelectedBlock(null)
    }
  }

  // Update block content
  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    setBlocks(prev => prev.map(block => 
      block.id === blockId 
        ? { ...block, ...updates }
        : block
    ))
  }

  // Generate HTML from blocks
  const generateHTML = () => {
    const blockHTML = blocks.map(block => {
      switch (block.type) {
        case 'text':
          return `
            <div style="
              font-size: ${block.content.fontSize};
              color: ${block.content.color};
              text-align: ${block.content.textAlign};
              font-weight: ${block.content.fontWeight};
              margin: 10px 0;
            ">
              ${block.content.text}
            </div>
          `
        case 'image':
          return `
            <div style="text-align: center; margin: 10px 0;">
              ${block.content.link ? `<a href="${block.content.link}">` : ''}
              <img 
                src="${block.content.src}" 
                alt="${block.content.alt}"
                style="
                  width: ${block.content.width};
                  height: ${block.content.height};
                  max-width: 100%;
                "
              />
              ${block.content.link ? '</a>' : ''}
            </div>
          `
        case 'button':
          return `
            <div style="text-align: ${block.content.textAlign}; margin: 20px 0;">
              <a 
                href="${block.content.link}"
                style="
                  display: inline-block;
                  background-color: ${block.content.backgroundColor};
                  color: ${block.content.textColor};
                  padding: ${block.content.padding};
                  border-radius: ${block.content.borderRadius};
                  text-decoration: none;
                  font-weight: bold;
                "
              >
                ${block.content.text}
              </a>
            </div>
          `
        case 'divider':
          return `
            <div style="
              height: ${block.content.height};
              background-color: ${block.content.color};
              margin: ${block.content.margin};
            "></div>
          `
        case 'social':
          return `
            <div style="text-align: ${block.content.alignment}; margin: 20px 0;">
              ${block.content.platforms.map((platform: any) => `
                <a href="${platform.url}" style="margin: 0 10px; text-decoration: none;">
                  <span style="font-size: 24px;">${platform.icon}</span>
                </a>
              `).join('')}
            </div>
          `
        case 'spacer':
          return `
            <div style="height: ${block.content.height};"></div>
          `
        default:
          return ''
      }
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    ${blockHTML}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }

  // Handle save
  const handleSave = () => {
    const html = generateHTML()
    onSave?.(blocks, html)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Block Library */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-4">Content Blocks</h3>
        <div className="space-y-2">
          {Object.entries(blockTemplates).map(([type]) => (
            <Button
              key={type}
              variant="secondary"
              size="sm"
              onClick={() => addBlock(type as keyof typeof blockTemplates)}
              className="w-full justify-start"
            >
              {type === 'text' && '📝'} 
              {type === 'image' && '🖼️'} 
              {type === 'button' && '🔘'} 
              {type === 'divider' && '➖'} 
              {type === 'social' && '📱'} 
              {type === 'spacer' && '⬜'} 
              <span className="ml-2 capitalize">{type}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Email Builder</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowPreview(true)}>
              Preview
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex">
          {/* Canvas */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="min-h-96 p-4">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={`
                      relative group mb-2 p-2 border-2 border-transparent rounded
                      ${selectedBlock === block.id ? 'border-blue-500' : ''}
                      hover:border-gray-300
                    `}
                    onClick={() => setSelectedBlock(block.id)}
                  >
                    {/* Move Controls */}
                    <div className="absolute -left-12 top-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          moveBlockUp(index)
                        }}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          moveBlockDown(index)
                        }}
                        disabled={index === blocks.length - 1}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteBlock(block.id)
                      }}
                      className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      title="Delete block"
                    >
                      🗑️
                    </button>

                    {/* Block Content */}
                    <EmailBlockRenderer block={block} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Properties Panel */}
          {selectedBlock && (
            <div className="w-80 bg-white border-l border-gray-200 p-4">
              <h3 className="text-lg font-semibold mb-4">Block Properties</h3>
              <EmailBlockEditor
                block={blocks.find(b => b.id === selectedBlock)!}
                onUpdate={(updates) => updateBlock(selectedBlock, updates)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Email Preview"
        size="lg"
      >
        <div className="max-h-96 overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: generateHTML() }} />
        </div>
      </Modal>
    </div>
  )
}

// Block Renderer Component
function EmailBlockRenderer({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case 'text':
      return (
        <div
          style={{
            fontSize: block.content.fontSize,
            color: block.content.color,
            textAlign: block.content.textAlign,
            fontWeight: block.content.fontWeight
          }}
        >
          {block.content.text}
        </div>
      )
    case 'image':
      return (
        <div style={{ textAlign: 'center' }}>
          {block.content.src ? (
            <img
              src={block.content.src}
              alt={block.content.alt}
              style={{
                width: block.content.width,
                height: block.content.height,
                maxWidth: '100%'
              }}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-300 p-8 text-center text-gray-500">
              Click to add image
            </div>
          )}
        </div>
      )
    case 'button':
      return (
        <div style={{ textAlign: block.content.textAlign }}>
          <button
            style={{
              backgroundColor: block.content.backgroundColor,
              color: block.content.textColor,
              padding: block.content.padding,
              borderRadius: block.content.borderRadius,
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {block.content.text}
          </button>
        </div>
      )
    case 'divider':
      return (
        <div
          style={{
            height: block.content.height,
            backgroundColor: block.content.color,
            margin: block.content.margin
          }}
        />
      )
    case 'social':
      return (
        <div style={{ textAlign: block.content.alignment }}>
          {block.content.platforms.map((platform: any, index: number) => (
            <span key={index} style={{ margin: '0 10px', fontSize: '24px' }}>
              {platform.icon}
            </span>
          ))}
        </div>
      )
    case 'spacer':
      return <div style={{ height: block.content.height }} />
    default:
      return <div>Unknown block type</div>
  }
}

// Block Editor Component
function EmailBlockEditor({ 
  block, 
  onUpdate 
}: { 
  block: EmailBlock
  onUpdate: (updates: Partial<EmailBlock>) => void 
}) {
  const updateContent = (key: string, value: any) => {
    onUpdate({
      content: {
        ...block.content,
        [key]: value
      }
    })
  }

  switch (block.type) {
    case 'text':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Text</label>
            <textarea
              value={block.content.text}
              onChange={(e) => updateContent('text', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Font Size</label>
            <Input
              value={block.content.fontSize}
              onChange={(e) => updateContent('fontSize', e.target.value)}
              placeholder="16px"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <Input
              type="color"
              value={block.content.color}
              onChange={(e) => updateContent('color', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Text Align</label>
            <select
              value={block.content.textAlign}
              onChange={(e) => updateContent('textAlign', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )
    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <Input
              value={block.content.src}
              onChange={(e) => updateContent('src', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alt Text</label>
            <Input
              value={block.content.alt}
              onChange={(e) => updateContent('alt', e.target.value)}
              placeholder="Image description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Link URL (Optional)</label>
            <Input
              value={block.content.link}
              onChange={(e) => updateContent('link', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
      )
    case 'button':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Button Text</label>
            <Input
              value={block.content.text}
              onChange={(e) => updateContent('text', e.target.value)}
              placeholder="Click Here"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Link URL</label>
            <Input
              value={block.content.link}
              onChange={(e) => updateContent('link', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Background Color</label>
            <Input
              type="color"
              value={block.content.backgroundColor}
              onChange={(e) => updateContent('backgroundColor', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Text Color</label>
            <Input
              type="color"
              value={block.content.textColor}
              onChange={(e) => updateContent('textColor', e.target.value)}
            />
          </div>
        </div>
      )
    case 'spacer':
      return (
        <div>
          <label className="block text-sm font-medium mb-1">Height</label>
          <Input
            value={block.content.height}
            onChange={(e) => updateContent('height', e.target.value)}
            placeholder="20px"
          />
        </div>
      )
    default:
      return <div>No properties available</div>
  }
}