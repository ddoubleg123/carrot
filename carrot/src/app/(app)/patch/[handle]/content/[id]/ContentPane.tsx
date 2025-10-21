'use client'

import React from 'react'
import { ContentPreview } from '@/types/content-preview'
import ContentBlocks from '@/components/content/ContentBlocks'

interface ContentPaneProps {
  content?: ContentPreview
  isLoading: boolean
}

export default function ContentPane({ content, isLoading }: ContentPaneProps) {
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <ContentBlocks.Skeleton />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="h-full overflow-y-auto p-6 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Content not found</h3>
          <p className="text-slate-600">The requested content could not be loaded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-none">
        <ContentBlocks
          summary={content.summary}
          keyPoints={content.keyPoints}
          excerptHtml={content.excerptHtml}
          entities={content.entities?.map(entity => entity.name)}
          timeline={content.timeline}
        />
      </div>
    </div>
  )
}