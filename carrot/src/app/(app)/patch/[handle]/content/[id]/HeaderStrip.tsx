'use client'

import React from 'react'
import { ExternalLink, Share2, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface HeaderStripProps {
  title: string
  heroUrl?: string
  meta: {
    domain: string
    favicon?: string
    author?: string
    publishDate?: string
    readTime?: number
  }
  linkStatus?: {
    verified: boolean
    status: number
    lastChecked?: string
  }
  onViewSource: () => void
  onShare: () => void
  accentColor?: string
}

export default function HeaderStrip({
  title,
  heroUrl,
  meta,
  linkStatus,
  onViewSource,
  onShare,
  accentColor = '#3b82f6'
}: HeaderStripProps) {
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

  const getTrustIndicator = () => {
    if (!linkStatus) return null
    
    if (linkStatus.verified && linkStatus.status < 400) {
      return (
        <div className="flex items-center gap-1 text-green-600" title="Source verified">
          <CheckCircle className="h-3 w-3" />
          <span className="text-xs">Verified</span>
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-1 text-amber-600" title="Source may be unavailable">
        <AlertTriangle className="h-3 w-3" />
        <span className="text-xs">Unverified</span>
      </div>
    )
  }

  return (
    <div 
      className="relative h-16 md:h-[72px] lg:h-24 flex items-center justify-between px-4 md:px-6 lg:px-8 overflow-hidden"
      style={{ backgroundColor: heroUrl ? 'transparent' : accentColor }}
    >
      {/* Background Hero Image with Gradient Overlay */}
      {heroUrl && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/0" />
        </>
      )}

      {/* Left: Title & Meta */}
      <div className="relative z-10 flex-1 min-w-0 mr-4">
        <h1 
          className="text-lg md:text-xl lg:text-2xl font-semibold text-white line-clamp-1 mb-1"
          title={title}
        >
          {title}
        </h1>
        
        <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-white/90 flex-wrap">
          {/* Domain with Favicon */}
          <div className="flex items-center gap-1.5">
            {meta.favicon && (
              <img 
                src={meta.favicon} 
                alt="" 
                className="w-3 h-3 md:w-4 md:h-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <span className="font-medium">{meta.domain}</span>
          </div>

          {/* Trust Indicator */}
          {getTrustIndicator()}

          {/* Author */}
          {meta.author && (
            <>
              <span className="text-white/50">·</span>
              <span>{meta.author}</span>
            </>
          )}

          {/* Publish Date */}
          {meta.publishDate && (
            <>
              <span className="text-white/50">·</span>
              <span>{formatDate(meta.publishDate)}</span>
            </>
          )}

          {/* Read Time */}
          {meta.readTime && (
            <>
              <span className="text-white/50">·</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{meta.readTime} min</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions (Equal Width, Left-Aligned within Container) */}
      <div className="relative z-10 flex items-center gap-2 bg-black/70 backdrop-blur rounded-xl px-3 py-2">
        <Button
          onClick={onViewSource}
          disabled={linkStatus && !linkStatus.verified}
          className="w-32 md:w-40 bg-[#FF6A00] hover:bg-[#E55A00] text-white justify-start text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          size="sm"
          aria-label="View original source"
        >
          <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">View Source</span>
        </Button>

        <Button
          onClick={onShare}
          variant="outline"
          className="w-32 md:w-40 bg-white/10 hover:bg-white/20 text-white border-white/20 justify-start text-sm"
          size="sm"
          aria-label="Share this content"
        >
          <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">Share</span>
        </Button>
      </div>
    </div>
  )
}
