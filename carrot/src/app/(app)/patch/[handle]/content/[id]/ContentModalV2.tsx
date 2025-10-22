'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Share2, Clock, Calendar, AlertTriangle, X } from 'lucide-react'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import { DiscoveredItem } from '@/types/discovered-content'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface ContentModalV2Props {
  contentId: string
  isOpen: boolean
  onClose: () => void
}

export default function ContentModalV2({ contentId, isOpen, onClose }: ContentModalV2Props) {
  const [content, setContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
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
      const savedSizes = localStorage.getItem('modalSplit:v1')
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
      setLeftPanelSize(left)
      setRightPanelSize(right)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('modalSplit:v1', JSON.stringify({ left, right }))
      }
    }
  }

  // Load content data
  useEffect(() => {
    if (isOpen && contentId) {
      setIsLoading(true)
      fetch(`/api/internal/content/${contentId}/preview`)
        .then(res => res.json())
        .then(data => {
          setContent(data)
          setIsLoading(false)
        })
        .catch(err => {
          console.error('Failed to load content:', err)
          setIsLoading(false)
        })
    }
  }, [isOpen, contentId])

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent(null)
      setIsLoading(true)
      setLinkStatus(null)
      setShowArchivePrompt(false)
    }
  }, [isOpen])

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

  if (!isOpen) return null

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
      } else {
        if (result.archivedUrl) {
          setShowArchivePrompt(true)
        } else {
          console.warn('Link verification failed:', result.status)
        }
      }
    } catch (error) {
      console.error('Link verification error:', error)
      window.open(url, '_blank', 'noopener')
    }
  }

  const handleShare = async () => {
    if (!content) return

    const shareData = {
      title: content.title,
      text: content.summary,
      url: content.meta?.canonicalUrl || content.meta?.url
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        console.log('Share cancelled or failed')
      }
    } else {
      navigator.clipboard.writeText(shareData.url)
    }
  }

  const handleOpenArchive = () => {
    if (linkStatus?.archivedUrl) {
      window.open(linkStatus.archivedUrl, '_blank', 'noopener')
      setShowArchivePrompt(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1400px] w-[92vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Content Modal</DialogTitle>
        <DialogDescription className="sr-only">
          View and interact with content from the discovery feed
        </DialogDescription>
        {/* Header Strip - Taller and more prominent */}
        <div className="relative h-24 md:h-28 bg-gradient-to-r from-slate-900 to-slate-700 text-white">
          {/* Hero Background */}
          {content?.hero && (
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ 
                backgroundImage: `url(${content.hero})`,
                filter: 'brightness(0.4)'
              }}
            />
          )}
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/0" />
          
          {/* Content */}
          <div className="relative z-10 flex items-center justify-between h-full px-6">
            {/* Left: Title & Meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-semibold leading-tight line-clamp-1 mb-2">
                {content?.title || 'Loading...'}
              </h1>
              
              {/* Meta Row */}
              <div className="flex items-center gap-3 text-sm text-white/80">
                {content?.meta && (
                  <>
                    {/* Domain with favicon */}
                    <div className="flex items-center gap-2">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${content.meta.domain}&sz=16`}
                        alt=""
                        className="w-4 h-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <span>{content.meta.domain}</span>
                    </div>
                    
                    {/* Separator */}
                    <span>·</span>
                    
                    {/* Author */}
                    {content.meta.author && (
                      <>
                        <span>{content.meta.author}</span>
                        <span>·</span>
                      </>
                    )}
                    
                    {/* Date */}
                    {content.meta.publishDate && (
                      <>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(content.meta.publishDate)}</span>
                        </div>
                        <span>·</span>
                      </>
                    )}
                    
                    {/* Reading Time */}
                    {content.meta.readTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{content.meta.readTime} min read</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Action Buttons - Equal width and properly styled */}
            <div className="flex items-center gap-3 bg-black/70 backdrop-blur rounded-xl px-4 py-2">
              <Button
                onClick={() => content?.meta?.url && verifyAndOpenLink(content.meta.url)}
                className="w-40 justify-start bg-transparent hover:bg-white/20 text-white border-white/30"
                data-focusable
                aria-label="View original source"
                disabled={!content?.meta?.url}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </Button>
              
              <Button
                onClick={handleShare}
                className="w-40 justify-start bg-transparent hover:bg-white/20 text-white border-white/30"
                data-focusable
                aria-label="Share content"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Body: Split Layout with Resizable Divider */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup
            direction="horizontal"
            onLayout={handlePanelResize}
            className="h-full"
          >
            {/* Left Panel - Content */}
            <Panel defaultSize={leftPanelSize} minSize={45} className="flex flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="space-y-6 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
                      ))}
                    </div>
                  </div>
                ) : content ? (
                  <div className="space-y-6">
                    {/* Link Status Warning */}
                    {linkStatus && !linkStatus.verified && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">
                          Source may be unavailable. Last checked {linkStatus.checkedAt ? new Date(linkStatus.checkedAt).toLocaleString() : 'recently'}.
                        </span>
                      </div>
                    )}

                    {/* Executive Summary */}
                    <section>
                      <h2 className="text-lg font-semibold text-slate-900 mb-3">Executive Summary</h2>
                      <p className="text-slate-700 leading-relaxed">
                        {content.summary}
                      </p>
                    </section>

                    {/* Key Facts */}
                    {content.keyFacts && content.keyFacts.length > 0 && (
                      <section>
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Key Facts</h2>
                        <div className="space-y-2">
                          {content.keyFacts.map((fact: string, index: number) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-slate-700">{fact}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Context & Significance */}
                    {content.context && (
                      <section>
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Context & Significance</h2>
                        <p className="text-slate-700 leading-relaxed">
                          {content.context}
                        </p>
                      </section>
                    )}

                    {/* Related Entities */}
                    {content.entities && content.entities.length > 0 && (
                      <section>
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Related Entities</h2>
                        <div className="flex flex-wrap gap-2">
                          {content.entities.map((entity: string, index: number) => (
                            <Badge 
                              key={index}
                              variant="secondary"
                              className="text-sm bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 cursor-pointer"
                            >
                              {entity}
                            </Badge>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Clean Excerpt */}
                    {content.excerpt && (
                      <section>
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Excerpt</h2>
                        <div className="prose prose-slate max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: content.excerpt }} />
                        </div>
                        {content.meta?.url && (
                          <div className="mt-4">
                            <Button
                              onClick={() => verifyAndOpenLink(content.meta.url)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              Read on {content.meta.domain}
                            </Button>
                          </div>
                        )}
                      </section>
                    )}

                    {/* Citations */}
                    <section className="pt-4 border-t border-slate-200">
                      <div className="text-sm text-slate-600">
                        <p>
                          <strong>Source:</strong> {content.meta?.domain} 
                          {content.meta?.canonicalUrl && (
                            <span> • <a 
                              href={content.meta.canonicalUrl} 
                              target="_blank" 
                              rel="noopener"
                              className="text-blue-600 hover:underline"
                            >
                              {content.meta.canonicalUrl}
                            </a></span>
                          )}
                        </p>
                        {content.extractedAt && (
                          <p className="mt-1">
                            <strong>Extracted:</strong> {new Date(content.extractedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-600">Failed to load content</p>
                  </div>
                )}
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-2 bg-slate-200 hover:bg-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-col-resize" />

            {/* Right Panel - Comments */}
            <Panel defaultSize={rightPanelSize} minSize={25} className="flex flex-col">
              <div className="flex-1 overflow-y-auto bg-slate-50 border-l border-slate-200">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
                  
                  {/* Comment Editor - Sticky at top */}
                  <div className="sticky top-0 bg-slate-50 pb-4 mb-4 border-b border-slate-200">
                    <textarea
                      placeholder="Add a comment..."
                      className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      data-focusable
                      aria-label="Add a comment"
                    />
                    <div className="flex justify-end mt-2">
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-focusable
                        aria-label="Post comment"
                      >
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
            </Panel>
          </PanelGroup>
        </div>

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
      </DialogContent>
    </Dialog>
  )
}