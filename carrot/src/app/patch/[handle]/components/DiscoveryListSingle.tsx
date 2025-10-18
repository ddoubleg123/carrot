'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import DiscoveryHeaderSingle from './DiscoveryHeaderSingle'
import DiscoveryCard from './DiscoveryCard'
import { useDiscoveryStreamSingle } from '../hooks/useDiscoveryStreamSingle'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryListSingleProps {
  patchHandle: string
}

export default function DiscoveryListSingle({ patchHandle }: DiscoveryListSingleProps) {
  const [selectedItem, setSelectedItem] = useState<DiscoveredItem | null>(null)
  
  const {
    start,
    pause,
    resume,
    refresh,
    state,
    live,
    items,
    statusText,
    lastItemTitle,
    sessionCount
  } = useDiscoveryStreamSingle({ patchHandle })
  
  // Show skeleton only while first search is happening
  const showSkeleton = state === 'searching' && items.length === 0

  return (
    <div className="space-y-4">
      {/* Discovery Header */}
      <DiscoveryHeaderSingle
        state={state}
        live={live}
        statusText={statusText}
        lastItemTitle={lastItemTitle}
        sessionCount={sessionCount}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onRefresh={refresh}
      />
      
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skeleton while searching for first item */}
        {showSkeleton && (
          <Card className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm overflow-hidden">
            <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
            <CardContent className="p-5 md:p-6">
              <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            </CardContent>
          </Card>
        )}
        
        {/* Real items with fade-in animation */}
        {items.map((item, index) => (
          <div
            key={item.canonicalUrl || item.id}
            className="animate-in fade-in slide-in-from-top-4 duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <DiscoveryCard
              item={item}
              onOpenModal={setSelectedItem}
            />
          </div>
        ))}
      </div>
      
      {/* Empty State */}
      {!showSkeleton && items.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
          <p className="text-gray-500">
            Click "Start discovery" to find relevant content
          </p>
        </div>
      )}
      
      {/* Content Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero Image */}
            {selectedItem.media?.hero && (
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={selectedItem.media.hero}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* Content */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-[#0B0B0F] mb-2">
                {selectedItem.title}
              </h2>
              
              {/* Meta */}
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                {selectedItem.meta?.sourceDomain && (
                  <span>{selectedItem.meta.sourceDomain}</span>
                )}
                {selectedItem.meta?.publishDate && (
                  <>
                    <span>•</span>
                    <span>
                      {new Date(selectedItem.meta.publishDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </>
                )}
                {selectedItem.meta?.author && (
                  <>
                    <span>•</span>
                    <span>by {selectedItem.meta.author}</span>
                  </>
                )}
              </div>
              
              {/* Summary */}
              {selectedItem.content?.summary150 && (
                <p className="text-gray-700 leading-relaxed mb-4">
                  {selectedItem.content.summary150}
                </p>
              )}
              
              {/* View Source */}
              {selectedItem.url && (
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  View source →
                </a>
              )}
              
              {/* Close button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="mt-6 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

