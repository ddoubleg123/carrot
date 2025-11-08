'use client'

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Filter, SortAsc, Search, RefreshCw, Play, Square, Pause } from 'lucide-react'
import { DiscoveryCard } from './DiscoveryCard'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import ContentModal from './ContentModal'
import { useDiscoveryStream } from '@/app/(app)/patch/[handle]/hooks/useDiscoveryStream'
import DiscoveryControls from './DiscoveryControls'
import LivePanel from './LivePanel'
import DiscoverySkeleton from './DiscoverySkeleton'
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

  // Use discovery stream hook
  const { 
    state,
    items, 
    start,
    pause,
    stop,
    refresh
  } = useDiscoveryStream(patchHandle)

  const isLoading = false // Items load immediately via SSE
  const error = state.error

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
    refresh()
  }

  const handleStart = () => {
    start()
  }

  const handlePause = () => {
    pause()
  }

  const handleStop = () => {
    stop()
  }

  return (
    <section className="w-full">
      {/* Discovery Header */}
      <div className="mt-6 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-slate-900">Discovering content</h2>
          
          {/* LIVE badge when discovery is active */}
          {state.isActive && (
            <Badge className="bg-green-100 text-green-700 border-green-200 animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Filters row + Discovery Controls */}
      <div className="relative z-10 mb-4 flex min-h-[44px] items-center justify-between gap-4 overflow-x-auto whitespace-nowrap md:overflow-visible">
        {/* Left: Filters */}
        <div className="flex items-center gap-3 flex-shrink-0">
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
        </div>

        {/* Right: Discovery Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status Badge */}
          <Badge variant={state.isActive ? 'default' : 'secondary'} className="capitalize">
            {state.isActive ? (state.isPaused ? 'Paused' : 'Live') : 'Idle'}
          </Badge>
          
          {/* Start/Pause/Stop Buttons */}
          {!state.isActive ? (
            <Button onClick={handleStart} size="sm" className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
              <Play className="h-4 w-4 mr-1" />
              Start Discovery
            </Button>
          ) : (
            <>
              <Button 
                onClick={state.isPaused ? handleStart : handlePause} 
                size="sm"
                variant="outline"
              >
                {state.isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                {state.isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button onClick={handleStop} size="sm" variant="outline">
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </>
          )}
          
          {/* Refresh Button */}
          <Button onClick={handleRefresh} size="sm" variant="ghost">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content grid - ONLY tiles, no controls */}
      <div id="discover-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-auto">
        {/* Discovery Skeleton - only show when active */}
        {state.isActive && (
          <DiscoverySkeleton
            id="discovery-skeleton"
            className="w-full"
            isActive={state.isActive}
            currentStatus={state.currentStatus}
          />
        )}

        {/* Rows 2+ : real items */}
        {visibleItems.map((item) => {
          const canonicalUrl = item.canonicalUrl || item.url
          const domain = (() => {
            try {
              return new URL(canonicalUrl).hostname.replace(/^www\./, '')
            } catch {
              return item.meta?.sourceDomain || 'source'
            }
          })()

          const facts = (item.content?.keyPoints || []).map((point, index) => ({
            label: `Key point ${index + 1}`,
            value: point,
            citation: canonicalUrl
          }))

          if (facts.length === 0 && item.content?.summary150) {
            facts.push({
              label: 'Summary insight',
              value: item.content.summary150,
              citation: canonicalUrl
            })
          }

          const quotes = item.content?.notableQuote
            ? [{ text: item.content.notableQuote, citation: canonicalUrl }]
            : []

          const heroSource: 'ai' | 'wikimedia' | 'skeleton' | null = item.media?.hero
            ? item.media.source === 'image'
              ? 'wikimedia'
              : 'ai'
            : null

          const payload: DiscoveryCardPayload = {
            id: item.id,
            title: item.displayTitle || item.title,
            url: item.url,
            canonicalUrl,
            domain,
            sourceType: item.type,
            credibilityTier: undefined,
            angle: undefined,
            noveltySignals: [],
            expectedInsights: [],
            reason: undefined,
            whyItMatters: item.content?.summary150 || '',
            facts,
            quotes,
            provenance: [canonicalUrl],
            contested: null,
            hero: heroSource && item.media?.hero ? { url: item.media.hero, source: heroSource } : null,
            relevanceScore: 0.8,
            qualityScore: 70,
            viewSourceOk: true,
            savedAt: new Date().toISOString()
          }

          return (
            <DiscoveryCard
              key={canonicalUrl || item.id}
              item={payload}
              onSelect={() => handleHeroClick(item)}
            />
          )
        })}

        {/* Loading skeletons when loading initial content */}
        {isLoading && deduplicatedItems.length === 0 && (
          <>
            <DiscoverySkeleton isActive={false} className="w-full" />
            <DiscoverySkeleton isActive={false} className="w-full" />
            <DiscoverySkeleton isActive={false} className="w-full" />
            <DiscoverySkeleton isActive={false} className="w-full" />
          </>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mt-4">
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

      {/* Empty State */}
      {!isLoading && !error && deduplicatedItems.length === 0 && !state.isActive && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No items yet</h3>
          <p className="text-slate-600 mb-4">Expand the range to see more content.</p>
          <p className="text-sm text-slate-500">
            Use the discovery controls above to start finding content.
          </p>
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
    </section>
  )
}

export default DiscoveryList