/**
 * Content Modal Component
 * 
 * Shows full content preview in a modal
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, X } from 'lucide-react';
import { DiscoveredItem } from '@/types/discovered-content';

interface ContentModalProps {
  item: DiscoveredItem;
  onClose: () => void;
}

export function ContentModal({ item, onClose }: ContentModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {item.displayTitle || item.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Hero Image */}
          {item.media?.hero && (
            <div className="aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={item.media.hero}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Content */}
          <div className="space-y-4">
            {/* Summary */}
            {item.content?.summary150 && (
              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-slate-600">{item.content.summary150}</p>
              </div>
            )}
            
            {/* Key Points */}
            {item.content?.keyPoints && item.content.keyPoints.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Key Points</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {item.content.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>Source: {item.meta?.sourceDomain || 'Unknown'}</span>
              {item.meta?.publishDate && (
                <span>Published: {new Date(item.meta.publishDate).toLocaleDateString()}</span>
              )}
              {item.content?.readingTimeMin && (
                <span>{item.content.readingTimeMin} min read</span>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              onClick={() => window.open(item.url, '_blank')}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Original
            </Button>
            
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
