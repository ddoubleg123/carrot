/**
 * Server-Sent Events (SSE) streaming for discovery events
 * Provides real-time feedback during content discovery
 */

export type DiscoveryEventType = 
  | 'start'
  | 'searching'
  | 'candidate'
  | 'skipped:duplicate'
  | 'skipped:low_relevance'
  | 'skipped:near_dup'
  | 'enriched'
  | 'hero_ready'
  | 'saved'
  | 'idle'
  | 'pause'
  | 'stop'
  | 'error'

export interface DiscoveryEvent {
  type: DiscoveryEventType
  timestamp: number
  data?: any
  message?: string
}

export interface DiscoveryStreamOptions {
  groupId: string
  maxItems?: number
  timeout?: number
  onEvent?: (event: DiscoveryEvent) => void
}

/**
 * SSE Event Stream for discovery
 */
export class DiscoveryEventStream {
  private controller: ReadableStreamDefaultController<Uint8Array>
  private isActive = true
  private eventCount = 0
  
  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller
  }
  
  /**
   * Send an event to the client
   */
  sendEvent(type: DiscoveryEventType, data?: any, message?: string): void {
    if (!this.isActive) return
    
    const event: DiscoveryEvent = {
      type,
      timestamp: Date.now(),
      data,
      message
    }
    
    const eventData = `data: ${JSON.stringify(event)}\n\n`
    this.controller.enqueue(new TextEncoder().encode(eventData))
    this.eventCount++
  }
  
  /**
   * Send start event
   */
  start(groupId: string): void {
    this.sendEvent('start', { groupId })
  }
  
  /**
   * Send searching event
   */
  searching(source: string): void {
    this.sendEvent('searching', { source })
  }
  
  /**
   * Send candidate event
   */
  candidate(url: string, title?: string): void {
    this.sendEvent('candidate', { url, title })
  }
  
  /**
   * Send skipped event
   */
  skipped(reason: 'duplicate' | 'low_relevance' | 'near_dup', url: string, info?: any): void {
    this.sendEvent(`skipped:${reason}` as DiscoveryEventType, { url, info })
  }
  
  /**
   * Send enriched event
   */
  enriched(title: string, summary?: string): void {
    this.sendEvent('enriched', { title, summary })
  }
  
  /**
   * Send hero ready event
   */
  heroReady(heroUrl: string, source: 'og' | 'twitter' | 'oembed' | 'inline' | 'video' | 'generated'): void {
    this.sendEvent('hero_ready', { heroUrl, source })
  }
  
  /**
   * Send saved event
   */
  saved(item: any): void {
    this.sendEvent('saved', { item })
  }
  
  /**
   * Send idle event
   */
  idle(reason?: string): void {
    this.sendEvent('idle', undefined, reason)
  }
  
  /**
   * Send pause event
   */
  pause(): void {
    this.sendEvent('pause')
  }
  
  /**
   * Send stop event
   */
  stop(reason?: string): void {
    this.sendEvent('stop', undefined, reason)
  }
  
  /**
   * Send error event
   */
  error(message: string, details?: any): void {
    this.sendEvent('error', { details }, message)
  }
  
  /**
   * Close the stream
   */
  close(): void {
    this.isActive = false
    this.controller.close()
  }
  
  /**
   * Get event count
   */
  getEventCount(): number {
    return this.eventCount
  }
  
  /**
   * Check if stream is active
   */
  isStreamActive(): boolean {
    return this.isActive
  }
}

/**
 * Create SSE response for discovery streaming
 */
export function createDiscoveryStream(
  options: DiscoveryStreamOptions
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const eventStream = new DiscoveryEventStream(controller)
      
      // Send initial start event
      eventStream.start(options.groupId)
      
      // Store stream reference for external control
      ;(globalThis as any).discoveryStreams = (globalThis as any).discoveryStreams || new Map()
      ;(globalThis as any).discoveryStreams.set(options.groupId, eventStream)
      
      // Set up timeout
      if (options.timeout) {
        setTimeout(() => {
          eventStream.stop('Timeout reached')
          eventStream.close()
        }, options.timeout)
      }
      
      // Set up event handler
      if (options.onEvent) {
        // This would need to be implemented with a proper event system
        // For now, we'll handle events in the discovery loop
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

/**
 * Get active stream for a group
 */
export function getActiveStream(groupId: string): DiscoveryEventStream | null {
  const streams = (globalThis as any).discoveryStreams
  return streams?.get(groupId) || null
}

/**
 * Close stream for a group
 */
export function closeStream(groupId: string): void {
  const streams = (globalThis as any).discoveryStreams
  const stream = streams?.get(groupId)
  if (stream) {
    stream.close()
    streams.delete(groupId)
  }
}

/**
 * Discovery state management
 */
export class DiscoveryState {
  private static states = new Map<string, {
    isActive: boolean
    isPaused: boolean
    currentItem?: string
    itemsFound: number
    startTime: number
  }>()
  
  static start(groupId: string): void {
    this.states.set(groupId, {
      isActive: true,
      isPaused: false,
      itemsFound: 0,
      startTime: Date.now()
    })
  }
  
  static pause(groupId: string): void {
    const state = this.states.get(groupId)
    if (state) {
      state.isPaused = true
    }
  }
  
  static resume(groupId: string): void {
    const state = this.states.get(groupId)
    if (state) {
      state.isPaused = false
    }
  }
  
  static stop(groupId: string): void {
    this.states.delete(groupId)
  }
  
  static isActive(groupId: string): boolean {
    const state = this.states.get(groupId)
    return state?.isActive && !state?.isPaused || false
  }
  
  static isPaused(groupId: string): boolean {
    const state = this.states.get(groupId)
    return state?.isPaused || false
  }
  
  static incrementItems(groupId: string): void {
    const state = this.states.get(groupId)
    if (state) {
      state.itemsFound++
    }
  }
  
  static getStats(groupId: string): {
    isActive: boolean
    isPaused: boolean
    itemsFound: number
    duration: number
  } | null {
    const state = this.states.get(groupId)
    if (!state) return null
    
    return {
      isActive: state.isActive,
      isPaused: state.isPaused,
      itemsFound: state.itemsFound,
      duration: Date.now() - state.startTime
    }
  }
}
