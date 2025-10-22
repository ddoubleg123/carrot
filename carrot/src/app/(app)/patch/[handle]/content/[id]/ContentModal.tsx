'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/content/Modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ExternalLink, 
  Copy, 
  Calendar, 
  Clock, 
  User, 
  Globe, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Link2,
  Share2,
  Heart,
  Bookmark
} from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'

interface ContentPreview {
  title: string
  meta: {
    sourceDomain: string
    author?: string
    publishDate?: string
    readingTime?: number
    favicon?: string
  }
  hero?: string
  summary: string
  keyPoints: string[]
  excerptHtml: string
  timeline: Array<{date: string, content: string}>
  entities: Array<{type: string, name: string, context?: string}>
  source: {
    domain: string
    favicon: string
    canonicalUrl: string
    author?: string
    publishDate?: string
    readingTime?: number
    lastVerified?: string
  }
  actions: {
    openOriginal: string
    copyLink: string
  }
}

interface ContentModalProps {
  item: DiscoveredItem
  isOpen: boolean
  onClose: () => void
}

// Skeleton components
function TitleSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg mb-4"></div>
      <div className="h-6 bg-gray-200 rounded-lg w-3/4"></div>
    </div>
  )
}

function MetaSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 mb-6">
      <div className="h-4 w-4 bg-gray-200 rounded"></div>
      <div className="h-4 w-24 bg-gray-200 rounded"></div>
      <div className="h-4 w-16 bg-gray-200 rounded"></div>
      <div className="h-4 w-20 bg-gray-200 rounded"></div>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      <div className="h-4 bg-gray-200 rounded w-4/5"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    </div>
  )
}

function KeyPointsSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
      ))}
    </div>
  )
}

