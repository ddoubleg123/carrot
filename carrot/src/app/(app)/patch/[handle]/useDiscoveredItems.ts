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

const getDomain = (url?: string) => {
  if (!url) return 'carrot.app' // Default fallback
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'carrot.app' // Default fallback
  }
}

/**
 * Generate a specific display title, preferring meaningful titles over generic ones
 */
function generateDisplayTitle(apiItem: any): string {
  const originalTitle = apiItem.title || ''
  const summary = apiItem.enrichedContent?.summary150 || apiItem.description || apiItem.whyItMatters || ''
  const citeMeta = apiItem.citeMeta || {}
  
  // Check if title is a poor title (domain-based, DOI, etc.)
  const poorTitlePatterns = [
    /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i, // "domain.org - ..."
    /^doi\.org/i, // "doi.org - ..."
    /^[0-9.]+(\/[0-9a-z]+)+$/i, // DOI patterns like "10.1017/..."
    /^(book part|untitled)$/i, // Generic terms
    /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*type\s*-\s*/i // "domain.org - type - ..."
  ]
  
  const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(originalTitle))
  
  // If title is poor, try to create a better one
  if (isPoorTitle || originalTitle.length < 10) {
    // First, try summary
    if (summary && summary.length > 20) {
      // Extract first meaningful sentence from summary
      const firstSentence = summary.split(/[.!?]/)[0].trim()
      if (firstSentence.length > 15 && firstSentence.length < 100) {
        return firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
      }
      
      // Fallback: take first 8-12 meaningful words from summary
      const words = summary.split(' ').slice(0, 12)
      const meaningfulWords = words.filter((word: string) => 
        word.length > 2 && 
        !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'].includes(word.toLowerCase())
      ).slice(0, 8)
      
      if (meaningfulWords.length >= 3) {
        return meaningfulWords.map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ')
      }
    }
    
    // Try to extract from URL if available
    const url = apiItem.url || apiItem.sourceUrl || ''
    if (url) {
      try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(p => p && p.length > 2)
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart.length > 5 && lastPart.length < 80) {
          const decoded = decodeURIComponent(lastPart)
            .replace(/[-_]/g, ' ')
            .replace(/\.[a-z]{2,4}$/i, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          if (decoded.length > 10 && decoded.length < 80) {
            return decoded
          }
        }
      } catch (e) {
        // URL parsing failed, continue
      }
    }
  }
  
  // Clean up title (remove domain prefixes, etc.)
  let cleanTitle = originalTitle
    .replace(/^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i, '') // Remove "domain.org - " prefix
    .replace(/\s*\|.*$/, '') // Remove " | Site Name" suffixes
    .replace(/\s*-\s*type\s*-\s*.*$/i, '') // Remove " - type - ..." suffixes
    .replace(/\s*::.*$/, '') // Remove " :: Site Name" suffixes
    .trim()
  
  return cleanTitle || originalTitle || 'Untitled Content'
}

/**
 * Maps API response to DiscoveredItem format
 */
