'use client';

import React, { useState } from 'react';
import { ExternalLink, Clock, User, Calendar, MessageCircle, Bookmark, MoreHorizontal, Play, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Design tokens
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  slate: '#60646C',
  line: '#E6E8EC',
  surface: '#FFFFFF',
};

interface EnrichedContent {
  summary150?: string;
  keyPoints?: string[];
  notableQuote?: string;
  fullText?: string;
  transcript?: string;
}

interface MediaAssets {
  hero?: string;
  gallery?: string[];
  videoThumb?: string;
  pdfPreview?: string;
}

interface ContentMetadata {
  author?: string;
  publishDate?: string;
  source?: string;
  readingTime?: number;
  tags?: string[];
  entities?: string[];
  citation?: any;
}

interface DiscoveryCardProps {
  id: string;
  title: string;
  type: 'article' | 'video' | 'pdf' | 'post';
  sourceUrl?: string;
  canonicalUrl?: string;
  relevanceScore?: number;
  status: 'queued' | 'fetching' | 'enriching' | 'ready' | 'failed' | 'requires_review';
  enrichedContent?: EnrichedContent;
  mediaAssets?: MediaAssets;
  metadata?: ContentMetadata;
  qualityScore?: number;
  onAttach?: (type: 'timeline' | 'fact' | 'source') => void;
  onDiscuss?: () => void;
  onSave?: () => void;
}

export default function DiscoveryCard({
  id,
  title,
  type,
  sourceUrl,
  canonicalUrl,
  relevanceScore,
  status,
  enrichedContent,
  mediaAssets,
  metadata,
  qualityScore,
  onAttach,
  onDiscuss,
  onSave
}: DiscoveryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Generate fallback cover image
  const generateFallbackCover = (title: string, type: string) => {
    const colors = {
      article: COLORS.civicBlue,
      video: COLORS.actionOrange,
      pdf: '#8B5CF6',
      post: '#10B981'
    };
    
    const color = colors[type as keyof typeof colors] || COLORS.slate;
    const encodedTitle = encodeURIComponent(title.substring(0, 50));
    
    return `https://ui-avatars.com/api/?name=${encodedTitle}&background=${color.replace('#', '')}&color=fff&size=800&format=png&bold=true`;
  };

  // Get hero image
  const getHeroImage = () => {
    if (mediaAssets?.hero) return mediaAssets.hero;
    if (mediaAssets?.videoThumb) return mediaAssets.videoThumb;
    if (mediaAssets?.pdfPreview) return mediaAssets.pdfPreview;
    if (mediaAssets?.gallery?.[0]) return mediaAssets.gallery[0];
    return generateFallbackCover(title, type);
  };

  // Get type icon
  const getTypeIcon = () => {
    switch (type) {
      case 'video': return <Play size={16} />;
      case 'pdf': return <FileText size={16} />;
      case 'article': return <FileText size={16} />;
      default: return <ImageIcon size={16} />;
    }
  };

  // Get type label
  const getTypeLabel = () => {
    switch (type) {
      case 'video': return 'Video';
      case 'pdf': return 'PDF';
      case 'article': return 'Article';
      default: return 'Post';
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'enriching': return 'bg-blue-100 text-blue-800';
      case 'fetching': return 'bg-yellow-100 text-yellow-800';
      case 'queued': return 'bg-gray-100 text-gray-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'requires_review': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format reading time
  const formatReadingTime = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    return `${Math.round(minutes)} min`;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return null;
    }
  };

  return (
    <Card 
      className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hero Image */}
      <div className="aspect-[16/9] overflow-hidden rounded-t-2xl relative">
        <img
          src={getHeroImage()}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/90 text-gray-900 border-0 flex items-center gap-1.5">
            {getTypeIcon()}
            {getTypeLabel()}
          </Badge>
        </div>

        {/* Match Percentage */}
        {relevanceScore && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-white/90 text-gray-900 border-0">
              {relevanceScore}% match
            </Badge>
          </div>
        )}

        {/* Status Overlay for non-ready items */}
        {status !== 'ready' && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-white/90 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === 'enriching' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-5 md:p-6">
        {/* Title */}
        <h3 className="text-base md:text-lg font-semibold leading-6 text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Summary */}
        {enrichedContent?.summary150 && (
          <p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
            {enrichedContent.summary150}
          </p>
        )}

        {/* Key Points */}
        {enrichedContent?.keyPoints && enrichedContent.keyPoints.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {enrichedContent.keyPoints.slice(0, 3).map((point, index) => (
              <Badge key={index} variant="outline" className="text-xs rounded-full border-gray-200 text-gray-700">
                {point}
              </Badge>
            ))}
          </div>
        )}

        {/* Notable Quote */}
        {enrichedContent?.notableQuote && (
          <blockquote className="mt-3 text-sm italic text-gray-600 border-l-2 border-gray-200 pl-3">
            "{enrichedContent.notableQuote}"
          </blockquote>
        )}

        {/* Metadata Row */}
        <div className="mt-4 text-sm text-slate-600 flex items-center gap-3 flex-wrap">
          {metadata?.source && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gray-200 rounded-sm" />
              <span className="truncate max-w-[120px]">{metadata.source}</span>
            </div>
          )}
          {metadata?.author && (
            <div className="flex items-center gap-1.5">
              <User size={14} />
              <span className="truncate max-w-[100px]">{metadata.author}</span>
            </div>
          )}
          {metadata?.publishDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{formatDate(metadata.publishDate)}</span>
            </div>
          )}
          {metadata?.readingTime && (
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{formatReadingTime(metadata.readingTime)}</span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => sourceUrl && window.open(sourceUrl, '_blank')}
              disabled={!sourceUrl}
            >
              <ExternalLink size={14} className="mr-1.5" />
              Open
            </Button>

            {onAttach && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                    Attach →
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onAttach('timeline')}>
                    Timeline
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAttach('fact')}>
                    Fact
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAttach('source')}>
                    Source
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onDiscuss && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={onDiscuss}
              >
                <MessageCircle size={14} />
              </Button>
            )}
            {onSave && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={onSave}
              >
                <Bookmark size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar for Processing */}
        {status === 'enriching' && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
