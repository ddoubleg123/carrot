'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiscoveredItem } from '@/types/discovered-content'

interface UseDiscoveredItemsProps {
  patchId: string
  filters: {
    status?: 'ready' | 'pending_audit' | 'all'
    type?: 'all' | 'article' | 'video' | 'pdf' | 'image' | 'text'
    sort?: 'top' | 'new'
    timeRange?: '7d' | '30d' | 'all'
  }
}

interface UseDiscoveredItemsReturn {
  items: DiscoveredItem[]
  isLoading: boolean
  error: string | null
  refetch: () => void
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
  },
  {
    id: '5',
    title: 'Houston Oilers Championship Game Analysis',
    url: 'https://example.com/oilers-championship-analysis',
    type: 'pdf',
    matchPct: 0.91,
    status: 'enriching',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Championship%20Analysis&background=8B5CF6&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'Detailed analysis of the Houston Oilers\' championship games, including play-by-play breakdowns and strategic insights.',
      keyPoints: ['Championship analysis', 'Play-by-play breakdown', 'Strategic insights', 'Historical context'],
      readingTimeMin: 12
    },
    meta: {
      sourceDomain: 'nflanalysis.com',
      author: 'NFL Research',
      publishDate: '2024-01-25'
    }
  }
]

export function useDiscoveredItems({ patchId, filters }: UseDiscoveredItemsProps): UseDiscoveredItemsReturn {
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Deduplication function
  const deduplicateItems = useCallback((items: DiscoveredItem[]) => {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = item.canonicalUrl || `${item.meta.sourceDomain}|${item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [])

  // Transform API data to unified DiscoveredItem format
  const transformToDiscoveredItem = useCallback((apiItem: any): DiscoveredItem => {
    // Extract domain from URL for favicon
    const getDomain = (url?: string) => {
      if (!url) return 'unknown'
      try {
        return new URL(url).hostname.replace('www.', '')
      } catch {
        return 'unknown'
      }
    }

    return {
      id: apiItem.id || `item-${Math.random()}`,
      type: apiItem.type || 'article',
      title: apiItem.title || 'Untitled',
      url: apiItem.url || apiItem.sourceUrl || '',
      canonicalUrl: apiItem.canonicalUrl,
      matchPct: apiItem.relevanceScore || apiItem.relevance_score || 0.8,
      status: apiItem.status === 'pending_audit' ? 'pending_audit' : 
              apiItem.status === 'requires_review' ? 'pending_audit' : 
              (apiItem.status as any) || 'ready',
      media: {
        hero: apiItem.mediaAssets?.hero || 
              apiItem.enrichedContent?.hero || 
              `https://ui-avatars.com/api/?name=${encodeURIComponent((apiItem.title || 'Content').substring(0, 30))}&background=FF6A00&color=fff&size=800&format=png&bold=true`,
        gallery: apiItem.mediaAssets?.gallery || [],
        videoThumb: apiItem.mediaAssets?.videoThumb,
        pdfPreview: apiItem.mediaAssets?.pdfPreview,
        dominant: apiItem.mediaAssets?.dominant
      },
      content: {
        summary150: apiItem.enrichedContent?.summary150 || 
                    apiItem.description || 
                    apiItem.content?.substring(0, 150) + '...' || 
                    'No summary available',
        keyPoints: apiItem.enrichedContent?.keyPoints || 
                   apiItem.tags?.slice(0, 5) || 
                   ['Key information available'],
        notableQuote: apiItem.enrichedContent?.notableQuote,
        readingTimeMin: apiItem.metadata?.readingTime || 
                        apiItem.enrichedContent?.readingTime || 
                        Math.max(1, Math.floor((apiItem.content?.length || 1000) / 200))
      },
      meta: {
        sourceDomain: getDomain(apiItem.url || apiItem.sourceUrl),
        author: apiItem.metadata?.author || 
                apiItem.author || 
                apiItem.enrichedContent?.author,
        publishDate: apiItem.metadata?.publishDate || 
                     apiItem.publishDate || 
                     apiItem.createdAt
      }
    }
  }, [])

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call with filters
      const queryParams = new URLSearchParams()
      if (filters.status && filters.status !== 'all') {
        queryParams.append('status', filters.status)
      }
      if (filters.type && filters.type !== 'all') {
        queryParams.append('type', filters.type)
      }
      if (filters.sort) {
        queryParams.append('sort', filters.sort)
      }
      if (filters.timeRange) {
        queryParams.append('timeRange', filters.timeRange)
      }

      // For now, use mock data with filtering
      let filteredItems = [...mockDiscoveredItems]

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        filteredItems = filteredItems.filter(item => item.status === filters.status)
      }
      if (filters.type && filters.type !== 'all') {
        filteredItems = filteredItems.filter(item => item.type === filters.type)
      }

      // Apply sorting
      if (filters.sort === 'top') {
        filteredItems.sort((a, b) => (b.matchPct || 0) - (a.matchPct || 0))
      } else if (filters.sort === 'new') {
        filteredItems.sort((a, b) => 
          new Date(b.meta.publishDate || 0).getTime() - new Date(a.meta.publishDate || 0).getTime()
        )
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500))

      const deduplicatedItems = deduplicateItems(filteredItems)
      setItems(deduplicatedItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [patchId, filters, deduplicateItems])

  const refetch = useCallback(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return {
    items,
    isLoading,
    error,
    refetch
  }
}
