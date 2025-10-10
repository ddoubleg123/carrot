'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Filter,
  SortAsc,
  Clock,
  Search
} from 'lucide-react'
import { DiscoveryCard } from './DiscoveryCard'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryListProps {
  patchHandle: string
}

// Mock data for testing
const mockDiscoveredItems: DiscoveredItem[] = [
  {
    id: '1',
    title: 'Houston Oilers: The Complete History',
    url: 'https://example.com/houston-oilers-history',
    type: 'article',
    matchPct: 0.95,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Houston%20Oilers&background=FF6A00&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'A comprehensive look at the Houston Oilers franchise from its founding to present day, covering key players, championships, and memorable moments.',
      keyPoints: ['Founded in 1960', 'Two AFL championships', 'Warren Moon era', 'Relocated to Tennessee'],
      readingTimeMin: 8
    },
    meta: {
      sourceDomain: 'nfl.com',
      author: 'NFL Historical Society',
      publishDate: '2024-01-15'
    }
  },
  {
    id: '2', 
    title: 'Warren Moon: Hall of Fame Quarterback',
    url: 'https://example.com/warren-moon',
    type: 'video',
    matchPct: 0.89,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Warren%20Moon&background=0A5AFF&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'Documentary about Warren Moon\'s incredible career with the Houston Oilers and his journey to the Pro Football Hall of Fame.',
      keyPoints: ['Hall of Fame QB', 'Houston Oilers legend', 'AFL record holder', 'Community leader'],
      readingTimeMin: 15
    },
    meta: {
      sourceDomain: 'youtube.com',
      author: 'NFL Films',
      publishDate: '2024-02-01'
    }
  },
  {
    id: '3',
    title: 'Earl Campbell: The Tyler Rose',
    url: 'https://example.com/earl-campbell',
    type: 'article',
    matchPct: 0.87,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Earl%20Campbell&background=10B981&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'The legendary running back who dominated the NFL with his powerful running style and became one of the most beloved Oilers players.',
      keyPoints: ['Heisman Trophy winner', 'NFL MVP 1979', 'Power running style', 'Tyler Rose nickname'],
      readingTimeMin: 6
    },
    meta: {
      sourceDomain: 'espn.com',
      author: 'Sports Illustrated',
      publishDate: '2024-01-20'
    }
  },
  {
    id: '4',
    title: 'Houston Oilers Training Camp Photos',
    url: 'https://example.com/oilers-training-camp',
    type: 'image',
    matchPct: 0.82,
    status: 'pending_audit',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Training%20Camp&background=F59E0B&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'Rare photos from Houston Oilers training camps throughout the 1970s and 1980s, showing the team preparing for championship seasons.',
      keyPoints: ['Training camp photos', '1970s-1980s era', 'Championship preparation', 'Rare historical images'],
      readingTimeMin: 3
    },
    meta: {
      sourceDomain: 'gettyimages.com',
      author: 'Sports Illustrated',
      publishDate: '2024-01-10'
    }
  }
]

export function DiscoveryList({ patchHandle }: DiscoveryListProps) {
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'pdf' | 'image' | 'text'>('all')
  const [sortBy, setSortBy] = useState<'top' | 'new'>('top')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')

  // Simulate discovery process
  useEffect(() => {
    if (isDiscovering) {
      // Initial load
      setTimeout(() => {
        setItems(mockDiscoveredItems.slice(0, 2))
        setIsLoading(false)
        setLastUpdate(new Date())
      }, 1000)

      // Simulate streaming items
      const interval = setInterval(() => {
        setItems(prev => {
          const newItem = mockDiscoveredItems[Math.floor(Math.random() * mockDiscoveredItems.length)]
          const newItemWithId = { ...newItem, id: `${newItem.id}-${Date.now()}` }
          return [newItemWithId, ...prev.slice(0, 9)] // Keep max 10 items
        })
        setLastUpdate(new Date())
      }, 4000)
      
      return () => clearInterval(interval)
    }
  }, [isDiscovering])

  // Deduplication function
  const deduplicateItems = (items: DiscoveredItem[]) => {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = item.canonicalUrl || `${item.meta.sourceDomain}|${item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // Filter and sort items
  const getFilteredAndSortedItems = () => {
    let filtered = deduplicateItems(items)
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'top':
          return (b.matchPct || 0) - (a.matchPct || 0)
        case 'new':
          return new Date(b.meta.publishDate || 0).getTime() - new Date(a.meta.publishDate || 0).getTime()
        default:
          return 0
      }
    })

    return filtered
  }

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const filteredItems = getFilteredAndSortedItems()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Discovering content</h2>
          {isDiscovering && (
            <>
              <Badge className="bg-orange-500 text-white">
                LIVE
              </Badge>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            </>
          )}
        </div>
        <div className="text-sm text-gray-500" aria-live="polite">
          Updated {getTimeAgo(lastUpdate)} • {filteredItems.length} new
        </div>
      </div>

      {/* Subtext */}
      <p className="text-gray-600">
        We're actively finding posts, videos, and drills that match this group. New items will appear here.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          >
            <option value="all">All Types</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="pdf">PDFs</option>
            <option value="image">Images</option>
            <option value="text">Text</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-gray-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          >
            <option value="top">Top</option>
            <option value="new">New</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          >
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="text-sm text-gray-500 ml-auto">
          {filteredItems.length} items • filtered
        </div>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6 animate-pulse">
              <div className="aspect-[16/9] bg-gray-200 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
              <div className="h-3 bg-gray-200 rounded mb-2 w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-live="polite">
          {filteredItems.map((item, index) => (
            <DiscoveryCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-500 mb-4">Expanding the time range may help.</p>
          <Button variant="outline">Connect sources</Button>
        </div>
      )}
    </div>
  )
}
