'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Share2, Clock, Calendar, AlertTriangle, X } from 'lucide-react'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import { DiscoveredItem } from '@/types/discovered-content'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface ContentModalV3Props {
  item: DiscoveredItem | null
  isOpen: boolean
  onClose: () => void
}

export default function ContentModalV3({ item, isOpen, onClose }: ContentModalV3Props) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [linkStatus, setLinkStatus] = useState<{
    verified: boolean
    status: number
    finalUrl: string
    archivedUrl?: string
    checkedAt?: string
  } | null>(null)
  const [showArchivePrompt, setShowArchivePrompt] = useState(false)
  const [leftPanelSize, setLeftPanelSize] = useState(70)
  const [rightPanelSize, setRightPanelSize] = useState(30)

  // Load panel sizes from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSizes = localStorage.getItem('modalPaneSplit')
      if (savedSizes) {
        try {
          const { left, right } = JSON.parse(savedSizes)
          setLeftPanelSize(left)
          setRightPanelSize(right)
        } catch (e) {
          // Use defaults if parsing fails
        }
      }
    }
  }, [])

  // Save panel sizes to localStorage
  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length >= 2) {
      const [left, right] = sizes
      if (typeof window !== 'undefined') {
        localStorage.setItem('modalPaneSplit', JSON.stringify({ left, right }))
      }
    }
  }

  // Reset states when item changes
  useEffect(() => {
    setImageLoaded(false)
    setIsLoading(false)
    setLinkStatus(null)
    setShowArchivePrompt(false)
  }, [item?.id])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Focus trap - focus the first focusable element
      const firstFocusable = document.querySelector('[data-focusable]') as HTMLElement
      if (firstFocusable) {
        firstFocusable.focus()
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!item) return null

  const hero = pickHero(item)
  const dominantColor = getDominantColor(item)
  const shouldShowHero = hero && !hero.includes('ui-avatars.com')

  const verifyAndOpenLink = async (url: string) => {
    try {
      const response = await fetch(`/api/internal/links/verify?url=${encodeURIComponent(url)}`)
      const result = await response.json()
      
      setLinkStatus({
        verified: result.ok,
        status: result.status,
        finalUrl: result.finalUrl,
        archivedUrl: result.archivedUrl,
        checkedAt: result.checkedAt
      })
      
      if (result.ok) {
        window.open(result.finalUrl || url, '_blank', 'noopener')
        // Track the event
        trackEvent('open_source', { postId: item.id, url })
      } else {
        if (result.archivedUrl) {
          setShowArchivePrompt(true)
        } else {
          console.warn('Link verification failed:', result.status)
        }
      }
    } catch (error) {
      console.error('Link verification error:', error)
      // Fallback to direct open
      window.open(url, '_blank', 'noopener')
      trackEvent('open_source', { postId: item.id, url })
    }
  }

  const handleOpenOriginal = () => {
    if (item.url) {
      verifyAndOpenLink(item.url)
    }
  }

  const handleOpenArchive = () => {
    if (linkStatus?.archivedUrl) {
      window.open(linkStatus.archivedUrl, '_blank', 'noopener')
      setShowArchivePrompt(false)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: item.title,
      text: item.content.summary150,
      url: item.url
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
        trackEvent('share', { postId: item.id })
      } catch (error) {
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareData.url)
      trackEvent('share', { postId: item.id })
    }
  }

  const trackEvent = (action: string, data: any) => {
    // Track events for analytics
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        data,
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-[1100px] h-[86vh] max-h-[900px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Content Modal</DialogTitle>
        <DialogDescription className="sr-only">
          View and interact with content from the discovery feed
        </DialogDescription>
        
        {/* Header Strip - Thin hero band */}
        <header className="relative h-32 md:h-40 overflow-hidden rounded-t-2xl">
          {/* Hero Background */}
          {shouldShowHero && (
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ 
                backgroundImage: `url(${hero})`,
                filter: 'brightness(0.4)'
              }}
            />
          )}
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-transparent" />

          {/* Content */}
          <div className="relative z-10 flex h-full items-center justify-between px-6">
            <div className="flex flex-col justify-center">
              <h1 className="text-xl md:text-2xl font-semibold line-clamp-2 text-white">
                {item.title}
              </h1>
              <div className="flex items-center text-sm text-slate-300 gap-2 mt-1">
                {item.meta?.sourceDomain && (
                  <span className="flex items-center gap-1.5">
                    {item.meta.favicon && (
                      <img src={item.meta.favicon} alt="favicon" className="h-4 w-4 rounded-sm" />
                    )}
                    {item.meta.sourceDomain}
                  </span>
                )}
                {item.meta?.publishDate && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span>{formatDate(item.meta.publishDate)}</span>
                  </>
                )}
                {item.content.readingTimeMin && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.content.readingTimeMin} min read
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 bg-black/70 backdrop-blur-sm rounded-full p-1.5">
              <Button 
                onClick={handleOpenOriginal}
                className="text-white hover:bg-white/20"
                variant="ghost"
                size="sm"
                data-focusable
                aria-label="View original source"
                disabled={!item.url}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </Button>
              <Button 
                onClick={handleShare}
                className="text-white hover:bg-white/20"
                variant="ghost"
                size="sm"
                data-focusable
                aria-label="Share content"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area with Split Layout */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" onLayout={handlePanelResize}>
            <Panel defaultSize={leftPanelSize} minSize={45}>
              <div className="h-full overflow-y-auto p-6">
                <div className="max-w-none">
                  {/* Executive Summary */}
                  {item.content.summary150 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Executive Summary</h3>
                      <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
                        <p>{item.content.summary150}</p>
                      </div>
                    </div>
                  )}

                  {/* Key Facts */}
                  {item.content.keyPoints && item.content.keyPoints.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Key Facts</h3>
                      <ul className="list-disc list-inside text-slate-700 space-y-1">
                        {item.content.keyPoints.map((point: string, index: number) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Notable Quotes */}
                  {item.content.notableQuote && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Notable Quotes</h3>
                      <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-700 bg-blue-50 py-3 rounded-r-lg">
                        "{item.content.notableQuote}"
                      </blockquote>
                    </div>
                  )}

                  {/* Source Facts */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Source Facts</h3>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                        Source: <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{item.meta?.sourceDomain}</a>
                      </p>
                      {linkStatus && (
                        <p className="flex items-center gap-2">
                          {linkStatus.verified ? (
                            <span className="text-green-500">✅</span>
                          ) : (
                            <span className="text-red-500">❌</span>
                          )}
                          Status: {linkStatus.verified ? 'Verified' : `Unavailable (HTTP ${linkStatus.status})`}
                          {linkStatus.checkedAt && ` (Last checked: ${new Date(linkStatus.checkedAt).toLocaleDateString()})`}
                        </p>
                      )}
                      {linkStatus && !linkStatus.verified && linkStatus.archivedUrl && (
                        <Button 
                          onClick={() => setShowArchivePrompt(true)} 
                          variant="ghost" 
                          className="p-0 h-auto text-blue-600 hover:text-blue-700"
                        >
                          View Archived Version
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="w-2 bg-slate-100 hover:bg-slate-200 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-1 h-8 bg-slate-300 rounded-full" />
            </PanelResizeHandle>
            <Panel defaultSize={rightPanelSize} minSize={25}>
              <div className="h-full overflow-y-auto p-6 border-l border-slate-200 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
                {/* Comment Composer */}
                <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                  <textarea 
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Add a comment..."
                  ></textarea>
                  <Button className="mt-2 w-full">Post Comment</Button>
                </div>
                {/* Existing Comments */}
                <div className="space-y-4">
                  <p className="text-slate-500 text-sm">No comments yet. Be the first to discuss!</p>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Bottom Accent Strip */}
        <div 
          className="h-[6px] rounded-b-2xl" 
          style={{ backgroundColor: dominantColor }}
        />

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
                  onClick={() => setShowArchivePrompt(false)} 
                  variant="outline"
                  data-focusable
                  aria-label="Cancel"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
