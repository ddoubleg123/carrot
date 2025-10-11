'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DiscoveredItem } from '@/types/discovered-content'

interface Filters {
  status?: 'ready' | 'pending_audit' | 'all'
  type?: 'all' | 'article' | 'video' | 'pdf' | 'image' | 'text'
  sort?: 'top' | 'new'
  timeRange?: '7d' | '30d' | 'all'
}

interface UseDiscoveredItemsReturn {
  items: DiscoveredItem[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Deduplicates items by canonicalUrl, with fallback to domain+title hash
 */
function deduplicateItems(items: DiscoveredItem[]): DiscoveredItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.canonicalUrl || `${item.meta.sourceDomain}|${item.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Maps API response to DiscoveredItem format
 */
function mapToDiscoveredItem(apiItem: any): DiscoveredItem {
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
      hero: apiItem.mediaAssets?.hero || apiItem.enrichedContent?.hero || null,
      gallery: apiItem.mediaAssets?.gallery || [],
      videoThumb: apiItem.mediaAssets?.videoThumb,
      pdfPreview: apiItem.mediaAssets?.pdfPreview,
      dominant: apiItem.mediaAssets?.dominant || '#0A5AFF',
      // Pass through the full mediaAssets for server-processed hero data
      mediaAssets: apiItem.mediaAssets
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
      favicon: apiItem.metadata?.favicon,
      author: apiItem.metadata?.author || 
              apiItem.author || 
              apiItem.enrichedContent?.author,
      publishDate: apiItem.metadata?.publishDate || 
                   apiItem.publishDate || 
                   apiItem.createdAt
    }
  }
}

export function useDiscoveredItems(
  patchHandle: string, 
  filters: Filters = {}
): UseDiscoveredItemsReturn {
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
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

      console.log('[useDiscoveredItems] Fetching for patch:', patchHandle, 'with filters:', filters)
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?${queryParams}`)
      console.log('[useDiscoveredItems] API response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const data = await response.json()
      console.log('[useDiscoveredItems] API response data:', data)
      const rawItems = Array.isArray(data?.items) ? data.items : []
      console.log('[useDiscoveredItems] Raw items count:', rawItems.length)
      
      // Map and deduplicate
      const mappedItems = rawItems.map(mapToDiscoveredItem)
      const dedupedItems = deduplicateItems(mappedItems)
      
      // Only update if items actually changed (prevent unnecessary re-renders)
      setItems(prevItems => {
        if (prevItems.length !== dedupedItems.length) {
          return dedupedItems
        }
        
        // Check if items are actually different
        const prevKeys = new Set(prevItems.map(item => item.canonicalUrl ?? item.id))
        const newKeys = new Set(dedupedItems.map(item => item.canonicalUrl ?? item.id))
        
        if (prevKeys.size !== newKeys.size || ![...prevKeys].every(key => newKeys.has(key))) {
          return dedupedItems
        }
        
        return prevItems // No change, keep existing reference
      })
    } catch (err) {
      console.error('[useDiscoveredItems] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch items')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [patchHandle, filters])

  const refetch = useCallback(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    items,
    isLoading,
    error,
    refetch
  }), [items, isLoading, error, refetch])
}

