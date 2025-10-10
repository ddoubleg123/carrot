'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ExternalLink, 
  Bookmark, 
  Link2, 
  MoreHorizontal,
  Clock,
  Globe,
  Calendar,
  Play,
  FileText,
  Image as ImageIcon,
  MessageCircle
} from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'
import { GeneratedCover } from './GeneratedCover'

interface DiscoveryCardProps {
  item: DiscoveredItem
}

export function DiscoveryCard({ item }: DiscoveryCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getTypeIcon = () => {
    switch (item.type) {
      case 'video': return <Play size={16} />
      case 'pdf': return <FileText size={16} />
      case 'article': return <FileText size={16} />
      case 'image': return <ImageIcon size={16} />
      case 'text': return <FileText size={16} />
      default: return <FileText size={16} />
    }
  }

  const getTypeLabel = () => {
    switch (item.type) {
      case 'video': return 'Video'
      case 'pdf': return 'PDF'
      case 'article': return 'Article'
      case 'image': return 'Image'
      case 'text': return 'Text'
      default: return 'Content'
    }
  }

  const getStatusColor = () => {
    switch (item.status) {
      case 'ready': return 'bg-green-100 text-green-800'
      case 'enriching': return 'bg-blue-100 text-blue-800'
      case 'fetching': return 'bg-yellow-100 text-yellow-800'
      case 'queued': return 'bg-gray-100 text-gray-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending_audit': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString?: string) => {
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

  const formatReadingTime = (minutes?: number) => {
    if (!minutes) return null
    if (minutes < 1) return '< 1 min'
    if (minutes === 1) return '1 min'
    return `${Math.round(minutes)} min`
  }

  // Get hero image with fallback to generated cover
  const getHeroImage = () => {
    if (item.media.hero) return item.media.hero
    if (item.media.videoThumb) return item.media.videoThumb
    if (item.media.pdfPreview) return item.media.pdfPreview
    if (item.media.gallery?.[0]) return item.media.gallery[0]
    return null // Will render GeneratedCover
  }

  const heroImage = getHeroImage()

  return (
    <Card 
      className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6 transition-shadow hover:shadow-md focus-within:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hero Section */}
      <div className="aspect-[16/9] overflow-hidden rounded-xl relative mb-4">
        {heroImage ? (
          <img
            src={heroImage}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <GeneratedCover
            title={item.title}
            domain={item.meta.sourceDomain}
            type={item.type}
            dominant={item.media.dominant}
          />
        )}
        
        {/* Subtle bottom scrim for text overlay safety */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
        
        {/* Type Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/90 text-gray-900 border-0 flex items-center gap-1.5 text-xs">
            {getTypeIcon()}
            {getTypeLabel()}
          </Badge>
        </div>

        {/* Match Percentage - Top Right */}
        {item.matchPct && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-white/90 text-gray-900 border-0 text-xs">
              Match: {Math.round(item.matchPct * 100)}%
            </Badge>
          </div>
        )}

        {/* Status Overlay - Bottom Left */}
        {item.status !== 'ready' && (
          <div className="absolute bottom-3 left-3">
            <Badge className={`${getStatusColor()} border-0 text-xs`}>
              {item.status === 'pending_audit' ? 'Pending Review' : item.status.replace('_', ' ')}
            </Badge>
          </div>
        )}

        {/* Progress Bar for Processing */}
        {item.status === 'enriching' && (
          <div className="absolute bottom-0 left-0 right-0">
            <div className="w-full bg-gray-200 h-1">
              <div className="bg-blue-500 h-1 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-0">
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

        {/* Key Points */}
        {item.content.keyPoints && item.content.keyPoints.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.content.keyPoints.slice(0, 3).map((point, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-sm rounded-full border px-2.5 py-1 border-[#E6E8EC] bg-[#FAFAFB] text-gray-700"
              >
                {point}
              </Badge>
            ))}
          </div>
        )}

        {/* Notable Quote */}
        {item.content.notableQuote && (
          <blockquote className="text-slate-600 mt-2 line-clamp-2 text-sm italic">
            "{item.content.notableQuote}"
          </blockquote>
        )}

        {/* Meta Row */}
        <div className="text-sm text-slate-600 mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Globe size={12} />
              <span className="truncate max-w-[100px]">{item.meta.sourceDomain}</span>
            </div>
            {item.meta.publishDate && (
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                <span>{formatDate(item.meta.publishDate)}</span>
              </div>
            )}
            {item.content.readingTimeMin && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>{formatReadingTime(item.content.readingTimeMin)}</span>
              </div>
            )}
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <Bookmark size={12} />
          </Button>
        </div>

        {/* Actions Row */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
            onClick={() => item.url && window.open(item.url, '_blank')}
            disabled={!item.url || item.status !== 'ready'}
          >
            <ExternalLink size={12} className="mr-1" />
            Open
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-3 text-xs hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
            disabled={item.status !== 'ready'}
          >
            <Link2 size={12} className="mr-1" />
            Attach →
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
            disabled={item.status !== 'ready'}
          >
            <MessageCircle size={12} className="mr-1" />
            Discuss
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 ml-auto hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <MoreHorizontal size={12} />
          </Button>
        </div>

        {/* Error State */}
        {item.status === 'failed' && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-xs">
              <span>Failed to load content</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                Retry
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
