'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Link2, MessageSquare, Share2, Clock, Calendar, Bookmark } from 'lucide-react'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import GeneratedCover from '@/app/(app)/patch/[handle]/components/GeneratedCover'

// Types for different content sources
interface DiscoveredItem {
  id: string
  title: string
  url: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  content: {
    summary150: string
    keyPoints?: string[]
    notableQuote?: string
    readingTimeMin?: number
  }
  meta: {
    sourceDomain: string
    publishDate?: string
  }
  media?: {
    hero?: string
    dominant?: string
  }
  matchPct?: number
}

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
  
  // Reset states when item changes
  useEffect(() => {
    setImageLoaded(false)
    setIsLoading(false)
  }, [item?.id])

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

  const handleOpenOriginal = () => {
    if (isDiscovered) {
      window.open(item.url, '_blank')
    } else {
      // For posts, open the post permalink
      const permalink = `${window.location.origin}/post/${item.id}`
      window.open(permalink, '_blank')
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogDescription className="sr-only">
          {isDiscovered 
            ? `Content preview for ${item.title} from ${item.meta.sourceDomain}`
            : `Post by ${item.author.name}`
          }
        </DialogDescription>
        
        {/* Hero Section - Only show for discovered items with non-AI images */}
        {shouldShowHero && (
          <div 
            className="relative aspect-[16/9] w-full overflow-hidden"
            style={{ backgroundColor: dominantColor }}
          >
            <img 
              src={hero} 
              alt="" 
              className="w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
            />
            
            {/* Bottom gradient overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
            
            {/* Type badge (top left) */}
            <span className="absolute left-4 top-4 text-sm rounded-full bg-black/55 text-white px-3 py-1 font-medium">
              {TYPE_LABELS[item.type]}
            </span>
            
            {/* Match percentage (top right) */}
            {item.matchPct != null && (
              <span className="absolute right-4 top-4 text-sm rounded-full bg-white/90 text-slate-900 px-3 py-1 font-medium">
                Match: {Math.round(item.matchPct * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Content Section */}
        <div className="p-6">
          {/* Header */}
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold leading-tight text-slate-900">
              {isDiscovered ? item.title : `Post by ${item.author.name}`}
            </DialogTitle>
          </DialogHeader>

          {/* Meta Row */}
          <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
            {isDiscovered ? (
              <>
                {/* Domain */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-slate-200 flex items-center justify-center text-xs font-medium">
                    {item.meta.sourceDomain.charAt(0).toUpperCase()}
                  </div>
                  <span>{item.meta.sourceDomain}</span>
                </div>
                
                {/* Separator */}
                <span>·</span>
                
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

          {/* Content */}
          <div className="mb-6">
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
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-6" />

          {/* Actions */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              onClick={handleOpenOriginal}
              className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isDiscovered ? 'Open Original' : 'View Post'}
            </Button>
            
            <Button variant="outline">
              <Link2 className="h-4 w-4 mr-2" />
              Attach →
            </Button>
            
            <Button variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              Discuss
            </Button>
            
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Comments Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Comments</h3>
            <div className="bg-slate-50 rounded-lg p-4 text-center text-slate-600">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p>Comments will be available here</p>
              <p className="text-sm">This would integrate with your existing comment system</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
