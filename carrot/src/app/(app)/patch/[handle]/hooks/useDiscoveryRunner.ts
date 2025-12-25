'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

type DiscoveryState = 'idle' | 'running' | 'paused' | 'completed'

interface DiscoveryRunnerConfig {
  batchSize?: number
  autoLoop?: boolean
  delayBetweenBatches?: number
}

interface UseDiscoveryRunnerReturn {
  state: DiscoveryState
  count: number
  totalProcessed: number
  error: string | null
  start: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  refresh: () => void
  setAutoLoop: (enabled: boolean) => void
}

export function useDiscoveryRunner(
  patchHandle: string,
  config: DiscoveryRunnerConfig = {}
): UseDiscoveryRunnerReturn {
  const {
    batchSize = 10,
    autoLoop = true,
    delayBetweenBatches = 2000
  } = config

  const [state, setState] = useState<DiscoveryState>('idle')
  const [count, setCount] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [autoLoopEnabled, setAutoLoopEnabled] = useState(autoLoop)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)

  const startDiscovery = useCallback(async () => {
    if (state === 'running') return

    setState('running')
    currentIndexRef.current = 0
    setCount(0)

    // Create abort controller for this batch
    abortControllerRef.current = new AbortController()

    try {
      setError(null)
      console.log('[DiscoveryRunner] Starting discovery for patch:', patchHandle)
      
      const response = await fetch(`/api/patches/${patchHandle}/start-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_deepseek_search'
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        const errorMessage = errorData.error || `Discovery failed: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('[DiscoveryRunner] Discovery started successfully:', result)

      // Start the batch processing loop
      processBatch()

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[DiscoveryRunner] Discovery aborted')
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to start discovery'
      console.error('[DiscoveryRunner] Discovery failed:', errorMessage, error)
      setError(errorMessage)
      setState('idle')
    }
  }, [patchHandle, state])

  const processBatch = useCallback(async () => {
    if (state !== 'running') return

    try {
      // Simulate processing items in the current batch
      // In a real implementation, this would poll for new discovered items
      const batchProgress = Math.min(currentIndexRef.current + 1, batchSize)
      setCount(batchProgress)

      if (batchProgress >= batchSize) {
        // Batch complete
        setTotalProcessed(prev => prev + batchSize)
        setState('completed')
        
        // Auto-restart if enabled
        if (autoLoopEnabled) {
          console.log('[DiscoveryRunner] Auto-restarting after delay')
          setTimeout(() => {
            if (autoLoopEnabled) {
              restart()
            }
          }, delayBetweenBatches)
        }
      } else {
        // Continue processing
        currentIndexRef.current++
        
        // Schedule next item processing
        intervalRef.current = setTimeout(() => {
          processBatch()
        }, 500) // Process one item every 500ms
      }

    } catch (error) {
      console.error('[DiscoveryRunner] Batch processing error:', error)
      setState('idle')
    }
  }, [state, batchSize, autoLoopEnabled, delayBetweenBatches])

  const pause = useCallback(() => {
    if (state !== 'running') return

    setState('paused')
    
    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }

    console.log('[DiscoveryRunner] Discovery paused')
  }, [state])

  const resume = useCallback(() => {
    if (state !== 'paused') return

    setState('running')
    processBatch()

    console.log('[DiscoveryRunner] Discovery resumed')
  }, [state, processBatch])

  const restart = useCallback(() => {
    // Clean up any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }

    setCount(0)
    setTotalProcessed(0)
    currentIndexRef.current = 0
    
    startDiscovery()

    console.log('[DiscoveryRunner] Discovery restarted')
  }, [startDiscovery])

  const refresh = useCallback(() => {
    // Trigger a silent refetch of discovered content
    window.dispatchEvent(new CustomEvent('discovery-completed', { 
      detail: { patchHandle } 
    }))
    
    console.log('[DiscoveryRunner] Content refreshed')
  }, [patchHandle])

  const setAutoLoop = useCallback((enabled: boolean) => {
    setAutoLoopEnabled(enabled)
    console.log('[DiscoveryRunner] Auto-loop:', enabled ? 'enabled' : 'disabled')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
    }
  }, [])

  return {
    state,
    count,
    totalProcessed,
    error,
    start: startDiscovery,
    pause,
    resume,
    restart,
    refresh,
    setAutoLoop
  }
}
