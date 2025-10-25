'use client'

import React, { useMemo, useState } from 'react'
import { Clock, ExternalLink, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import { DiscoveredItem } from '@/types/discovered-content'
import GeneratedCover from './GeneratedCover'
import { useRouter } from 'next/navigation'

interface DiscoveryCardProps {
  item: DiscoveredItem
  onHeroClick?: (item: DiscoveredItem) => void
  patchHandle?: string
  className?: string
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

export default function DiscoveryCard({ item, onHeroClick, patchHandle, className = "" }: DiscoveryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const router = useRouter()
  const hero = useMemo(() => pickHero(item), [item.id, item.media])
  const dominantColor = useMemo(() => getDominantColor(item), [item.media?.dominant])
  
  // Handle card click - navigate to content URL
  const handleCardClick = () => {
    const contentUrl = item.metadata?.contentUrl;
    const urlSlug = item.metadata?.urlSlug;
    
    console.log('[DiscoveryCard] Clicked item:', {
      id: item.id,
      title: item.title,
      metadata: item.metadata,
      contentUrl,
      urlSlug,
      patchHandle
    });
    
    if (contentUrl && urlSlug && patchHandle) {
      // Navigate to the content URL
      console.log('[DiscoveryCard] Navigating to:', `/patch/${patchHandle}/content/${urlSlug}`);
      router.push(`/patch/${patchHandle}/content/${urlSlug}`)
    } else if (onHeroClick) {
      // Fallback to modal
      console.log('[DiscoveryCard] Using fallback modal');
      onHeroClick(item)
    }
  }
  
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
      className={`rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0A5AFF] focus:ring-offset-2 ${className}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.displayTitle || item.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Hero Section */}
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-xl w-full block"
        style={{ backgroundColor: dominantColor }}
      >
        {/* Relevance Badge Overlay */}
        {item.metadata?.relevanceScore !== undefined && item.metadata.relevanceScore >= 0.7 && (
          <div className="absolute top-2 right-2 z-10">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              item.metadata.relevanceScore >= 0.9 
                ? 'bg-green-500 text-white' 
                : item.metadata.relevanceScore >= 0.8 
                ? 'bg-blue-500 text-white' 
                : 'bg-slate-600 text-white'
            }`}>
              {Math.round(item.metadata.relevanceScore * 100)}%
            </div>
          </div>
        )}
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
      
      {/* Action Bar - Only 2 buttons as requested */}
      <div 
        className="mt-3 pt-3 border-t border-[#E6E8EC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-2">
          <Button 
            onClick={(e) => {
              e.stopPropagation()
              window.open(item.url, '_blank')
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Source
          </Button>
          <Button 
            onClick={(e) => {
              e.stopPropagation()
              if (navigator.share) {
                navigator.share({
                  title: item.title,
                  text: item.content.summary150,
                  url: item.url,
                }).catch(console.error)
              } else {
                navigator.clipboard.writeText(item.url)
                  .then(() => alert('Link copied to clipboard!'))
                  .catch(console.error)
              }
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>
    </div>
  )
}