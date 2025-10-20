'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Link2, MessageSquare, Share2, Clock, Calendar, Bookmark, AlertTriangle } from 'lucide-react'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import GeneratedCover from '@/app/(app)/patch/[handle]/components/GeneratedCover'
import { DiscoveredItem } from '@/types/discovered-content'
import ActionBar from '@/components/content/ActionBar'

interface PostItem {
  id: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  mediaUrl?: string
  mediaType?: 'video' | 'image'
  likes: number
  comments: number
  shares: number
  isLiked: boolean
  isBookmarked: boolean
  createdAt: string
}

type ContentItem = DiscoveredItem | PostItem

interface UnifiedContentModalProps {
  item: ContentItem | null
  isOpen: boolean
  onClose: () => void
  source: 'home' | 'group'
  videoElement?: HTMLVideoElement | null
}

const TYPE_LABELS = {
  article: 'Article',
  video: 'Video',
  pdf: 'PDF',
  image: 'Image',
  text: 'Text'
}

function formatDate(dateStr?: string): string {
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

function isDiscoveredItem(item: ContentItem): item is DiscoveredItem {
  return 'title' in item && 'url' in item && 'type' in item
}

function isPostItem(item: ContentItem): item is PostItem {
  return 'author' in item && 'content' in item && 'createdAt' in item
}

export default function UnifiedContentModal({ item, isOpen, onClose, source, videoElement }: UnifiedContentModalProps) {
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

  // Determine if this is a discovered item or post
  const isDiscovered = isDiscoveredItem(item)
  const isPost = isPostItem(item)

  // Get hero image for discovered items
  const hero = isDiscovered ? pickHero(item) : undefined
  const dominantColor = isDiscovered ? getDominantColor(item) : '#667eea'

  // Check if hero image is AI-generated (should be hidden)
  const isAIGenerated = isDiscovered && hero && (
    hero.startsWith('data:image/svg') || 
    hero.includes('ai-generated') ||
    hero.includes('deepseek') ||
    (item.media?.hero && item.media.hero.includes('ai-generated'))
  )

  // Show hero image only if it's not AI-generated
  const shouldShowHero = isDiscovered && hero && !isAIGenerated

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
          // Show inline warning
          console.warn('Link verification failed:', result.status)
        }
      }
    } catch (error) {
      console.error('Link verification error:', error)
      // Fallback to direct open
      window.open(url, '_blank', 'noopener')
    }
  }

  const handleOpenOriginal = () => {
    if (isDiscovered) {
      verifyAndOpenLink(item.url)
    } else {
      // For posts, open the post permalink
      const permalink = `${window.location.origin}/post/${item.id}`
      window.open(permalink, '_blank', 'noopener')
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
      title: isDiscovered ? item.title : `Post by ${item.author.name}`,
      text: isDiscovered ? item.content.summary150 : item.content,
      url: isDiscovered ? item.url : `${window.location.origin}/post/${item.id}`
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
      // You could add a toast notification here
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogDescription className="sr-only">
          {isDiscovered 
            ? `Content preview for ${item.title} from ${item.meta.sourceDomain}`
            : `Post by ${item.author.name}`
          }
        </DialogDescription>
        
        {/* Content-First Layout */}
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Pane - Content (2/3 width on desktop) */}
          <div className="flex-1 lg:w-2/3 overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl md:text-2xl font-semibold leading-tight text-slate-900">
                  {isDiscovered ? item.title : `Post by ${item.author.name}`}
                </DialogTitle>
              </DialogHeader>

              {/* Meta Row */}
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                {isDiscovered ? (
                  <>
                    {/* Domain with favicon */}
                    <div className="flex items-center gap-2">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${item.meta.sourceDomain}&sz=16`}
                        alt=""
                        className="w-4 h-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <span>{item.meta.sourceDomain}</span>
                    </div>
                    
                    {/* Separator */}
                    <span>·</span>
                    
                    {/* Author */}
                    {item.meta.author && (
                      <>
                        <span>{item.meta.author}</span>
                        <span>·</span>
                      </>
                    )}
                    
                    {/* Date */}
                    {item.meta.publishDate && (
                      <>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(item.meta.publishDate)}</span>
                        </div>
                        <span>·</span>
                      </>
                    )}
                    
                    {/* Reading Time */}
                    {item.content.readingTimeMin && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{item.content.readingTimeMin} min read</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Author */}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm bg-slate-200 flex items-center justify-center text-xs font-medium">
                        {item.author.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{item.author.name}</span>
                    </div>
                    
                    {/* Separator */}
                    <span>·</span>
                    
                    {/* Date */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.createdAt)}</span>
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
              {shouldShowHero && (
                <div 
                  className="aspect-[21/9] h-32 md:h-40 rounded-lg overflow-hidden mb-4 relative"
                  style={{ backgroundColor: dominantColor }}
                >
                  <img 
                    src={hero} 
                    alt="" 
                    className="w-full h-full object-cover transition-opacity duration-200"
                    style={{ opacity: imageLoaded ? 1 : 0 }}
                    onLoad={() => setImageLoaded(true)}
                  />
                  
                  {/* Action Bar Overlay */}
                  <div className="absolute left-4 bottom-4 z-20">
                    <ActionBar
                      variant="overlay"
                      onAttach={() => console.log('Attach clicked')}
                      onDiscuss={() => console.log('Discuss clicked')}
                      onShare={handleShare}
                    />
                  </div>
                </div>
              )}

              {/* Open Original Button */}
              <div className="mb-6">
                <Button 
                  onClick={handleOpenOriginal}
                  className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
                  data-focusable
                  aria-label={isDiscovered ? 'Open original article' : 'View post'}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isDiscovered ? 'Open Original' : 'View Post'}
                </Button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="px-6 pb-6">
              {isDiscovered ? (
                <>
                  {/* Summary */}
                  <p className="text-lg text-slate-700 leading-relaxed mb-4">
                    {item.content.summary150}
                  </p>

                  {/* Key Points */}
                  {item.content.keyPoints && item.content.keyPoints.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Key Points</h3>
                      <div className="flex flex-wrap gap-2">
                        {item.content.keyPoints.map((point, index) => (
                          <Badge 
                            key={index}
                            variant="secondary"
                            className="text-sm bg-slate-100 text-slate-700 border-slate-200"
                          >
                            {point}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notable Quote */}
                  {item.content.notableQuote && (
                    <blockquote className="border-l-4 border-[#FF6A00] pl-4 italic text-slate-700 bg-orange-50 py-3 rounded-r-lg">
                      "{item.content.notableQuote}"
                    </blockquote>
                  )}
                </>
              ) : (
                /* Post Content */
                <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {item.content}
                </p>
              )}

              {/* Inline Action Bar */}
              <div className="mt-6">
                <ActionBar
                  variant="inline"
                  onAttach={() => console.log('Attach clicked')}
                  onDiscuss={() => console.log('Discuss clicked')}
                  onShare={handleShare}
                />
              </div>
            </div>
          </div>

          {/* Right Pane - Comments (1/3 width on desktop) */}
          <div className="lg:w-1/3 border-l border-slate-200 bg-slate-50">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
              
              {/* Comment Editor - Always visible */}
              <div className="mb-4">
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
