'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DiscoveryCardPayload } from '@/types/discovery-card'

type DiscoveryStage = 'searching' | 'vetting' | 'hero' | 'saved'

interface DiscoveryStreamState {
  isActive: boolean
  isPaused: boolean
  currentStage?: DiscoveryStage
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
  runId?: string
  duplicatesSkipped: number
  lowRelevanceSkipped: number
  nearDuplicateSkipped: number
  frontierSize: number
  totalDuplicates: number
  totalSkipped: number
  totalSaved: number
  runState?: 'live' | 'paused' | 'suspended'
}

interface UseDiscoveryStreamReturn {
  state: DiscoveryStreamState
  items: DiscoveryCardPayload[]
  start: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  refresh: () => Promise<void>
}

const stageMessages: Record<DiscoveryStage, string> = {
  searching: 'Searching for new sources…',
  vetting: 'Vetting evidence and extracting facts…',
  hero: 'Generating hero image…',
  saved: 'Card saved'
}

export function useDiscoveryStream(patchHandle: string): UseDiscoveryStreamReturn {
  const [state, setState] = useState<DiscoveryStreamState>({
    isActive: false,
    isPaused: false,
    currentStatus: '',
    itemsFound: 0,
    duplicatesSkipped: 0,
    lowRelevanceSkipped: 0,
    nearDuplicateSkipped: 0,
    frontierSize: 0,
    totalDuplicates: 0,
    totalSkipped: 0,
    totalSaved: 0,
    runState: undefined
  })

  const [items, setItems] = useState<DiscoveryCardPayload[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRunIdRef = useRef<string | null>(null)

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const startSSEConnection = useCallback((runId: string) => {
    closeEventSource()

    const eventSource = new EventSource(`/api/patches/${patchHandle}/discovery/stream?runId=${encodeURIComponent(runId)}`)
    eventSourceRef.current = eventSource
    activeRunIdRef.current = runId

    eventSource.onopen = () => {
      setState(prev => ({
        ...prev,
        isActive: true,
        isPaused: false,
        error: undefined,
        runId
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
        error: 'Connection lost. Reconnecting…'
      }))

      closeEventSource()

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (activeRunIdRef.current) {
          startSSEConnection(activeRunIdRef.current)
        }
      }, 3000)
    }
  }, [closeEventSource, patchHandle])

  const refresh = useCallback(async () => {
    try {
      // Always fetch from API, even if run failed - items exist in DB
      // Use new API shape with cursor pagination
      const url = `/api/patches/${patchHandle}/discovered-content?limit=50`
      console.log('[DiscoveryStream] Fetching from:', url)
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      console.log('[DiscoveryStream] Response status:', response.status, response.statusText)
      
      // New API shape: { success, items, cursor, hasMore, totals, isActive, debug }
      // Never throws 500 - always returns 200 with success/error status
      const data = await response.json()
      console.log('[DiscoveryStream] Response data:', {
        success: data.success,
        itemsCount: Array.isArray(data.items) ? data.items.length : 0,
        totals: data.totals,
        isActive: data.isActive,
        hasMore: data.hasMore,
        debug: data.debug
      })
      
      // Handle error response (success: false but 200 status)
      if (!data.success) {
        const errorMsg = data.error?.msg || data.message || 'Failed to load discovered content'
        console.error('[DiscoveryStream] API returned error:', errorMsg, data.debug)
        setState(prev => ({
          ...prev,
          error: errorMsg
        }))
        // Still set items to empty array (don't break UI)
        setItems([])
        return
      }
      
      const payload: DiscoveryCardPayload[] = Array.isArray(data.items) ? data.items : []
      
      if (payload.length === 0 && data.debug) {
        console.warn('[DiscoveryStream] Empty payload with debug info:', data.debug)
      }
      
      // Update state with new API shape data
      setItems(payload)
      setState(prev => ({
        ...prev,
        itemsFound: payload.length,
        // Use totals from API (DB truth)
        totalSaved: data.totals?.total || data.totals?.items || payload.length,
        // Clear error if we got successful response
        error: undefined
      }))
    } catch (error) {
      console.error('[DiscoveryStream] Failed to refresh:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to refresh'
      }))
    }
  }, [patchHandle])

  const start = useCallback(async () => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/start-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const message = await response.json().catch(() => null)
        const errorText = message?.error || `Failed to start discovery: ${response.status}`
        throw new Error(errorText)
      }

      const data = await response.json()
      const runId = data?.runId
      if (!runId) {
        throw new Error('Discovery run failed to initialize')
      }

      setState(prev => ({
        ...prev,
        isActive: true,
        isPaused: false,
        currentStage: 'searching',
        currentStatus: 'Starting discovery…',
        error: undefined,
        runId,
        duplicatesSkipped: 0,
        lowRelevanceSkipped: 0,
        nearDuplicateSkipped: 0,
        frontierSize: 0,
        totalDuplicates: 0,
        totalSkipped: 0,
        totalSaved: 0,
        runState: 'live'
      }))

      startSSEConnection(runId)
    } catch (error) {
      console.error('[DiscoveryStream] Failed to start:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start discovery'
      }))
    }
  }, [patchHandle, startSSEConnection])

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

  const stop = useCallback(async () => {
    try {
      await fetch(`/api/patches/${patchHandle}/discovery/stop`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('[DiscoveryStream] Failed to stop:', error)
    } finally {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      activeRunIdRef.current = null
      closeEventSource()
      setState(prev => ({
        ...prev,
        isActive: false,
        isPaused: false,
        currentStatus: '',
        itemsFound: items.length,
        runId: undefined
      }))
    }
  }, [closeEventSource, items.length, patchHandle])

  const handleSSEEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'start': {
        setState(prev => ({
          ...prev,
          isActive: true,
          isPaused: false,
          currentStage: 'searching',
          currentStatus: 'Starting discovery…',
          duplicatesSkipped: 0,
          lowRelevanceSkipped: 0,
          nearDuplicateSkipped: 0,
          runState: 'live'
        }))
        break
      }

      case 'stage': {
        const phase = event.data?.phase as DiscoveryStage | undefined
        setState(prev => ({
          ...prev,
          currentStage: phase,
          currentStatus: phase ? stageMessages[phase] : prev.currentStatus
        }))
        break
      }

      case 'searching': {
        const source = event.data?.source
        setState(prev => ({
          ...prev,
          currentStatus: source ? `Searching ${source}…` : 'Searching sources…',
          currentStage: prev.currentStage ?? 'searching'
        }))
        break
      }

      case 'candidate': {
        const name = event.data?.title || event.data?.url
        setState(prev => ({
          ...prev,
          currentStatus: name ? `Processing ${name}` : 'Processing candidate…'
        }))
        break
      }

      case 'skipped:duplicate':
        setState(prev => ({
          ...prev,
          currentStatus: 'Duplicate detected – skipping',
          duplicatesSkipped: prev.duplicatesSkipped + 1
        }))
        break

      case 'skipped:low_relevance':
        setState(prev => ({
          ...prev,
          currentStatus: 'Low relevance – skipping',
          lowRelevanceSkipped: prev.lowRelevanceSkipped + 1
        }))
        break

      case 'skipped:near_dup':
        setState(prev => ({
          ...prev,
          currentStatus: 'Near-duplicate – skipping',
          nearDuplicateSkipped: prev.nearDuplicateSkipped + 1
        }))
        break

      case 'hero_ready':
        setState(prev => ({
          ...prev,
          currentStatus: 'Hero image ready',
          currentStage: 'hero'
        }))
        break

      case 'saved': {
        const newItem: DiscoveryCardPayload | undefined = event.data?.item
        if (newItem) {
          setItems(prev => {
            const existing = new Set(prev.map(item => item.canonicalUrl))
            if (existing.has(newItem.canonicalUrl)) {
              return prev
            }
            return [newItem, ...prev]
          })
          setState(prev => ({
            ...prev,
            itemsFound: prev.itemsFound + 1,
            lastItemTitle: newItem.title,
            currentStatus: `Saved: ${newItem.title}`,
            currentStage: 'saved'
          }))
        }
        break
      }

      case 'idle':
        setState(prev => ({
          ...prev,
          currentStatus: event.message || 'Discovery idle',
          currentStage: prev.currentStage === 'saved' ? prev.currentStage : prev.currentStage
        }))
        break

      case 'pause':
        setState(prev => ({
          ...prev,
          isPaused: true,
          currentStatus: 'Discovery paused',
          runState: 'paused'
        }))
        break

      case 'stop':
        activeRunIdRef.current = null
        setState(prev => ({
          ...prev,
          isActive: false,
          isPaused: false,
          currentStatus: 'Discovery completed',
          runState: 'suspended'
        }))
        closeEventSource()
        break

      case 'error':
        setState(prev => ({
          ...prev,
          error: event.message || 'Discovery error occurred'
        }))
        break

      case 'metrics': {
        const metrics = event.data || {}
        setState(prev => ({
          ...prev,
          frontierSize: typeof metrics.frontier === 'number' ? metrics.frontier : prev.frontierSize,
          totalDuplicates: typeof metrics.duplicates === 'number' ? metrics.duplicates : prev.totalDuplicates,
          totalSkipped: typeof metrics.skipped === 'number' ? metrics.skipped : prev.totalSkipped,
          // Prefer DB truth from API refresh over stream metrics
          totalSaved: typeof metrics.saved === 'number' ? metrics.saved : prev.totalSaved,
          runState: metrics.runState ?? prev.runState
        }))
        break
      }

      default:
        break
    }
  }, [closeEventSource])

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      closeEventSource()
    }
  }, [closeEventSource])

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
