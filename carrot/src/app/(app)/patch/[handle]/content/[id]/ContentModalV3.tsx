'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useContentPreview } from '@/hooks/useContentPreview'
import HeaderStrip from './HeaderStrip'
import SplitContainer from './SplitContainer'
import ContentPane from './ContentPane'
import CommentsPane from './CommentsPane'

interface ContentModalV3Props {
  contentId: string
  isOpen: boolean
  onClose: () => void
}

export default function ContentModalV3({ contentId, isOpen, onClose }: ContentModalV3Props) {
  const { data: content, isLoading, error } = useContentPreview(contentId)
  const [dominantColor, setDominantColor] = useState<string>('#667eea') // Default accent color

  useEffect(() => {
    if (content?.media?.dominant) {
      setDominantColor(content.media.dominant)
    }
  }, [content?.media?.dominant])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[1400px] w-[92vw] max-h-[90vh] p-0 rounded-2xl shadow-xl flex flex-col"
        style={{ '--accent': dominantColor } as React.CSSProperties}
      >
        {/* Header Strip */}
        <HeaderStrip 
          content={content} 
          isLoading={isLoading} 
          onClose={onClose} 
          dominantColor={dominantColor} 
        />

        {/* Main Content Area with Split Layout */}
        <div className="flex-1 overflow-hidden"> {/* This div ensures the SplitContainer takes remaining height */}
          <SplitContainer>
            <ContentPane content={content} isLoading={isLoading} />
            <CommentsPane contentId={contentId} />
          </SplitContainer>
        </div>

        {/* Bottom Accent Strip */}
        <div 
          className="h-[6px] rounded-b-2xl" 
          style={{ backgroundColor: dominantColor }}
        />
      </DialogContent>
    </Dialog>
  )
}