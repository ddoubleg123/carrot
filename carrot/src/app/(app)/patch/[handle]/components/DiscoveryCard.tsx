'use client'

import React, { useMemo, useState } from 'react'
import { ExternalLink, Bookmark, MessageSquare, Link2, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pickHero, getDominantColor } from '@/lib/media/hero'
import { DiscoveredItem } from '@/types/discovered-content'
import GeneratedCover from './GeneratedCover'

interface DiscoveryCardProps {
  item: DiscoveredItem
}

const TYPE_LABELS = {
  article: 'Article',
  video: 'Video',
  pdf: 'PDF',
  image: 'Image',
  text: 'Text'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'queued': return 'Queued'
    case 'fetching': return 'Fetching'
    case 'enriching': return 'Enriching'
    case 'pending_audit': return 'Pending'
    case 'ready': return 'Ready'
    case 'failed': return 'Failed'
    default: return status
  }
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

export default function DiscoveryCard({ item }: DiscoveryCardProps) {
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
    <div className="rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Hero Section */}
      <div 
        className="relative aspect-[16/9] overflow-hidden rounded-xl"
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
        
        {/* Type badge (top left) */}
        <span className="absolute left-3 top-3 text-[12px] rounded-full bg-black/55 text-white px-2.5 py-1 font-medium">
          {TYPE_LABELS[item.type]}
        </span>
        
        {/* Match percentage (top right) */}
        {item.matchPct != null && (
          <span className="absolute right-3 top-3 text-[12px] rounded-full bg-white/90 text-slate-900 px-2.5 py-1 font-medium">
            Match: {Math.round(item.matchPct * 100)}%
          </span>
        )}
        
        {/* Status badge (bottom left) - only for non-ready status */}
        {item.status !== 'ready' && (
          <span className="absolute left-3 bottom-3 text-[12px] rounded bg-white/85 text-slate-800 px-2 py-0.5 font-medium">
            {statusLabel(item.status)}
          </span>
        )}
      </div>
      
      {/* Title */}
      <h3 className="text-base md:text-lg font-semibold leading-6 mt-3 line-clamp-2 text-slate-900">
        {item.title}
      </h3>
      
      {/* Summary */}
      <p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
        {item.content.summary150}
      </p>
      
      {/* Key Points */}
      {item.content.keyPoints && item.content.keyPoints.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.content.keyPoints.slice(0, 3).map((point, index) => (
            <span 
              key={index}
              className="text-sm rounded-full border border-[#E6E8EC] bg-[#FAFAFB] px-2.5 py-1 text-slate-700"
            >
              {point}
            </span>
          ))}
        </div>
      )}
      
      {/* Notable Quote */}
      {item.content.notableQuote && (
        <blockquote className="italic text-slate-600 mt-2 line-clamp-2 text-sm border-l-2 border-slate-200 pl-3">
          "{item.content.notableQuote}"
        </blockquote>
      )}
      
      {/* Meta Row */}
      <div className="mt-3 text-sm text-slate-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
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
        
        {/* Save Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        >
          <Bookmark className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="h-8 px-3 bg-[#FF6A00] hover:bg-[#E55A00] text-white focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          onClick={() => window.open(item.url, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1.5" />
          Open
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 px-3 border-[#E6E8EC] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
        >
          <Link2 className="h-3 w-3 mr-1.5" />
          Attach →
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 px-3 border-[#E6E8EC] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
        >
          <MessageSquare className="h-3 w-3 mr-1.5" />
          Discuss
        </Button>
      </div>
    </div>
  )
}