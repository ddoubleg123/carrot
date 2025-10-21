'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DiscoveredItem } from '@/types/discovered-content'

interface DiscoveryStreamState {
  isActive: boolean
  isPaused: boolean
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
}

interface UseDiscoveryStreamReturn {
  state: DiscoveryStreamState
  items: DiscoveredItem[]
  start: () => void
  pause: () => void
  stop: () => void
  refresh: () => void
}

export function useDiscoveryStream(patchHandle: string): UseDiscoveryStreamReturn {
  const [state, setState] = useState<DiscoveryStreamState>({
    isActive: false,
    isPaused: false,
    currentStatus: '',
    itemsFound: 0
  })
  
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Start discovery
  const start = useCallback(async () => {
    try {
      // Start discovery via API
      const response = await fetch(`/api/patches/${patchHandle}/discovery/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to start discovery: ${response.status}`)
      }
      
      // Start SSE connection
      startSSEConnection()
      
    } catch (error) {
      console.error('[DiscoveryStream] Failed to start:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start discovery'
      }))
    }
  }, [patchHandle])

  // Pause discovery
  const pause = useCallback(async () => {
    try {
      await fetch(`/api/patches/${patchHandle}/discovery/pause`, {
        method: 'POST'
      })
      
      setState(prev => ({
        ...prev,
        isPaused: !prev.isPaused
      }))
    } catch (error) {
      console.error('[DiscoveryStream] Failed to pause:', error)
    }
  }, [patchHandle])

  // Stop discovery
  const stop = useCallback(async () => {
    try {
      await fetch(`/api/patches/${patchHandle}/discovery/stop`, {
        method: 'POST'
      })
      
      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      setState({
        isActive: false,
        isPaused: false,
        currentStatus: '',
        itemsFound: 0
      })
      
    } catch (error) {
      console.error('[DiscoveryStream] Failed to stop:', error)
    }
  }, [patchHandle])

  // Refresh items
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?limit=20`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
        setState(prev => ({
          ...prev,
          itemsFound: data.items?.length || 0
        }))
      }
    } catch (error) {
      console.error('[DiscoveryStream] Failed to refresh:', error)
    }
  }, [patchHandle])

  // Start SSE connection
  const startSSEConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    const eventSource = new EventSource(`/api/patches/${patchHandle}/discovery/stream`)
    eventSourceRef.current = eventSource
    
    eventSource.onopen = () => {
      console.log('[DiscoveryStream] SSE connection opened')
      setState(prev => ({
        ...prev,
        isActive: true,
        isPaused: false,
        error: undefined
      }))
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleSSEEvent(data)
      } catch (error) {
        console.error('[DiscoveryStream] Failed to parse SSE data:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('[DiscoveryStream] SSE error:', error)
      setState(prev => ({
        ...prev,
        error: 'Connection lost. Attempting to reconnect...'
      }))
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (state.isActive) {
          startSSEConnection()
        }
      }, 5000)
    }
  }, [patchHandle, state.isActive])

  // Handle SSE events
  const handleSSEEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'start':
        setState(prev => ({
          ...prev,
          isActive: true,
          isPaused: false,
          currentStatus: 'Starting discovery...',
          itemsFound: 0
        }))
        break
        
      case 'searching':
        setState(prev => ({
          ...prev,
          currentStatus: `Searching ${event.data?.source || 'sources'}...`
        }))
        break
        
      case 'candidate':
        setState(prev => ({
          ...prev,
          currentStatus: `Processing: ${event.data?.title || event.data?.url}`
        }))
        break
        
      case 'skipped:duplicate':
        setState(prev => ({
          ...prev,
          currentStatus: 'Skipped: Duplicate content'
        }))
        break
        
      case 'skipped:low_relevance':
        setState(prev => ({
          ...prev,
          currentStatus: 'Skipped: Low relevance score'
        }))
        break
        
      case 'skipped:near_dup':
        setState(prev => ({
          ...prev,
          currentStatus: 'Skipped: Similar content found'
        }))
        break
        
      case 'enriched':
        setState(prev => ({
          ...prev,
          currentStatus: `Enriched: ${event.data?.title}`
        }))
        break
        
      case 'hero_ready':
        setState(prev => ({
          ...prev,
          currentStatus: 'Hero image ready'
        }))
        break
        
      case 'saved':
        const newItem = event.data?.item
        if (newItem) {
          setItems(prev => [newItem, ...prev])
          setState(prev => ({
            ...prev,
            itemsFound: prev.itemsFound + 1,
            lastItemTitle: newItem.title,
            currentStatus: `Saved: ${newItem.title}`
          }))
        }
        break
        
      case 'idle':
        setState(prev => ({
          ...prev,
          currentStatus: event.message || 'Discovery idle'
        }))
        break
        
      case 'pause':
        setState(prev => ({
          ...prev,
          isPaused: true,
          currentStatus: 'Discovery paused'
        }))
        break
        
      case 'stop':
        setState(prev => ({
          ...prev,
          isActive: false,
          isPaused: false,
          currentStatus: 'Discovery stopped'
        }))
        break
        
      case 'error':
        setState(prev => ({
          ...prev,
          error: event.message || 'Discovery error occurred'
        }))
        break
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  // Initial refresh
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    state,
    items,
    start,
    pause,
    stop,
    refresh
  }
}