function mapToDiscoveredItem(apiItem: any): DiscoveredItem {

  // Debug logging
  console.log('[mapToDiscoveredItem] Processing item:', {
    id: apiItem.id,
    title: apiItem.title,
    url: apiItem.url,
    sourceUrl: apiItem.sourceUrl,
    mediaAssets: apiItem.mediaAssets,
    type: apiItem.type,
    citeMeta: apiItem.citeMeta,
    enrichedContent: apiItem.enrichedContent
  })

  // Generate displayTitle - prefer specific titles over generic ones
  const displayTitle = generateDisplayTitle(apiItem)

  // Preserve hero and mediaAssets for DiscoveryCard component compatibility
  const hero = apiItem.hero || (apiItem.mediaAssets?.hero ? { url: apiItem.mediaAssets.hero, source: apiItem.mediaAssets.source } : undefined)
  const mediaAssets = apiItem.mediaAssets || (apiItem.hero && typeof apiItem.hero === 'object' ? { hero: apiItem.hero.url, source: apiItem.hero.source } : undefined)
  
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
    displayTitle, // Add the generated display title
    // Preserve hero and mediaAssets for DiscoveryCard component
    hero: hero as any,
    mediaAssets: mediaAssets as any,
    media: {
      hero: apiItem.mediaAssets?.hero || 
            apiItem.enrichedContent?.hero || 
            (apiItem.hero && typeof apiItem.hero === 'object' ? apiItem.hero.url : apiItem.hero) ||
            undefined,
      blurDataURL: apiItem.mediaAssets?.blurDataURL,
      dominant: apiItem.mediaAssets?.dominant,
      source: apiItem.mediaAssets?.source || (apiItem.hero && typeof apiItem.hero === 'object' ? apiItem.hero.source : undefined),
      license: apiItem.mediaAssets?.license,
      gallery: apiItem.mediaAssets?.gallery || [],
      videoThumb: apiItem.mediaAssets?.videoThumb,
      pdfPreview: apiItem.mediaAssets?.pdfPreview
    } as any, // Temporary type assertion for compatibility
    content: {
      summary150: apiItem.enrichedContent?.summary150 || 
                  apiItem.whyItMatters?.substring(0, 150) ||
                  apiItem.citeMeta?.description ||
                  apiItem.description || 
                  apiItem.summary?.substring(0, 150) ||
                  apiItem.content?.substring(0, 150) + '...' || 
                  'No summary available',
      keyPoints: apiItem.enrichedContent?.keyPoints || 
                 (apiItem.facts && Array.isArray(apiItem.facts) ? apiItem.facts.slice(0, 5).map((f: any) => f.value || f.text || f).filter(Boolean) : []) ||
                 apiItem.tags?.slice(0, 5) || 
                 apiItem.citeMeta?.tags?.slice(0, 5) ||
                 ['Key information available'],
      notableQuote: apiItem.enrichedContent?.notableQuote || 
                    (apiItem.quotes && Array.isArray(apiItem.quotes) && apiItem.quotes.length > 0 ? apiItem.quotes[0].text : undefined),
      readingTimeMin: apiItem.metadata?.readingTime || 
                      apiItem.enrichedContent?.readingTime || 
                      Math.max(1, Math.floor((apiItem.textLength || apiItem.content?.length || 1000) / 200))
    },
    meta: {
      sourceDomain: getDomain(apiItem.url || apiItem.sourceUrl || apiItem.citeMeta?.url),
      author: apiItem.metadata?.author || 
              apiItem.author || 
              apiItem.enrichedContent?.author ||
              apiItem.citeMeta?.author,
      publishDate: apiItem.metadata?.publishDate || 
                   apiItem.publishDate || 
                   apiItem.citeMeta?.publishDate ||
                   apiItem.enrichedContent?.publishDate ||
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
      // Add cache-busting parameter to force fresh data
      queryParams.append('t', Date.now().toString())
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?${queryParams}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      console.log('[useDiscoveredItems] API response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const data = await response.json()
      console.log('[useDiscoveredItems] API response data:', data)
      const rawItems = Array.isArray(data?.items) ? data.items : []
      console.log('[useDiscoveredItems] Raw items count:', rawItems.length)
      console.log('[useDiscoveredItems] Sample items:', rawItems.slice(0, 2).map((item: any) => ({
        id: item.id,
        title: item.title,
        hasEnrichedContent: !!item.enrichedContent,
        hasMediaAssets: !!item.mediaAssets,
        status: item.status,
        type: item.type
      })))
      
      // Map and deduplicate
      const mappedItems = rawItems.map(mapToDiscoveredItem)
      const dedupedItems = deduplicateItems(mappedItems)
      
      console.log('[useDiscoveredItems] Mapped items count:', mappedItems.length)
      console.log('[useDiscoveredItems] Deduplicated items count:', dedupedItems.length)
      console.log('[useDiscoveredItems] Sample mapped items:', dedupedItems.slice(0, 2).map((item: DiscoveredItem) => ({
        id: item.id,
        title: item.title,
        displayTitle: item.displayTitle,
        hasHero: !!item.media?.hero,
        hasSummary: !!item.content?.summary150,
        status: item.status
      })))
      
      setItems(dedupedItems)
      console.log('[useDiscoveredItems] Final items count:', dedupedItems.length)
      
    } catch (err) {
      console.error('[useDiscoveredItems] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch items')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [patchHandle, filters.status, filters.type, filters.sort, filters.timeRange])

  const refetch = useCallback(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchItems()
    
    // Listen for discovery completion events to trigger refetch
    const handleDiscoveryCompleted = (event: CustomEvent) => {
      const eventPatchHandle = event.detail?.patchHandle
      if (eventPatchHandle === patchHandle) {
        console.log('[useDiscoveredItems] Discovery completed event received, refetching...')
        fetchItems()
      }
    }
    
    window.addEventListener('discovery-completed', handleDiscoveryCompleted as EventListener)
    
    return () => {
      window.removeEventListener('discovery-completed', handleDiscoveryCompleted as EventListener)
    }
  }, [fetchItems, patchHandle])

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    items,
    isLoading,
    error,
    refetch
  }), [items, isLoading, error, refetch])
}