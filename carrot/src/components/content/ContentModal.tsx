'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Copy, Calendar, Clock, User, Globe, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ActionBar from './ActionBar'
import ContentBlocks from './ContentBlocks'
import { useContentPreview } from '@/hooks/useContentPreview'

interface ContentModalProps {
  contentId: string
  isOpen: boolean
  onClose: () => void
}

export default function ContentModal({ contentId, isOpen, onClose }: ContentModalProps) {
  const router = useRouter()
  const modalRef = useRef<HTMLDivElement>(null)
  const [linkStatus, setLinkStatus] = useState<{
    verified: boolean
    status: number
    finalUrl: string
    archivedUrl?: string
    checkedAt?: string
  } | null>(null)
  const [showArchivePrompt, setShowArchivePrompt] = useState(false)

  const { data: preview, isLoading, error } = useContentPreview(contentId)

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
      if (event.key === 'Tab') {
        handleTabKey(event)
      }
    }

    const handleTabKey = (event: KeyboardEvent) => {
      if (!modalRef.current) return

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>
      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus()
          event.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus()
          event.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    // Focus the modal content when it opens
    const firstFocusable = modalRef.current?.querySelector('[data-focusable]') as HTMLElement
    if (firstFocusable) {
      firstFocusable.focus()
    } else {
      modalRef.current?.focus()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleOpenOriginal = async () => {
    if (!preview) return

    try {
      const response = await fetch(`/api/internal/links/verify?url=${encodeURIComponent(preview.meta.canonicalUrl)}`)
      const result = await response.json()
      
      setLinkStatus({
        verified: result.ok,
        status: result.status,
        finalUrl: result.finalUrl,
        archivedUrl: result.archivedUrl,
        checkedAt: result.checkedAt
      })
      
      if (result.ok) {
        window.open(result.finalUrl || preview.meta.canonicalUrl, '_blank', 'noopener')
      } else {
        if (result.archivedUrl) {
          setShowArchivePrompt(true)
        } else {
          // Show toast: "Source appears unavailable"
          console.warn('Source appears unavailable')
        }
      }
    } catch (error) {
      console.error('Link verification error:', error)
      // Fallback to direct open
      window.open(preview.meta.canonicalUrl, '_blank', 'noopener')
    }
  }

  const handleOpenArchive = () => {
    if (linkStatus?.archivedUrl) {
      window.open(linkStatus.archivedUrl, '_blank', 'noopener')
      setShowArchivePrompt(false)
    }
  }

  const handleCopyLink = async () => {
    if (!preview) return
    
    try {
      await navigator.clipboard.writeText(window.location.href)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return ''
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="max-w-[1200px] w-[92vw] h-[88vh] rounded-2xl bg-white shadow-xl relative overflow-hidden flex flex-col"
        tabIndex={-1}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-white/80 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close dialog"
          data-focusable
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>

        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200 p-6 md:p-8">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded-lg mb-4 w-3/4"></div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-4 w-16 bg-gray-200 rounded"></div>
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : preview ? (
            <>
              <h1 
                id="modal-title"
                className="text-3xl font-semibold leading-tight text-slate-900 mb-4"
              >
                {preview.title}
              </h1>
              
              {/* Meta Row */}
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                  <img 
                    src={preview.meta.favicon} 
                    alt="" 
                    className="w-4 h-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <span>{preview.meta.domain}</span>
                </div>
                
                {preview.meta.author && (
                  <>
                    <span>·</span>
                    <span>{preview.meta.author}</span>
                  </>
                )}
                
                {preview.meta.publishDate && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(preview.meta.publishDate)}</span>
                    </div>
                  </>
                )}
                
                {preview.meta.readTime && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{preview.meta.readTime} min read</span>
                    </div>
                  </>
                )}
              </div>

              {/* Link Status Warning */}
              {linkStatus && !linkStatus.verified && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Source may be unavailable. Last checked {linkStatus.checkedAt ? new Date(linkStatus.checkedAt).toLocaleString() : 'recently'}.
                  </span>
                </div>
              )}

              {/* Compact Hero */}
              {preview.hero && (
                <div className="aspect-[21/9] h-48 md:h-56 rounded-xl overflow-hidden mb-4 relative">
                  <img 
                    src={preview.hero} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Action Bar Overlay */}
                  <div className="absolute left-4 bottom-4 z-10">
                    <ActionBar
                      variant="overlay"
                      onAttach={() => console.log('Attach clicked')}
                      onDiscuss={() => console.log('Discuss clicked')}
                      onShare={() => console.log('Share clicked')}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-600">Failed to load content preview</p>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 p-6 md:p-8 overflow-hidden">
          {/* Content Column (Left) */}
          <div className="overflow-y-auto">
            {isLoading ? (
              <ContentBlocks.Skeleton />
            ) : preview ? (
              <ContentBlocks 
                summary={preview.summary}
                keyPoints={preview.keyPoints}
                excerptHtml={preview.excerptHtml}
                entities={preview.entities}
                timeline={preview.timeline}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">We couldn't generate a preview. You can still open the source.</p>
                <Button onClick={handleOpenOriginal} className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Original
                </Button>
              </div>
            )}

            {/* Inline Action Bar */}
            {preview && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <ActionBar
                  variant="inline"
                  onAttach={() => console.log('Attach clicked')}
                  onDiscuss={() => console.log('Discuss clicked')}
                  onShare={() => console.log('Share clicked')}
                />
              </div>
            )}
          </div>

          {/* Comments Column (Right) */}
          <div className="min-w-[340px] border-l border-slate-200 bg-slate-50 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
            
            {/* Comment Editor - Sticky at top */}
            <div className="sticky top-0 bg-slate-50 pb-4 mb-4">
              <textarea
                placeholder="Write a comment..."
                className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                data-focusable
                aria-label="Write a comment"
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Post Comment
                </Button>
              </div>
            </div>

            {/* Comments Thread */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                    U
                  </div>
                  <span className="text-sm font-medium text-slate-900">User</span>
                  <span className="text-xs text-slate-500">2 hours ago</span>
                </div>
                <p className="text-sm text-slate-700">This is a great article! Thanks for sharing.</p>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium">
                    A
                  </div>
                  <span className="text-sm font-medium text-slate-900">Another User</span>
                  <span className="text-xs text-slate-500">1 hour ago</span>
                </div>
                <p className="text-sm text-slate-700">I found this really helpful for my research.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Source Actions */}
        {preview && (
          <div className="border-t border-slate-200 p-6 md:p-8 bg-slate-50">
            <div className="flex gap-3">
              <Button 
                onClick={handleOpenOriginal} 
                className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
                data-focusable
                aria-label="Open original article"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Original
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCopyLink}
                data-focusable
                aria-label="Copy link to clipboard"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        )}

        {/* Archive Prompt Modal */}
        {showArchivePrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Original Link Unavailable</h3>
              <p className="text-slate-600 mb-4">
                The original link appears to be down (HTTP {linkStatus?.status}). 
                Would you like to open the archived copy instead?
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={handleOpenArchive} 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-focusable
                  aria-label="Open archived version"
                >
                  Open Archive
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowArchivePrompt(false)}
                  data-focusable
                  aria-label="Cancel and close dialog"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
