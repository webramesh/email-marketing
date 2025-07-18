'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SubscriberStatus } from '@/types'

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

interface ImportPreview {
  headers: string[]
  sampleRows: Record<string, string>[]
  totalRows: number
}

interface ImportResult {
  total: number
  imported: number
  updated: number
  skipped: number
  errors: Array<{
    row: number
    email?: string
    error: string
  }>
}

export function BulkImportModal({ isOpen, onClose, onImportComplete }: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'options' | 'importing' | 'results'>('upload')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<string>('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState({
    email: '',
    firstName: '',
    lastName: '',
    status: '',
  })
  const [options, setOptions] = useState({
    skipDuplicates: true,
    updateExisting: false,
    defaultStatus: SubscriberStatus.ACTIVE,
  })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setCsvFile(file)
    setError(null)

    // Read file content
    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target?.result as string
      setCsvData(content)

      try {
        // Get preview
        const response = await fetch('/api/subscribers/bulk/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ csvData: content }),
        })

        const result = await response.json()

        if (response.ok) {
          setPreview(result.data)
          setStep('mapping')
        } else {
          setError(result.error || 'Failed to preview CSV')
        }
      } catch (err) {
        setError('Failed to process CSV file')
      }
    }
    reader.readAsText(file)
  }

  const handleMapping = () => {
    if (!mapping.email) {
      setError('Email field mapping is required')
      return
    }
    setError(null)
    setStep('options')
  }

  const handleImport = async () => {
    if (!csvData) return

    setImporting(true)
    setStep('importing')
    setError(null)

    try {
      const response = await fetch('/api/subscribers/bulk/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          mapping,
          options,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setImportResult(result.data)
        setStep('results')
        onImportComplete()
      } else {
        setError(result.error || 'Import failed')
        setStep('options')
      }
    } catch (err) {
      setError('Import failed')
      setStep('options')
    } finally {
      setImporting(false)
    }
  }

  const resetModal = () => {
    setStep('upload')
    setCsvFile(null)
    setCsvData('')
    setPreview(null)
    setMapping({ email: '', firstName: '', lastName: '', status: '' })
    setOptions({ skipDuplicates: true, updateExisting: false, defaultStatus: SubscriberStatus.ACTIVE })
    setImporting(false)
    setImportResult(null)
    setError(null)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Subscribers"
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select a CSV file containing subscriber data. The file should include at least an email column.
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-sm text-gray-600">
                  Click to upload CSV file or drag and drop
                </div>
              </label>
            </div>

            {csvFile && (
              <div className="text-sm text-gray-600">
                Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && preview && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Map Columns</h3>
              <p className="text-sm text-gray-600 mb-4">
                Map your CSV columns to subscriber fields. Found {preview.totalRows} rows.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Column *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={mapping.email}
                  onChange={(e) => setMapping(prev => ({ ...prev, email: e.target.value }))}
                >
                  <option value="">Select column</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name Column
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={mapping.firstName}
                  onChange={(e) => setMapping(prev => ({ ...prev, firstName: e.target.value }))}
                >
                  <option value="">Select column</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name Column
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={mapping.lastName}
                  onChange={(e) => setMapping(prev => ({ ...prev, lastName: e.target.value }))}
                >
                  <option value="">Select column</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Column
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={mapping.status}
                  onChange={(e) => setMapping(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">Select column</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.map(header => (
                        <th key={header} className="px-3 py-2 text-left font-medium text-gray-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.slice(0, 3).map((row, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        {preview.headers.map(header => (
                          <td key={header} className="px-3 py-2 text-gray-600">
                            {row[header] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleMapping}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Options */}
        {step === 'options' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Import Options</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure how to handle duplicates and set default values.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="skipDuplicates"
                  checked={options.skipDuplicates}
                  onChange={(e) => setOptions(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="skipDuplicates" className="ml-2 text-sm text-gray-700">
                  Skip duplicate emails
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="updateExisting"
                  checked={options.updateExisting}
                  onChange={(e) => setOptions(prev => ({ ...prev, updateExisting: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="updateExisting" className="ml-2 text-sm text-gray-700">
                  Update existing subscribers
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={options.defaultStatus}
                  onChange={(e) => setOptions(prev => ({ ...prev, defaultStatus: e.target.value as SubscriberStatus }))}
                >
                  <option value={SubscriberStatus.ACTIVE}>Active</option>
                  <option value={SubscriberStatus.UNSUBSCRIBED}>Unsubscribed</option>
                  <option value={SubscriberStatus.BOUNCED}>Bounced</option>
                  <option value={SubscriberStatus.COMPLAINED}>Complained</option>
                  <option value={SubscriberStatus.INVALID}>Invalid</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport} loading={importing}>
                Start Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Importing Subscribers</h3>
            <p className="text-sm text-gray-600">Please wait while we process your file...</p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 'results' && importResult && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </Card>
              <Card className="p-4 bg-green-50">
                <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-gray-600">Imported</div>
              </Card>
              <Card className="p-4 bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">{importResult.updated}</div>
                <div className="text-sm text-gray-600">Updated</div>
              </Card>
              <Card className="p-4 bg-gray-50">
                <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                <div className="text-sm text-gray-600">Skipped</div>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Errors ({importResult.errors.length})
                </h4>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="px-3 py-2 border-b border-gray-200 last:border-b-0">
                      <div className="text-sm text-red-600">
                        Row {error.row}: {error.error}
                        {error.email && <span className="text-gray-500"> ({error.email})</span>}
                      </div>
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                      ... and {importResult.errors.length - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}