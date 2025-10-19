'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DiscoveredItem } from '@/types/discovered-content'

export type DiscoveryPhase = 'idle' | 'searching' | 'processing' | 'paused' | 'error'

interface UseDiscoveryStreamSingleProps {
  patchHandle: string
}

export function useDiscoveryStreamSingle({ patchHandle }: UseDiscoveryStreamSingleProps) {
  const [state, setState] = useState<DiscoveryPhase>('idle')
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const [statusText, setStatusText] = useState('Loading content...')
  const [lastItemTitle, setLastItemTitle] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const eventSourceRef = useRef<EventSource | null>(null)

  // Upsert item (dedupe by canonicalUrl)
  const upsertItem = useCallback((newItem: DiscoveredItem) => {
    setItems(prev => {
      const key = newItem.canonicalUrl || newItem.id
      const existingIndex = prev.findIndex(
        item => (item.canonicalUrl || item.id) === key
      )
      
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = newItem
        return updated
      }
      
      // Prepend new item
      return [newItem, ...prev]
    })
  }, [])

  // Start discovery
  const start = useCallback(() => {
    console.log('[Discovery] Starting single-item discovery')
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    // Reset state
    setState('searching')
    setStatusText('Searching…')
    setError(null)
    setLive(true)
    setSessionCount(0)
    setLastItemTitle(null)
    
    // Create EventSource - use existing working endpoint with stream=true
    const streamUrl = `/api/patches/${patchHandle}/start-discovery?stream=true`
    
    console.log('[Discovery] Opening SSE connection:', streamUrl)
    
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource
    
    eventSource.addEventListener('discovery:start', () => {
      setState('searching')
      setStatusText('Searching…')
    })
    
    eventSource.addEventListener('discovery:searching', () => {
      setStatusText('Searching for content…')
    })
    
    eventSource.addEventListener('discovery:candidate', (e) => {
      const data = JSON.parse(e.data)
      setStatusText(`Found candidate from ${data.sourceDomain}`)
    })
    
    eventSource.addEventListener('discovery:fetching', (e) => {
      const data = JSON.parse(e.data)
      setStatusText('Fetching content…')
    })
    
    eventSource.addEventListener('discovery:imagizing:start', () => {
      setStatusText('Generating image…')
    })
    
    eventSource.addEventListener('discovery:saved', (e) => {
      const data = JSON.parse(e.data)
      const item = data.item
      
      // Transform the item to ensure consistent structure
      const transformedItem = transformToDiscoveredItem(item)
      upsertItem(transformedItem)
      setLastItemTitle(item.title)
      setStatusText(`Item added: ${item.title.substring(0, 40)}...`)
      setState('processing')
    })
    
    eventSource.addEventListener('discovery:imagizing:update', (e) => {
      const data = JSON.parse(e.data)
      // Update hero for item silently
      setItems(prev => prev.map(item => 
        item.id === data.itemId 
          ? { ...item, media: { ...item.media, hero: data.hero } }
          : item
      ))
    })
    
    eventSource.addEventListener('discovery:cycle', (e) => {
      const data = JSON.parse(e.data)
      setSessionCount(data.count)
    })
    
    eventSource.addEventListener('discovery:error', (e) => {
      const data = JSON.parse(e.data)
      console.warn('[Discovery] Error:', data.message)
      // Don't stop on errors, just log them
    })
    
    eventSource.addEventListener('discovery:complete', () => {
      setState('idle')
      setStatusText('Discovery complete')
      setLive(false)
      eventSource.close()
      eventSourceRef.current = null
    })
    
    eventSource.onerror = () => {
      console.error('[Discovery] Connection lost')
      setStatusText('Paused (connection lost)')
      setState('paused')
      setLive(false)
      eventSource.close()
      eventSourceRef.current = null
    }
    
    eventSource.addEventListener('heartbeat', () => {
      // Just acknowledge
    })
    
  }, [patchHandle, upsertItem])

  // Pause discovery
  const pause = useCallback(async () => {
    console.log('[Discovery] Pausing')
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    setState('paused')
    setStatusText('Paused — resume when ready')
    setLive(false)
    
    // Call control API
    await fetch(`/api/patches/${patchHandle}/discovery/control?action=pause`, {
      method: 'POST'
    }).catch(() => {})
    
  }, [patchHandle])

  // Resume discovery
  const resume = useCallback(() => {
    console.log('[Discovery] Resuming')
    start()
  }, [start])

  // Transform API data to DiscoveredItem format
  const transformToDiscoveredItem = useCallback((item: any): DiscoveredItem => {
    console.log('[Transform] TRANSFORMATION CALLED for item:', item.id, item.title)
    
    // Extract media assets
    const mediaAssets = item.mediaAssets || {}
    const heroImage = mediaAssets.hero || mediaAssets.heroImage
    
    // Extract metadata
    const metadata = item.metadata || {}
    const enrichedContent = item.enrichedContent || {}
    
    // Debug logging - show the full structure
    console.log('[Transform] Full item structure:', {
      id: item.id,
      title: item.title,
      metadata: item.metadata,
      metadataType: typeof item.metadata,
      metadataKeys: item.metadata ? Object.keys(item.metadata) : 'no metadata',
      contentUrl: metadata.contentUrl,
      urlSlug: metadata.urlSlug
    });
    
    return {
      id: item.id,
      type: item.type || 'article',
      title: item.title || 'Untitled',
      displayTitle: item.title,
      url: item.url || item.sourceUrl || '',
      canonicalUrl: item.canonicalUrl,
      matchPct: item.relevanceScore,
      status: item.status === 'ready' ? 'ready' : 'pending_audit',
      media: {
        hero: heroImage,
        source: mediaAssets.source || 'generated',
        license: mediaAssets.license || 'generated'
      },
      content: {
        summary150: enrichedContent.summary || item.description || '',
        keyPoints: enrichedContent.keyPoints || [],
        readingTimeMin: enrichedContent.readingTimeMin
      },
      meta: {
        sourceDomain: metadata.sourceDomain || (item.url ? new URL(item.url).hostname : 'unknown'),
        author: metadata.author,
        publishDate: metadata.publishDate || item.createdAt
      },
      metadata: {
        contentUrl: metadata.contentUrl,
        urlSlug: metadata.urlSlug
      }
    }
  }, [])

  // Refresh items
  const refresh = useCallback(async () => {
    console.log('[Discovery] Refreshing items')
    setIsLoading(true)
    setStatusText('Loading content...')
    
    try {
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?limit=6&offset=0`)
      if (response.ok) {
        const data = await response.json()
        console.log('[Discovery] API Response:', data)
        if (data.items && Array.isArray(data.items)) {
          console.log('[Discovery] About to transform', data.items.length, 'items')
          const transformedItems = data.items.map(transformToDiscoveredItem)
          setItems(transformedItems)
          console.log('[Discovery] Loaded', transformedItems.length, 'existing items')
          setStatusText(transformedItems.length > 0 ? 'Ready to discover content' : 'No content yet')
        }
      }
    } catch (err) {
      console.error('[Discovery] Refresh error:', err)
      setStatusText('Error loading content')
    } finally {
      setIsLoading(false)
    }
  }, [patchHandle, transformToDiscoveredItem])

  // Load existing content on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    start,
    pause,
    resume,
    refresh,
    state,
    live,
    items,
    statusText,
    lastItemTitle,
    sessionCount,
    error,
    isLoading
  }
}

