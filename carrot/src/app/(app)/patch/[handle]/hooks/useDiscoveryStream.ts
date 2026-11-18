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
  readLink: (url: string) => Promise<string | null>
  ask: (question: string) => Promise<any>
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
  const learnAbortRef = useRef<AbortController | null>(null)

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const startSSEConnection = useCallback((runId: string) => {
    closeEventSource()

    const streamUrl = `/api/patches/${patchHandle}/discovery/stream?runId=${encodeURIComponent(runId)}`
    console.log('[DiscoveryStream] Creating EventSource for:', streamUrl)
    
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource
    activeRunIdRef.current = runId

    eventSource.onopen = () => {
      console.log('[DiscoveryStream] SSE connection opened')
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

  const runLearn = useCallback(async (options?: { url?: string; question?: string }) => {
    learnAbortRef.current?.abort()
    const controller = new AbortController()
    learnAbortRef.current = controller
    const question = options?.question?.trim()
    setState(prev => ({
      ...prev,
      isActive: true,
      isPaused: false,
      currentStage: 'searching',
      currentStatus: options?.url
        ? 'Reading that link…'
        : question
          ? `Looking up “${question}”…`
          : 'Reading sources…',
      error: undefined,
      runState: 'live'
    }))

    try {
      const response = await fetch(`/api/patches/${patchHandle}/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options?.url ? { url: options.url } : { question: question || '' }),
        signal: controller.signal
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Could not save that knowledge')
      }
      await refresh()
      const savedCount = Array.isArray(data.saved) ? data.saved.length : 0
      setState(prev => ({
        ...prev,
        isActive: false,
        currentStage: 'saved',
        currentStatus: data.message || (savedCount ? `Saved ${savedCount} sources` : 'Nothing new was saved'),
        lastItemTitle: data.saved?.[0]?.title,
        totalSaved: savedCount || prev.totalSaved,
        runState: undefined,
        error: undefined
      }))
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          isActive: false,
          currentStatus: 'Stopped',
          runState: undefined
        }))
        return null
      }
      const message = error instanceof Error ? error.message : 'Could not save that knowledge'
      setState(prev => ({
        ...prev,
        isActive: false,
        error: message,
        currentStatus: '',
        runState: undefined
      }))
      return message
    }
  }, [patchHandle, refresh])

  const start = useCallback(async () => {
    await runLearn()
  }, [runLearn])

  const readLink = useCallback(async (url: string) => {
    const data = await runLearn({ url })
    if (!data || typeof data === 'string') return data
    return data.message || null
  }, [runLearn])

  const ask = useCallback(async (question: string) => {
    return runLearn({ question })
  }, [runLearn])

  const pause = useCallback(async () => {
    learnAbortRef.current?.abort()
    learnAbortRef.current = null
    setState(prev => ({
      ...prev,
      isActive: false,
      isPaused: false,
      currentStatus: 'Stopped',
      runState: undefined
    }))
  }, [])

  const stop = useCallback(async () => {
    learnAbortRef.current?.abort()
    learnAbortRef.current = null
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
      currentStatus: 'Stopped',
      itemsFound: items.length,
      runId: undefined,
      runState: undefined
    }))
  }, [closeEventSource, items.length])

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
    refresh,
    readLink,
    ask
  }
}
