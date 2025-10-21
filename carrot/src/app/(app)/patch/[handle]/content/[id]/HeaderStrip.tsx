'use client'

import React from 'react'
import { ExternalLink, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentPreview } from '@/types/content-preview'

interface HeaderStripProps {
  content?: ContentPreview
  isLoading: boolean
  onClose: () => void
  dominantColor: string
}

export default function HeaderStrip({ content, isLoading, onClose, dominantColor }: HeaderStripProps) {
  const handleViewSource = () => {
    if (content?.source?.url) {
      window.open(content.source.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleShare = async () => {
    if (navigator.share && content?.title) {
      try {
        await navigator.share({
          title: content.title,
          text: content.summary,
          url: window.location.href
        })
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href)
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="relative h-20 bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl overflow-hidden">
      {/* Hero thumbnail background */}
      {content?.media?.hero && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ 
            backgroundImage: `url(${content.media.hero})`,
            filter: 'blur(1px)'
          }}
        />
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/50" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-between h-full px-6">
        {/* Left side - Title and meta */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-6 bg-slate-700 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-slate-600 rounded animate-pulse w-1/2" />
            </div>
          ) : content ? (
            <div className="space-y-1">
              <h1 className="text-lg md:text-2xl font-semibold text-white line-clamp-1">
                {content.title}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                {content.source?.domain && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-sm bg-slate-600 flex items-center justify-center text-xs">
                      {content.source.domain.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{content.source.domain}</span>
                  </div>
                )}
                {content.meta?.author && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span>{content.meta.author}</span>
                  </>
                )}
                {content.meta?.publishDate && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span>{new Date(content.meta.publishDate).toLocaleDateString()}</span>
                  </>
                )}
                {content.meta?.readingTime && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span>{content.meta.readingTime} min read</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-white">
              <h1 className="text-lg md:text-2xl font-semibold">Content not found</h1>
            </div>
          )}
        </div>
        
        {/* Right side - Action buttons */}
        <div className="flex items-center gap-3 ml-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleViewSource}
            disabled={!content?.source?.url}
            className="bg-black/70 backdrop-blur text-white hover:bg-black/80 border-0 w-32 justify-start"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Source
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="bg-black/70 backdrop-blur text-white hover:bg-black/80 border-0 w-32 justify-start"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10 border-0 p-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}