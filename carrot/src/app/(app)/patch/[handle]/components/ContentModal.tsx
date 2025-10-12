'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Link2, MessageSquare, Share2, Clock, Calendar, Bookmark } from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import GeneratedCover from './GeneratedCover'

interface ContentModalProps {
  item: DiscoveredItem | null
  isOpen: boolean
  onClose: () => void
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

export default function ContentModal({ item, isOpen, onClose }: ContentModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  
  // Reset image loaded state when item changes
  useEffect(() => {
    setImageLoaded(false)
  }, [item?.id])

  if (!item) return null

  const hero = pickHero(item)
  const dominantColor = getDominantColor(item)

  const handleOpenOriginal = () => {
    window.open(item.url, '_blank')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.content.summary150,
          url: item.url
        })
      } catch (error) {
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(item.url)
      // You could add a toast notification here
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogDescription className="sr-only">
          Content preview for {item.title} from {item.meta.sourceDomain}
        </DialogDescription>
        {/* Hero Section */}
        <div 
          className="relative aspect-[16/9] w-full overflow-hidden"
          style={{ backgroundColor: dominantColor }}
        >
          {hero ? (
            <img 
              src={hero} 
              alt="" 
              className="w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <GeneratedCover 
              domain={item.meta.sourceDomain} 
              type={item.type} 
              dominant={item.media?.dominant}
              className="w-full h-full"
            />
          )}
          
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

        {/* Content Section */}
        <div className="p-6">
          {/* Title */}
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold leading-tight text-slate-900">
              {item.title}
            </DialogTitle>
          </DialogHeader>

          {/* Meta Row */}
          <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
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
          </div>

          {/* Summary */}
          <div className="mb-6">
            <p className="text-lg text-slate-700 leading-relaxed">
              {item.content.summary150}
            </p>
          </div>

          {/* Key Points */}
          {item.content.keyPoints && item.content.keyPoints.length > 0 && (
            <div className="mb-6">
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
            <div className="mb-6">
              <blockquote className="border-l-4 border-[#FF6A00] pl-4 italic text-slate-700 bg-orange-50 py-3 rounded-r-lg">
                "{item.content.notableQuote}"
              </blockquote>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-200 my-6" />

          {/* Actions */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              onClick={handleOpenOriginal}
              className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Original
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

          {/* Comments Section Placeholder */}
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
