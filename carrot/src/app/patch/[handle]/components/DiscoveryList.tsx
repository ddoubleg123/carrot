'use client'

import React, { useState } from 'react'
import { Filter, SortAsc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DiscoveryHeader from './DiscoveryHeader'
import DiscoveryCard from './DiscoveryCard'
import { useDiscoveryStream } from '../hooks/useDiscoveryStream'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryListProps {
  patchId: string
}

type SortBy = 'relevance' | 'newest' | 'quality'
type FilterType = 'all' | 'article' | 'video' | 'pdf' | 'post'

export default function DiscoveryList({ patchId }: DiscoveryListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedItem, setSelectedItem] = useState<DiscoveredItem | null>(null)
  
  const {
    start,
    pause,
    resume,
    restart,
    refresh,
    state,
    done,
    total,
    live,
    items,
    error
  } = useDiscoveryStream({ patchId, batchSize: 10 })
  
  // Dedupe items by canonicalUrl
  const deduplicatedItems = React.useMemo(() => {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = item.canonicalUrl || item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [items])
  
  // Filter and sort
  const getSortedAndFilteredItems = () => {
    let filtered = deduplicatedItems
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }
    
    // Sort
    const sorted = [...filtered]
    if (sortBy === 'newest') {
      sorted.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime()
        const bDate = new Date(b.createdAt || 0).getTime()
        return bDate - aDate
      })
    } else if (sortBy === 'relevance') {
      sorted.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    } else if (sortBy === 'quality') {
      sorted.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    }
    
    return sorted
  }
  
  const displayItems = getSortedAndFilteredItems()
  const showSkeletons = (state === 'searching' || state === 'processing') && displayItems.length === 0

  return (
    <div className="space-y-4">
      {/* Discovery Header */}
      <DiscoveryHeader
        state={state}
        done={done}
        total={total}
        live={live}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onRestart={restart}
        onRefresh={refresh}
      />
      
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Filters and Sort */}
      <div className="mt-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const order: SortBy[] = ['relevance', 'newest', 'quality']
              const current = order.indexOf(sortBy)
              setSortBy(order[(current + 1) % order.length])
            }}
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <SortAsc className="w-4 h-4 mr-2" />
            {sortBy === 'relevance' && 'Relevance'}
            {sortBy === 'newest' && 'Newest'}
            {sortBy === 'quality' && 'Quality'}
          </Button>
        </div>
      </div>
      
      {/* Filter Pills */}
      {showFilters && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {(['all', 'article', 'video', 'pdf', 'post'] as FilterType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#0A5AFF] focus-visible:outline-none ${
                filterType === type
                  ? 'bg-[#0A5AFF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}
      
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skeletons while searching */}
        {showSkeletons && [1, 2, 3].map(i => (
          <Card key={`skeleton-${i}`} className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm overflow-hidden">
            <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
            <CardContent className="p-5 md:p-6">
              <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            </CardContent>
          </Card>
        ))}
        
        {/* Real items */}
        {displayItems.map(item => (
          <DiscoveryCard
            key={item.canonicalUrl || item.id}
            item={item}
            onOpenModal={setSelectedItem}
          />
        ))}
      </div>
      
      {/* Empty State */}
      {!showSkeletons && displayItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
          <p className="text-gray-500">
            {filterType === 'all'
              ? 'Click "Start Discovery" to find relevant content'
              : `No ${filterType}s found. Try changing the filter.`}
          </p>
        </div>
      )}
      
      {/* Content Modal - TODO: Implement */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">{selectedItem.title}</h2>
              <p className="text-gray-600">{selectedItem.content?.summary150}</p>
              {selectedItem.url && (
                <a 
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-blue-600 hover:underline"
                >
                  View Source →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

