'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type DiscoveryPhase = 'idle' | 'searching' | 'processing' | 'paused' | 'completed' | 'error'

export interface DiscoveredItem {
  id: string
  title: string
  content?: string
  url?: string
  canonicalUrl?: string
  type: string
  relevanceScore?: number
  mediaAssets?: any
  createdAt?: string
  [key: string]: any
}

interface UseDiscoveryStreamProps {
  patchId: string
  batchSize?: number
}

export function useDiscoveryStream({ patchId, batchSize = 10 }: UseDiscoveryStreamProps) {
  const [state, setState] = useState<DiscoveryPhase>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [live, setLive] = useState(false)
  const [items, setItems] = useState<DiscoveredItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [autoLoop, setAutoLoop] = useState(false)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<string | null>(null)

  // Dedupe and upsert item
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
      
      return [newItem, ...prev]
    })
  }, [])

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return
    
    console.log('[Discovery] Starting polling fallback')
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const url = lastTimestampRef.current
          ? `/api/patch/${patchId}/discover?since=${lastTimestampRef.current}`
          : `/api/patch/${patchId}/discover`
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.items && data.items.length > 0) {
            data.items.forEach((item: DiscoveredItem) => upsertItem(item))
            lastTimestampRef.current = new Date().toISOString()
          }
          
          if (data.completed) {
            setState('completed')
            setLive(false)
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
        }
      } catch (err) {
        console.error('[Discovery] Polling error:', err)
      }
    }, 5000)
  }, [patchId, upsertItem])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Start discovery
  const start = useCallback(() => {
    console.log('[Discovery] Starting discovery stream')
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    stopPolling()
    
    // Reset state
    setState('searching')
    setDone(0)
    setTotal(0)
    setItems([])
    setError(null)
    setLive(true)
    lastTimestampRef.current = new Date().toISOString()
    
    // Check if EventSource is supported
    if (typeof EventSource === 'undefined') {
      console.warn('[Discovery] EventSource not supported, using polling fallback')
      startPolling()
      return
    }
    
    // Create SSE connection
    const streamUrl = `/api/patches/${patchId}/start-discovery?stream=true&batch=${batchSize}`
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource
    
    eventSource.addEventListener('state', (e) => {
      const data = JSON.parse(e.data)
      setState(data.phase)
      console.log('[Discovery] State:', data.phase)
    })
    
    eventSource.addEventListener('found', (e) => {
      const data = JSON.parse(e.data)
      setTotal(data.count)
      console.log('[Discovery] Found:', data.count, 'items')
    })
    
    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data)
      setDone(data.done)
      setTotal(data.total)
    })
    
    eventSource.addEventListener('item-ready', (e) => {
      const item = JSON.parse(e.data)
      upsertItem(item)
      setDone(prev => prev + 1)
      console.log('[Discovery] Item ready:', item.title)
    })
    
    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      setState('completed')
      setLive(false)
      setDone(data.done || done)
      console.log('[Discovery] Complete:', data)
      
      eventSource.close()
      eventSourceRef.current = null
      
      // Auto-loop if enabled
      if (autoLoop) {
        setTimeout(() => {
          console.log('[Discovery] Auto-restarting...')
          start()
        }, 1500)
      }
    })
    
    eventSource.addEventListener('error', (e: any) => {
      const data = e.data ? JSON.parse(e.data) : { message: 'Connection error' }
      setError(data.message)
      setState('error')
      setLive(false)
      console.error('[Discovery] Error:', data.message)
      
      eventSource.close()
      eventSourceRef.current = null
      
      // Fall back to polling
      console.log('[Discovery] Falling back to polling')
      startPolling()
    })
    
    eventSource.onerror = () => {
      console.warn('[Discovery] EventSource connection error, falling back to polling')
      setState('processing')
      setLive(false)
      
      eventSource.close()
      eventSourceRef.current = null
      
      startPolling()
    }
    
    eventSource.addEventListener('heartbeat', () => {
      // Just acknowledge connection is alive
    })
    
  }, [patchId, batchSize, autoLoop, done, upsertItem, startPolling, stopPolling])

  // Pause discovery
  const pause = useCallback(() => {
    console.log('[Discovery] Pausing')
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    stopPolling()
    
    setState('paused')
    setLive(false)
  }, [stopPolling])

  // Resume discovery  
  const resume = useCallback(() => {
    console.log('[Discovery] Resuming')
    start()
  }, [start])

  // Restart discovery
  const restart = useCallback(() => {
    console.log('[Discovery] Restarting')
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    stopPolling()
    
    setItems([])
    setDone(0)
    setTotal(0)
    setError(null)
    
    setTimeout(() => start(), 100)
  }, [start, stopPolling])

  // Refresh items
  const refresh = useCallback(async () => {
    console.log('[Discovery] Refreshing items')
    
    try {
      const response = await fetch(`/api/patches/${patchId}/discovered-content`)
      if (response.ok) {
        const data = await response.json()
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items)
          console.log('[Discovery] Refreshed:', data.items.length, 'items')
        }
      }
    } catch (err) {
      console.error('[Discovery] Refresh error:', err)
    }
  }, [patchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      stopPolling()
    }
  }, [stopPolling])

  return {
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
    error,
    autoLoop,
    setAutoLoop
  }
}

