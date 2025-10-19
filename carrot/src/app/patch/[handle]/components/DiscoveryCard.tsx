/**
 * Discovery Card Component
 * 
 * Renders a single discovered item with hero image, title, and actions
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Clock, Globe } from 'lucide-react';
import { DiscoveredItem } from '@/types/discovered-content';
import { PostActionBar } from '@/components/patch/PostActionBar';
import { ContentModal } from './ContentModal';

interface DiscoveryCardProps {
  item: DiscoveredItem;
  patchHandle: string;
}

export function DiscoveryCard({ item, patchHandle }: DiscoveryCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };
  
  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Unknown';
    }
  };
  
  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          {/* Hero Image */}
          <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
            {item.media?.hero ? (
              <img
                src={item.media.hero}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Globe className="h-8 w-8" />
              </div>
            )}
            
            {/* Clickable overlay */}
            <Button
              variant="ghost"
              className="absolute inset-0 w-full h-full bg-transparent hover:bg-black/10"
              onClick={() => setIsModalOpen(true)}
              aria-label="Open content preview"
            />
          </div>
          
          {/* Content */}
          <div className="p-6">
            {/* Title */}
            <h3 className="text-lg font-semibold line-clamp-2 mb-2">
              {item.displayTitle || item.title}
            </h3>
            
            {/* Summary */}
            {item.content?.summary150 && (
              <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                {item.content.summary150}
              </p>
            )}
            
            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>{item.meta?.sourceDomain || getDomainFromUrl(item.url)}</span>
              </div>
              
              {item.meta?.publishDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(item.meta.publishDate)}</span>
                </div>
              )}
              
              {item.content?.readingTimeMin && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{item.content.readingTimeMin} min read</span>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(item.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                Preview
              </Button>
            </div>
            
            {/* Post Action Bar */}
            <div className="mt-3 pt-3 border-t">
              <PostActionBar
                url={item.url}
                itemId={item.id}
                title={item.title}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Content Modal */}
      {isModalOpen && (
        <ContentModal
          item={item}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}