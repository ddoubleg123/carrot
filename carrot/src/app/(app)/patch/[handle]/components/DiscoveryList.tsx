'use client'

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Filter, SortAsc, Search, RefreshCw } from 'lucide-react'
import DiscoveryCard from './DiscoveryCard'
import { useDiscoveredItems } from '../useDiscoveredItems'

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

  // Memoize filters to prevent unnecessary re-fetches
  const filters = React.useMemo(() => ({
    type: filterType,
    sort: sortBy,
    timeRange,
    status: 'all' as const
  }), [filterType, sortBy, timeRange])

  const { items, isLoading, error, refetch } = useDiscoveredItems(patchHandle, filters)

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

  const handleRefresh = () => {
    refetch()
  }

  const handleStartDiscovery = async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/start-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_deepseek_search'
        })
      })

      if (response.ok) {
        console.log('[DiscoveryList] Discovery started successfully')
        // Trigger refetch after a delay to pick up new content
        setTimeout(() => {
          refetch()
        }, 3000)
      } else {
        console.error('[DiscoveryList] Failed to start discovery:', response.status)
      }
    } catch (error) {
      console.error('[DiscoveryList] Error starting discovery:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#0B0B0F]">Discovering content</h2>
          <Badge variant="secondary" className="bg-[#FF6A00] text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleStartDiscovery}
            className="h-8 bg-[#FF6A00] hover:bg-[#E55A00]"
          >
            Start Content Discovery
          </Button>
        </div>
      </div>

      {/* Subtext */}
      <p className="text-slate-600 text-sm">
        We're actively finding posts, videos, and resources that match this group. New items will appear here.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
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
          {deduplicatedItems.length > 0 && (
            <span className="text-slate-400 ml-1">• filtered</span>
          )}
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
            onClick={handleStartDiscovery}
            className="border-[#E6E8EC] hover:bg-slate-50"
          >
            Connect sources
          </Button>
        </div>
      )}

      {/* Content Grid */}
      {!isLoading && deduplicatedItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {deduplicatedItems.map((item) => (
            <DiscoveryCard 
              key={item.canonicalUrl || item.id} 
              item={item} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DiscoveryList