'use client'

import React, { useState, useMemo, memo } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Bookmark, Link2, MessageCircle, Calendar, Clock, Globe } from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'
import { pickHero } from '@/lib/media/hero'
import { MediaAssets } from '@/lib/media/hero-types'
import GeneratedCover from './GeneratedCover'

// Placeholder for when no hero image is available
const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo='

interface DiscoveryCardProps {
  item: DiscoveredItem
  onAttach?: (mode: 'timeline' | 'fact' | 'source') => void
  onDiscuss?: () => void
  onSave?: () => void
}

function labelFor(type: string): string {
  const labels: Record<string, string> = {
    article: 'Article',
    video: 'Video',
    pdf: 'PDF',
    image: 'Image',
    text: 'Text'
  }
  return labels[type] || 'Content'
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: 'Queued',
    fetching: 'Fetching',
    enriching: 'Enriching',
    pending_audit: 'Pending Review',
    ready: 'Ready',
    failed: 'Failed'
  }
  return labels[status] || status
}

function formatDate(dateString?: string): string | null {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  } catch {
    return null
  }
}

function DiscoveryCard({ item, onAttach, onDiscuss, onSave }: DiscoveryCardProps) {
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  
  // Extract hero data from server-processed mediaAssets
  const mediaAssets = item.media?.mediaAssets as MediaAssets | undefined
  const heroSrc = mediaAssets?.hero
  const blurDataURL = mediaAssets?.blurDataURL
  const dominant = mediaAssets?.dominant
  const source = mediaAssets?.source

  return (
    <div className="rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Hero Section - Fixed aspect to prevent layout shift */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[#F3F4F6]">
        {/* Always render img element to prevent remounting */}
        {heroSrc ? (
          <img
            src={heroSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
            style={{
              backgroundImage: blurDataURL ? `url(${blurDataURL})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        ) : (
          /* Generated cover when no hero image available */
          <GeneratedCover 
            domain={item.meta.sourceDomain} 
            type={item.type} 
            dominant={dominant} 
          />
        )}
        
        {/* Bottom scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
        
        {/* Type badge - top left */}
        <span className="absolute left-3 top-3 text-[12px] rounded-full bg-black/55 text-white px-2.5 py-1">
          {labelFor(item.type)}
        </span>
        
        {/* Match percentage - top right */}
        {item.matchPct != null && (
          <span className="absolute right-3 top-3 text-[12px] rounded-full bg-white/90 text-slate-900 px-2.5 py-1">
            Match: {Math.round(item.matchPct * 100)}%
          </span>
        )}
        
        {/* Status badge - bottom left */}
        {item.status !== 'ready' && (
          <span className="absolute left-3 bottom-3 text-[12px] rounded bg-white/85 text-slate-800 px-2 py-0.5">
            {statusLabel(item.status)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base md:text-lg font-semibold leading-6 mt-3 line-clamp-2 text-gray-900">
        {item.title}
      </h3>

      {/* Summary */}
      {item.content.summary150 && (
        <p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
          {item.content.summary150}
        </p>
      )}

      {/* Key Points - first 3 only */}
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

      {/* Meta Row */}
      <div className="mt-3 text-sm text-slate-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Domain with favicon */}
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate max-w-[120px]">{item.meta.sourceDomain}</span>
          </div>
          
          {/* Publish date */}
          {item.meta.publishDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>{formatDate(item.meta.publishDate)}</span>
            </div>
          )}
          
          {/* Reading time */}
          {item.content.readingTimeMin && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>{item.content.readingTimeMin} min</span>
            </div>
          )}
        </div>
        
        {/* Bookmark button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          onClick={onSave}
        >
          <Bookmark className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Actions Row */}
      <div className="mt-4 flex items-center gap-2">
        {/* Open */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          onClick={() => item.url && window.open(item.url, '_blank')}
          disabled={!item.url || item.status !== 'ready'}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Open
        </Button>

        {/* Attach → with menu */}
        <div className="relative">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-3 text-xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={item.status !== 'ready'}
          >
            <Link2 className="h-3.5 w-3.5 mr-1" />
            Attach →
          </Button>
          
          {showAttachMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#E6E8EC] rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onAttach?.('timeline')
                  setShowAttachMenu(false)
                }}
              >
                Timeline
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onAttach?.('fact')
                  setShowAttachMenu(false)
                }}
              >
                Fact
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 transition-colors"
                onClick={() => {
                  onAttach?.('source')
                  setShowAttachMenu(false)
                }}
              >
                Source
              </button>
            </div>
          )}
        </div>

        {/* Discuss */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          onClick={onDiscuss}
          disabled={item.status !== 'ready'}
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1" />
          Discuss
        </Button>
      </div>

      {/* Error State */}
      {item.status === 'failed' && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load content. 
          <button className="ml-2 underline hover:no-underline">Retry</button>
        </div>
      )}
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(DiscoveryCard)

