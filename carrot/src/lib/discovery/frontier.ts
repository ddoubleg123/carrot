/**
 * Search frontier with priority scoring for discovery
 * Manages multiple sources with cursors and priority-based selection
 */

export interface FrontierItem {
  id: string
  source: string
  method: string
  cursor: string
  priority: number
  lastUsed: Date
  backoffUntil?: Date
  duplicateRate: number
  successRate: number
}

export interface SearchResult {
  urls: string[]
  nextCursor: string
  hasMore: boolean
  metadata?: Record<string, any>
}

export interface SearchProvider {
  name: string
  fetch(cursor: string, limit: number): Promise<SearchResult>
  canBackoff(item: FrontierItem): boolean
  getBackoffDuration(item: FrontierItem): number
}

/**
 * Priority-based search frontier
 */
export class SearchFrontier {
  private items: Map<string, FrontierItem> = new Map()
  private providers: Map<string, SearchProvider> = new Map()
  private groupId: string
  
  constructor(groupId: string) {
    this.groupId = groupId
  }
  
  /**
   * Register a search provider
   */
  registerProvider(provider: SearchProvider): void {
    this.providers.set(provider.name, provider)
  }
  
  /**
   * Add or update a frontier item
   */
  addItem(item: Omit<FrontierItem, 'id' | 'lastUsed'>): string {
    const id = `${item.source}:${item.method}:${item.cursor}`
    
    this.items.set(id, {
      ...item,
      id,
      lastUsed: new Date()
    })
    
    return id
  }
  
  /**
   * Get the highest priority item that's not in backoff
   */
  getNextItem(): FrontierItem | null {
    const now = new Date()
    const availableItems = Array.from(this.items.values())
      .filter(item => {
        // Skip if in backoff
        if (item.backoffUntil && item.backoffUntil > now) {
          return false
        }
        
        // Skip if provider can't be used
        const provider = this.providers.get(item.source)
        if (!provider || provider.canBackoff(item)) {
          return false
        }
        
        return true
      })
      .sort((a, b) => b.priority - a.priority)
    
    return availableItems[0] || null
  }
  
  /**
   * Update item after successful fetch
   */
  updateItemSuccess(id: string, newCursor: string, urlsFound: number): void {
    const item = this.items.get(id)
    if (!item) return
    
    // Update cursor
    item.cursor = newCursor
    item.lastUsed = new Date()
    
    // Update success rate (exponential moving average)
    const alpha = 0.1
    item.successRate = alpha * (urlsFound > 0 ? 1 : 0) + (1 - alpha) * item.successRate
    
    // Recalculate priority
    item.priority = this.calculatePriority(item)
    
    this.items.set(id, item)
  }
  
  /**
   * Update item after failure (backoff)
   */
  updateItemFailure(id: string, reason: 'duplicate' | 'low_relevance' | 'error'): void {
    const item = this.items.get(id)
    if (!item) return
    
    // Update duplicate rate
    if (reason === 'duplicate') {
      const alpha = 0.1
      item.duplicateRate = alpha * 1 + (1 - alpha) * item.duplicateRate
    }
    
    // Apply backoff
    const provider = this.providers.get(item.source)
    if (provider) {
      const backoffDuration = provider.getBackoffDuration(item)
      item.backoffUntil = new Date(Date.now() + backoffDuration)
    }
    
    // Recalculate priority
    item.priority = this.calculatePriority(item)
    
    this.items.set(id, item)
  }
  
  /**
   * Calculate priority score for an item
   */
  private calculatePriority(item: FrontierItem): number {
    const now = new Date()
    const recencyDays = (now.getTime() - item.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
    
    // Novelty factor (higher for older items)
    const novelty = 1 / (1 + recencyDays)
    
    // Domain diversity (bonus for sources not used recently)
    const domainDiversity = item.duplicateRate < 0.5 ? 1 : 0.5
    
    // Penalty for high duplicate rate
    const penalty = item.duplicateRate * 0.5
    
    // Base priority calculation
    return (0.6 * novelty) + (0.3 * domainDiversity) - (0.1 * penalty)
  }
  
  /**
   * Get frontier statistics
   */
  getStats(): {
    totalItems: number
    availableItems: number
    backoffItems: number
    averagePriority: number
    topSources: Array<{source: string, count: number, avgPriority: number}>
  } {
    const items = Array.from(this.items.values())
    const now = new Date()
    
    const availableItems = items.filter(item => 
      !item.backoffUntil || item.backoffUntil <= now
    ).length
    
    const backoffItems = items.filter(item => 
      item.backoffUntil && item.backoffUntil > now
    ).length
    
    const averagePriority = items.length > 0 
      ? items.reduce((sum, item) => sum + item.priority, 0) / items.length 
      : 0
    
    // Group by source
    const sourceStats = new Map<string, {count: number, totalPriority: number}>()
    for (const item of items) {
      const existing = sourceStats.get(item.source) || {count: 0, totalPriority: 0}
      sourceStats.set(item.source, {
        count: existing.count + 1,
        totalPriority: existing.totalPriority + item.priority
      })
    }
    
    const topSources = Array.from(sourceStats.entries())
      .map(([source, stats]) => ({
        source,
        count: stats.count,
        avgPriority: stats.totalPriority / stats.count
      }))
      .sort((a, b) => b.avgPriority - a.avgPriority)
      .slice(0, 5)
    
    return {
      totalItems: items.length,
      availableItems,
      backoffItems,
      averagePriority,
      topSources
    }
  }
  
  /**
   * Clear all items (useful for testing)
   */
  clear(): void {
    this.items.clear()
  }
  
  /**
   * Get all items (for debugging)
   */
  getAllItems(): FrontierItem[] {
    return Array.from(this.items.values())
  }
}

/**
 * RSS/API Provider implementation
 */
export class RSSProvider implements SearchProvider {
  name: string
  private baseUrl: string
  private lastGuid?: string
  
  constructor(name: string, baseUrl: string) {
    this.name = name
    this.baseUrl = baseUrl
  }
  
  async fetch(cursor: string, limit: number): Promise<SearchResult> {
    // Implementation would fetch from RSS feed
    // For now, return mock data
    return {
      urls: [],
      nextCursor: cursor,
      hasMore: false
    }
  }
  
  canBackoff(item: FrontierItem): boolean {
    return item.duplicateRate > 0.8
  }
  
  getBackoffDuration(item: FrontierItem): number {
    // Exponential backoff: 1min, 5min, 15min, 1hr
    const backoffLevel = Math.min(item.duplicateRate * 4, 4)
    const durations = [60000, 300000, 900000, 3600000] // 1min, 5min, 15min, 1hr
    return durations[Math.floor(backoffLevel)] || 3600000
  }
}

/**
 * Web Search Provider implementation
 */
export class WebSearchProvider implements SearchProvider {
  name: string
  private apiKey: string
  private searchEngine: string
  
  constructor(name: string, apiKey: string, searchEngine: string = 'google') {
    this.name = name
    this.apiKey = apiKey
    this.searchEngine = searchEngine
  }
  
  async fetch(cursor: string, limit: number): Promise<SearchResult> {
    // Implementation would use search API
    // For now, return mock data
    return {
      urls: [],
      nextCursor: cursor,
      hasMore: false
    }
  }
  
  canBackoff(item: FrontierItem): boolean {
    return item.duplicateRate > 0.7
  }
  
  getBackoffDuration(item: FrontierItem): number {
    // Linear backoff for search APIs
    return Math.min(item.duplicateRate * 300000, 1800000) // Max 30min
  }
}
