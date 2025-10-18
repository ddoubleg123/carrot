'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Globe, Calendar, Clock } from 'lucide-react'
import PostActionBar from '@/components/post/PostActionBar'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryCardProps {
  item: DiscoveredItem
  onOpenModal?: (item: DiscoveredItem) => void
}

export default function DiscoveryCard({
  item,
  onOpenModal
}: DiscoveryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const {
    id,
    title,
    url,
    media,
    content,
    meta
  } = item
  
  const displayTitle = (item as any).displayTitle || title
  
  // Get hero image
  const getHeroImage = () => {
    if (media?.hero) return media.hero
    if (media?.videoThumb) return media.videoThumb
    if (media?.pdfPreview) return media.pdfPreview
    if (media?.gallery?.[0]) return media.gallery[0]
    
    // Fallback gradient
    return null
  }
  
  // Format date as "MMM d, yyyy"
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric', 
        year: 'numeric'
      })
    } catch {
      return null
    }
  }
  
  // Format reading time
  const formatReadingTime = (minutes: number) => {
    if (minutes < 1) return '< 1 min'
    return `${Math.round(minutes)} min read`
  }
  
  // Get favicon URL
  const getFaviconUrl = () => {
    if (!meta?.sourceDomain) return null
    return `https://www.google.com/s2/favicons?domain=${meta.sourceDomain}&sz=16`
  }
  
  const heroImage = getHeroImage()
  const publishDate = formatDate(meta?.publishDate)
  const readingTime = content?.readingTimeMin ? formatReadingTime(content.readingTimeMin) : null
  const faviconUrl = getFaviconUrl()
  
  const handleHeroClick = () => {
    if (onOpenModal) {
      onOpenModal(item)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleHeroClick()
    }
  }

  return (
    <Card className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Clickable Hero Image */}
      <button
        onClick={handleHeroClick}
        onKeyDown={handleKeyDown}
        className="w-full aspect-[16/9] overflow-hidden rounded-t-2xl relative bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#0A5AFF] focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="Open content preview"
        type="button"
      >
        {heroImage ? (
          <img
            src={heroImage}
            alt={displayTitle}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-4xl">📄</span>
          </div>
        )}
      </button>

      <CardContent className="p-5 md:p-6">
        {/* Title - specific, line-clamped */}
        <h3 className="text-base md:text-lg font-semibold leading-6 text-[#0B0B0F] mb-2 line-clamp-2">
          {displayTitle}
        </h3>

        {/* Summary - line-clamped */}
        {content?.summary150 && (
          <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-3">
            {content.summary150}
          </p>
        )}

        {/* Meta Row: favicon+domain · publish date · read time */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          {meta?.sourceDomain && (
            <div className="flex items-center gap-1.5">
              {faviconUrl && (
                <img src={faviconUrl} alt="" className="w-4 h-4" />
              )}
              {!faviconUrl && <Globe size={14} />}
              <span className="truncate max-w-[120px]">{meta.sourceDomain}</span>
            </div>
          )}
          
          {publishDate && (
            <>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>{publishDate}</span>
              </div>
            </>
          )}
          
          {readingTime && (
            <>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{readingTime}</span>
              </div>
            </>
          )}
        </div>

        {/* Post Action Bar */}
        <PostActionBar
          className="mt-3 pt-3 border-t border-gray-100"
          postId={id}
          stats={{
            likes: 0,
            comments: 0,
            reposts: 0
          }}
          permalink={url}
          onComment={() => {
            // TODO: Open comments
          }}
          onShareExternal={(shareUrl) => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(shareUrl)
            }
          }}
        />
      </CardContent>
    </Card>
  )
}

