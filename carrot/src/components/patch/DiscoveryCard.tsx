'use client';

import React, { useState } from 'react';
import { ExternalLink, Clock, User, Calendar, MessageCircle, Bookmark, Play, FileText, Image as ImageIcon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DiscoveredItem } from '@/types/discovered-content';

// Design tokens
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  slate: '#60646C',
  line: '#E6E8EC',
  surface: '#FFFFFF',
};

interface DiscoveryCardProps {
  item: DiscoveredItem;
  onAttach?: (type: 'timeline' | 'fact' | 'source') => void;
  onDiscuss?: () => void;
  onSave?: () => void;
}

export default function DiscoveryCard({
  item,
  onAttach,
  onDiscuss,
  onSave
}: DiscoveryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    id,
    title,
    type,
    url,
    matchPct,
    status,
    media,
    content,
    meta
  } = item;

  // Get hero image with fallback
  const getHeroImage = () => {
    if (media.hero) return media.hero;
    if (media.videoThumb) return media.videoThumb;
    if (media.pdfPreview) return media.pdfPreview;
    if (media.gallery?.[0]) return media.gallery[0];
    
    // Generate fallback cover image
    const colors = {
      article: COLORS.civicBlue,
      video: COLORS.actionOrange,
      pdf: '#8B5CF6',
      image: '#10B981',
      text: '#8B5CF6'
    };
    
    const color = colors[type] || COLORS.slate;
    const encodedTitle = encodeURIComponent(title.substring(0, 50));
    
    return `https://ui-avatars.com/api/?name=${encodedTitle}&background=${color.replace('#', '')}&color=fff&size=800&format=png&bold=true`;
  };

  // Get type icon
  const getTypeIcon = () => {
    switch (type) {
      case 'video': return <Play size={16} />;
      case 'pdf': return <FileText size={16} />;
      case 'article': return <FileText size={16} />;
      case 'image': return <ImageIcon size={16} />;
      case 'text': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  // Get type label
  const getTypeLabel = () => {
    switch (type) {
      case 'video': return 'Video';
      case 'pdf': return 'PDF';
      case 'article': return 'Article';
      case 'image': return 'Image';
      case 'text': return 'Text';
      default: return 'Content';
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
      case 'pending_audit': return 'bg-orange-100 text-orange-800';
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
        {matchPct && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-white/90 text-gray-900 border-0">
              {Math.round(matchPct * 100)}% match
            </Badge>
          </div>
        )}

        {/* Status Chip - Always show for non-ready items */}
        {status !== 'ready' && (
          <div className="absolute bottom-3 left-3">
            <Badge className={`${getStatusColor()} border-0`}>
              {status === 'pending_audit' ? 'Pending Review' : status.replace('_', ' ')}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-5 md:p-6">
        {/* Title */}
        <h3 className="text-base md:text-lg font-semibold leading-6 text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Summary */}
        {content.summary150 && (
          <p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
            {content.summary150}
          </p>
        )}

        {/* Key Points */}
        {content.keyPoints && content.keyPoints.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {content.keyPoints.slice(0, 5).map((point, index) => (
              <Badge key={index} variant="outline" className="text-xs rounded-full border-gray-200 text-gray-700">
                {point}
              </Badge>
            ))}
          </div>
        )}

        {/* Notable Quote */}
        {content.notableQuote && (
          <blockquote className="mt-3 text-sm italic text-gray-600 border-l-2 border-gray-200 pl-3">
            "{content.notableQuote}"
          </blockquote>
        )}

        {/* Metadata Row */}
        <div className="mt-4 text-sm text-slate-600 flex items-center gap-3 flex-wrap">
          {meta.sourceDomain && (
            <div className="flex items-center gap-1.5">
              <Globe size={14} />
              <span className="truncate max-w-[120px]">{meta.sourceDomain}</span>
            </div>
          )}
          {meta.author && (
            <div className="flex items-center gap-1.5">
              <User size={14} />
              <span className="truncate max-w-[100px]">{meta.author}</span>
            </div>
          )}
          {meta.publishDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{formatDate(meta.publishDate)}</span>
            </div>
          )}
          {content.readingTimeMin && (
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{formatReadingTime(content.readingTimeMin)}</span>
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
              onClick={() => url && window.open(url, '_blank')}
              disabled={!url}
            >
              <ExternalLink size={14} className="mr-1.5" />
              Open
            </Button>

            {onAttach && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs"
                onClick={() => {
                  // Simple implementation - you can enhance this later
                  const choice = prompt('Attach to: timeline, fact, or source?');
                  if (choice && ['timeline', 'fact', 'source'].includes(choice.toLowerCase())) {
                    onAttach(choice.toLowerCase() as 'timeline' | 'fact' | 'source');
                  }
                }}
              >
                Attach →
              </Button>
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
