'use client'

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Filter, SortAsc, Search, RefreshCw, Play, Square, Pause } from 'lucide-react'
import DiscoveryCard from './DiscoveryCard'
import ContentModal from './ContentModal'
import { useDiscoveredItems } from '@/app/(app)/patch/[handle]/useDiscoveredItems'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryListProps {
  patchHandle: string
}

function DiscoveryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm animate-pulse">
      {/* Hero skeleton */}
      <div className="aspect-[16/9] bg-gray-200 rounded-xl mb-3" />
      {/* Title skeleton */}
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
      {/* Summary skeleton */}
      <div className="h-4 bg-gray-200 rounded w-full mb-1" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
      {/* Pills skeleton */}
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
        <div className="h-6 w-24 bg-gray-200 rounded-full" />
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </div>
      {/* Meta skeleton */}
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

function DiscoveryList({ patchHandle }: DiscoveryListProps) {
  const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'pdf' | 'image' | 'text'>('all')
  const [sortBy, setSortBy] = useState<'top' | 'new'>('top')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')
  const [selectedItem, setSelectedItem] = useState<DiscoveredItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [visibleItemsCount, setVisibleItemsCount] = useState(6) // Start with 6 items

  // Use discovered items hook
  const { 
    items, 
    isLoading, 
    error, 
    refetch 
  } = useDiscoveredItems(patchHandle, {
    status: 'all',
    type: filterType,
    sort: sortBy,
    timeRange
  })

  const isDiscoveryActive = false // TODO: Implement discovery state tracking

  const handleHeroClick = (item: DiscoveredItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedItem(null)
  }

  // Deduplicate items by canonicalUrl before rendering
  const deduplicatedItems = React.useMemo(() => {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = item.canonicalUrl || `${item.meta.sourceDomain}|${item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [items])
  
  // Lazy loading: only show visible items
  const visibleItems = deduplicatedItems.slice(0, visibleItemsCount)
  const hasMoreItems = deduplicatedItems.length > visibleItemsCount
  
  // Load more items
  const handleLoadMore = () => {
    setVisibleItemsCount(prev => Math.min(prev + 6, deduplicatedItems.length))
  }

  const handleRefresh = () => {
    refetch()
  }

  const handleToggleDiscovery = () => {
    // TODO: Implement discovery start/stop
    console.log('Discovery toggle clicked')
  }

  return (
    <div className="border-t border-[#E6E8EC] pt-4">
      {/* Discovery Header */}
      <div className="mt-6 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-slate-900">Discovering content</h2>
          
          {/* TODO: Add LIVE badge when discovery is active */}
          
          {/* TODO: Add discovery status display */}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap mb-6">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-sm border border-[#E6E8EC] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#0A5AFF] focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="pdf">PDFs</option>
            <option value="image">Images</option>
            <option value="text">Text</option>
          </select>
        </div>

        {/* Sort Filter */}
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-[#E6E8EC] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#0A5AFF] focus:border-transparent"
          >
            <option value="top">Top</option>
            <option value="new">New</option>
          </select>
        </div>

        {/* Time Range Filter */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="text-sm border border-[#E6E8EC] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#0A5AFF] focus:border-transparent"
        >
          <option value="7d">7d</option>
          <option value="30d">30d</option>
          <option value="all">All</option>
        </select>

        {/* Results Count */}
        <div className="text-sm text-slate-600">
          {isLoading ? 'Loading...' : `${deduplicatedItems.length} items`}
        </div>

        {/* Discovery Toggle Button */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={handleToggleDiscovery}
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Discovery
          </Button>
          
          {/* Refresh button */}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium">Error loading content</span>
          </div>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="mt-2 h-8 text-red-600 border-red-200 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && deduplicatedItems.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <DiscoveryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && deduplicatedItems.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No items yet</h3>
          <p className="text-slate-600 mb-4">Expand the range to see more content.</p>
          <Button
            variant="outline"
            onClick={handleToggleDiscovery}
            className="border-[#E6E8EC] hover:bg-slate-50"
          >
            <Play className="h-3 w-3 mr-1" />
            Start discovery
          </Button>
        </div>
      )}

      {/* Content Grid */}
      {(deduplicatedItems.length > 0 || isDiscoveryActive || isLoading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Show loading skeleton when loading initial content */}
          {isLoading && deduplicatedItems.length === 0 && (
            <>
              <DiscoveryCardSkeleton />
              <DiscoveryCardSkeleton />
              <DiscoveryCardSkeleton />
              <DiscoveryCardSkeleton />
            </>
          )}
          {/* Show loading skeleton FIRST when discovery is active */}
          {isDiscoveryActive && (
            <DiscoveryCardSkeleton />
          )}
          
          {/* Then show actual items */}
           {visibleItems.map((item) => (
             <DiscoveryCard 
               key={item.canonicalUrl || item.id} 
               item={item}
               onHeroClick={handleHeroClick}
               patchHandle={patchHandle}
             />
           ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMoreItems && !isLoading && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleLoadMore}
            variant="outline"
            className="px-8 py-2"
          >
            Load More ({deduplicatedItems.length - visibleItemsCount} remaining)
          </Button>
        </div>
      )}

      {/* Content Modal */}
      <ContentModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}

export default DiscoveryList