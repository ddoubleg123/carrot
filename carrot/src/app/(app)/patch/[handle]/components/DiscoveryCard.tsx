'use client'

import React, { useMemo, useState } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import { DiscoveredItem } from '@/types/discovered-content'
import GeneratedCover from './GeneratedCover'
import PostActionBar from '@/components/post/PostActionBar'

interface DiscoveryCardProps {
  item: DiscoveredItem
  onHeroClick?: (item: DiscoveredItem) => void
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

export default function DiscoveryCard({ item, onHeroClick }: DiscoveryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const hero = useMemo(() => pickHero(item), [item.id, item.media])
  const dominantColor = useMemo(() => getDominantColor(item), [item.media?.dominant])
  
  // Handle failed status with error micro
  if (item.status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-red-700">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-sm font-medium">Failed to load content</span>
        </div>
        <p className="mt-1 text-sm text-red-600">{item.title}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2 h-8 text-red-600 border-red-200 hover:bg-red-100"
          onClick={() => window.open(item.url, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    )
  }
  
  return (
    <div 
      className="rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0A5AFF] focus:ring-offset-2"
      onClick={() => onHeroClick?.(item)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.displayTitle || item.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onHeroClick?.(item);
        }
      }}
    >
      {/* Hero Section */}
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-xl w-full block"
        style={{ backgroundColor: dominantColor }}
      >
        {hero ? (
          <img 
            src={hero} 
            alt="" 
            loading="lazy" 
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <GeneratedCover 
            domain={item.meta.sourceDomain} 
            type={item.type} 
            dominant={item.media?.dominant}
            className="absolute inset-0"
          />
        )}
        
        {/* Bottom gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
      
      {/* Title */}
      <h3 className="text-base md:text-lg font-semibold leading-6 mt-3 line-clamp-2 text-slate-900">
        {item.displayTitle || item.title}
      </h3>
      
      {/* Summary */}
      <p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
        {item.content.summary150}
      </p>
      
      {/* Meta Row */}
      <div className="mt-3 text-sm text-slate-600 flex items-center gap-2 min-w-0">
        {/* Favicon + Domain */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-sm bg-slate-200 flex items-center justify-center text-xs">
            {item.meta.sourceDomain.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{item.meta.sourceDomain}</span>
        </div>
        
        {/* Separator */}
        <span className="text-slate-400">·</span>
        
        {/* Date */}
        {item.meta.publishDate && (
          <>
            <span>{formatDate(item.meta.publishDate)}</span>
            <span className="text-slate-400">·</span>
          </>
        )}
        
        {/* Reading Time */}
        {item.content.readingTimeMin && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{item.content.readingTimeMin} min</span>
          </div>
        )}
      </div>
      
      {/* PostActionBar */}
      <div 
        className="mt-3 pt-3 border-t border-[#E6E8EC]"
        onClick={(e) => e.stopPropagation()}
      >
        <PostActionBar
          postId={item.id}
          stats={{ likes: 0, comments: 0, reposts: 0, views: 0 }}
          canTranscribe={false}
          permalink={item.url}
          initiallySaved={false}
          initiallyLiked={false}
        />
      </div>
    </div>
  )
}