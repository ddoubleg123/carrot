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
  heroReady(heroUrl: string, source: 'og' | 'twitter' | 'oembed' | 'inline' | 'video' | 'generated' | 'ai' | 'wikimedia' | 'minsvg'): void {
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
  stop(): void {
    this.sendEvent('stop')
    this.isActive = false
  }
  
  /**
   * Send error event
   */
  error(message: string, details?: any): void {
    this.sendEvent('error', details, message)
  }
  
  /**
   * Close the stream
   */
  close(): void {
    this.isActive = false
    try {
      this.controller.close()
    } catch (error) {
      // Stream may already be closed
    }
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
 * Discovery state management
 */
export interface DiscoveryState {
  isActive: boolean
  isPaused: boolean
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
}

export class DiscoveryStateManager {
  private state: DiscoveryState = {
    isActive: false,
    isPaused: false,
    currentStatus: '',
    itemsFound: 0
  }
  
  private listeners = new Set<(state: DiscoveryState) => void>()
  
  /**
   * Update state and notify listeners
   */
  updateState(updates: Partial<DiscoveryState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }
  
  /**
   * Get current state
   */
  getState(): DiscoveryState {
    return { ...this.state }
  }
  
  /**
   * Add state listener
   */
  addListener(listener: (state: DiscoveryState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  
  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state)
      } catch (error) {
        console.error('Error in state listener:', error)
      }
    })
  }
  
  /**
   * Reset state
   */
  reset(): void {
    this.state = {
      isActive: false,
      isPaused: false,
      currentStatus: '',
      itemsFound: 0
    }
    this.notifyListeners()
  }
}

/**
 * Global discovery state manager
 */
export const discoveryStateManager = new DiscoveryStateManager()