export default function ContentModal({ item, isOpen, onClose }: ContentModalProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<ContentPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFullExcerpt, setShowFullExcerpt] = useState(false)
  const [linkStatus, setLinkStatus] = useState<{
    verified: boolean
    status: number
    finalUrl: string
    archivedUrl?: string
    checkedAt?: string
  } | null>(null)
  const [showArchivePrompt, setShowArchivePrompt] = useState(false)
  const commentEditorRef = useRef<HTMLTextAreaElement>(null)

  // Fetch preview data
  useEffect(() => {
    if (!isOpen || !item.id) return

    const fetchPreview = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/internal/content/${item.id}/preview`)
        if (!response.ok) {
          throw new Error('Failed to fetch preview')
        }
        
        const data = await response.json()
        setPreview(data)
      } catch (err) {
        console.error('Error fetching preview:', err)
        setError('Failed to load content preview')
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [isOpen, item.id])

  // Handle Open Original with verification
  const handleOpenOriginal = async () => {
    if (!preview) return

    try {
      const response = await fetch(`/api/internal/links/verify?url=${encodeURIComponent(preview.actions.openOriginal)}`)
      const result = await response.json()
      
      setLinkStatus({
        verified: result.ok,
        status: result.status,
        finalUrl: result.finalUrl,
        archivedUrl: result.archivedUrl,
        checkedAt: result.checkedAt
      })
      
      if (result.ok) {
        window.open(result.finalUrl || preview.actions.openOriginal, '_blank', 'noopener')
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
      window.open(preview.actions.openOriginal, '_blank', 'noopener')
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
      await navigator.clipboard.writeText(preview.actions.copyLink)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleDiscuss = () => {
    // Focus comment editor
    commentEditorRef.current?.focus()
    commentEditorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleShare = async () => {
    if (!preview) return

    const shareData = {
      title: preview.title,
      text: preview.summary,
      url: preview.actions.openOriginal
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareData.url)
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

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="h-3 w-3" />
      case 'team': return <Globe className="h-3 w-3" />
      case 'organization': return <Globe className="h-3 w-3" />
      default: return <Globe className="h-3 w-3" />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={preview?.title || item.title}>
      <div className="flex flex-col lg:flex-row h-full">
        {/* Left Column - Content */}
        <div className="flex-1 lg:basis-2/3 lg:min-w-[640px] overflow-y-auto p-6 md:p-8">
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white/85 backdrop-blur z-10 border-b pb-4 mb-6">
            {loading ? (
              <>
                <TitleSkeleton />
                <MetaSkeleton />
              </>
            ) : preview ? (
              <>
                <h1 className="text-2xl md:text-3xl font-semibold leading-tight text-slate-900 mb-4">
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
                    <span>{preview.meta.sourceDomain}</span>
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
                  
                  {preview.meta.readingTime && (
                    <>
                      <span>·</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{preview.meta.readingTime} min read</span>
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
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600">Failed to load content preview</p>
              </div>
            )}
          </div>

          {/* Content Blocks */}
          {loading ? (
            <div className="space-y-6">
              <ContentSkeleton />
              <KeyPointsSkeleton />
            </div>
          ) : preview ? (
            <div className="space-y-6">
              {/* Compact Hero */}
              {preview.hero && (
                <div className="aspect-[21/9] h-40 md:h-56 rounded-xl overflow-hidden mb-4 relative">
                  <img 
                    src={preview.hero} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Action Bar Overlay - Only 2 buttons as requested */}
                  <div className="absolute left-4 bottom-4 z-20">
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleOpenOriginal}
                        className="bg-black/70 hover:bg-black/80 text-white backdrop-blur"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Source
                      </Button>
                      <Button 
                        onClick={handleShare}
                        className="bg-black/70 hover:bg-black/80 text-white backdrop-blur"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {preview.summary && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Executive Summary
                  </h2>
                  <p className="text-lg text-slate-700 leading-relaxed">
                    {preview.summary}
                  </p>
                </div>
              )}

              {/* Key Points */}
              {preview.keyPoints.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Key Points
                  </h2>
                  <ul className="space-y-2">
                    {preview.keyPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-600 font-medium mt-1">•</span>
                        <span className="text-slate-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Excerpt / Preview */}
              {preview.excerptHtml && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Article Preview
                  </h2>
                  <div 
                    className="prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: showFullExcerpt ? preview.excerptHtml : preview.excerptHtml.substring(0, 1000) + '...'
                    }}
                  />
                  {preview.excerptHtml.length > 1000 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFullExcerpt(!showFullExcerpt)}
                      className="mt-2"
                    >
                      {showFullExcerpt ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Show More
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Timeline */}
              {preview.timeline.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Timeline
                  </h2>
                  <div className="space-y-2">
                    {preview.timeline.map((item, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-600 min-w-[80px]">
                          {item.date}
                        </div>
                        <div className="text-sm text-slate-700">
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities */}
              {preview.entities.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                    People & Organizations
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {preview.entities.map((entity, index) => (
                      <Badge 
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1 text-sm"
                      >
                        {getEntityIcon(entity.type)}
                        {entity.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Facts */}
              <div>
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Source Information
                </h2>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-700">
                      <strong>Domain:</strong> {preview.source.domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-700">
                      <strong>URL:</strong> {preview.source.canonicalUrl}
                    </span>
                  </div>
                  {preview.source.lastVerified && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">
                        <strong>Last verified:</strong> {new Date(preview.source.lastVerified).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary Actions */}
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleOpenOriginal}
                  className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Original
                </Button>
                
                <Button variant="outline" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>

              {/* Inline Action Bar - Only 2 buttons as requested */}
              <div className="pt-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={handleOpenOriginal}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Source
                  </Button>
                  <Button 
                    onClick={handleShare}
                    variant="outline"
                    className="flex-1"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">We couldn't generate a preview. You can still open the source.</p>
              <Button onClick={handleOpenOriginal} className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Original
              </Button>
            </div>
          )}
        </div>

        {/* Right Column - Comments */}
        <div className="lg:basis-1/3 border-l border-slate-200 bg-slate-50 overflow-y-auto p-6 md:p-7">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
          
          {/* Comment Editor */}
          <div className="mb-6">
            <textarea
              ref={commentEditorRef}
              placeholder="Add a comment..."
              className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
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
              <Button onClick={handleOpenArchive} className="bg-blue-600 hover:bg-blue-700 text-white">
                Open Archive
              </Button>
              <Button variant="outline" onClick={() => setShowArchivePrompt(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
