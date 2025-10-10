'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Calendar, Tag, FileText, Link2 } from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'

interface AttachModalProps {
  patchId: string
  item: DiscoveredItem
  mode: 'timeline' | 'fact' | 'source'
  isOpen: boolean
  onClose: () => void
}

export function AttachModal({ patchId, item, mode, isOpen, onClose }: AttachModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: item.title,
    date: item.meta.publishDate ? new Date(item.meta.publishDate).toISOString().split('T')[0] : '',
    tags: item.content.keyPoints?.join(', ') || '',
    citation: `${item.meta.sourceDomain} - ${item.url}`,
    notes: '',
    // Fact-specific fields
    label: '',
    value: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Handle different modes
      switch (mode) {
        case 'timeline':
          console.log('Attaching to timeline:', { patchId, item, formData })
          break
        case 'fact':
          console.log('Attaching as fact:', { patchId, item, formData })
          break
        case 'source':
          console.log('Attaching as source:', { patchId, item })
          break
      }
      
      onClose()
    } catch (error) {
      console.error('Failed to attach item:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getModalTitle = () => {
    switch (mode) {
      case 'timeline': return 'Add to Timeline'
      case 'fact': return 'Add as Fact'
      case 'source': return 'Add as Source'
      default: return 'Attach Content'
    }
  }

  const getModalDescription = () => {
    switch (mode) {
      case 'timeline': return 'Add this content as a timeline event'
      case 'fact': return 'Extract key facts from this content'
      case 'source': return 'Add this as a reference source'
      default: return 'Attach this content to your group'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{getModalTitle()}</h2>
              <p className="text-gray-600 mt-1">{getModalDescription()}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Source Preview */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 line-clamp-2">{item.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content.summary150}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {item.type}
                  </Badge>
                  <span className="text-xs text-gray-500">{item.meta.sourceDomain}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Form */}
          {mode === 'timeline' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Comma-separated tags"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Citation
                </label>
                <Input
                  value={formData.citation}
                  onChange={(e) => setFormData(prev => ({ ...prev, citation: e.target.value }))}
                  placeholder="Source citation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes (optional)"
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </>
          )}

          {/* Fact Form */}
          {mode === 'fact' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label *
                </label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Founded, Championships, Key Player"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value *
                </label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="e.g., 1960, 2 AFL Championships, Warren Moon"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Citation
                </label>
                <Input
                  value={formData.citation}
                  onChange={(e) => setFormData(prev => ({ ...prev, citation: e.target.value }))}
                  placeholder="Source citation"
                />
              </div>
            </>
          )}

          {/* Source Form */}
          {mode === 'source' && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Add as Source</h3>
              <p className="text-gray-600 mb-6">
                This will add the content as a reference source for your group.
              </p>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Title:</strong> {item.title}<br />
                  <strong>Source:</strong> {item.meta.sourceDomain}<br />
                  <strong>Type:</strong> {item.type}
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? 'Adding...' : `Add ${mode === 'source' ? 'Source' : mode}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
