/**
 * Smart Search Frontier with Novelty & Diversity Scoring
 * Prioritizes novel sources and diverse domains
 */

export interface SearchCandidate {
  source: string
  method: string
  cursor: string
  priority: number
  lastSeen: Date
  duplicateRate: number
  domain: string
}

export interface FrontierConfig {
  maxCandidates: number
  noveltyWeight: number
  diversityWeight: number
  penaltyWeight: number
  backoffMultiplier: number
}

export class SearchFrontier {
  private candidates: SearchCandidate[] = []
  private seenDomains = new Set<string>()
  private domainCounts = new Map<string, number>()
  private config: FrontierConfig
  
  constructor(config: Partial<FrontierConfig> = {}) {
    this.config = {
      maxCandidates: 50,
      noveltyWeight: 0.6,
      diversityWeight: 0.3,
      penaltyWeight: 0.1,
      backoffMultiplier: 1.5,
      ...config
    }
  }
  
  /**
   * Add a new search candidate to the frontier
   */
  addCandidate(candidate: Omit<SearchCandidate, 'priority'>): void {
    const priority = this.calculatePriority(candidate)
    const fullCandidate: SearchCandidate = {
      ...candidate,
      priority,
      lastSeen: new Date()
    }
    
    this.candidates.push(fullCandidate)
    this.seenDomains.add(candidate.domain)
    this.domainCounts.set(candidate.domain, (this.domainCounts.get(candidate.domain) || 0) + 1)
    
    // Keep only top candidates
    this.candidates.sort((a, b) => b.priority - a.priority)
    if (this.candidates.length > this.config.maxCandidates) {
      this.candidates = this.candidates.slice(0, this.config.maxCandidates)
    }
  }
  
  /**
   * Get the highest priority candidate
   */
  popMax(): SearchCandidate | null {
    if (this.candidates.length === 0) return null
    
    const candidate = this.candidates.shift()!
    return candidate
  }
  
  /**
   * Reinsert a candidate with updated priority (after processing)
   */
  reinsert(candidate: SearchCandidate, advanceCursor: boolean = true): void {
    if (advanceCursor) {
      // Advance cursor to next page/position
      candidate.cursor = this.advanceCursor(candidate.cursor, candidate.method)
    } else {
      // Apply backoff penalty
      candidate.duplicateRate = Math.min(candidate.duplicateRate * this.config.backoffMultiplier, 0.9)
    }
    
    candidate.priority = this.calculatePriority(candidate)
    candidate.lastSeen = new Date()
    
    this.candidates.push(candidate)
    this.candidates.sort((a, b) => b.priority - a.priority)
  }
  
  /**
   * Calculate priority score for a candidate
   */
  private calculatePriority(candidate: SearchCandidate): number {
    const novelty = this.calculateNovelty(candidate)
    const diversity = this.calculateDiversity(candidate.domain)
    const penalty = candidate.duplicateRate
    
    return (
      this.config.noveltyWeight * novelty +
      this.config.diversityWeight * diversity -
      this.config.penaltyWeight * penalty
    )
  }
  
  /**
   * Calculate novelty score (higher for newer sources)
   */
  private calculateNovelty(candidate: SearchCandidate): number {
    const daysSinceLastSeen = (Date.now() - candidate.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
    return 1 / (1 + daysSinceLastSeen)
  }
  
  /**
   * Calculate diversity score (higher for unseen domains)
   */
  private calculateDiversity(domain: string): number {
    const count = this.domainCounts.get(domain) || 0
    return 1 / (1 + count)
  }
  
  /**
   * Advance cursor based on method type
   */
  private advanceCursor(currentCursor: string, method: string): string {
    switch (method) {
      case 'rss':
        // For RSS, advance to next page
        const rssMatch = currentCursor.match(/page=(\d+)/)
        if (rssMatch) {
          const page = parseInt(rssMatch[1]) + 1
          return currentCursor.replace(/page=\d+/, `page=${page}`)
        }
        return `${currentCursor}&page=2`
        
      case 'api':
        // For API, advance offset
        const apiMatch = currentCursor.match(/offset=(\d+)/)
        if (apiMatch) {
          const offset = parseInt(apiMatch[1]) + 20
          return currentCursor.replace(/offset=\d+/, `offset=${offset}`)
        }
        return `${currentCursor}&offset=20`
        
      case 'search':
        // For search, advance page
        const searchMatch = currentCursor.match(/start=(\d+)/)
        if (searchMatch) {
          const start = parseInt(searchMatch[1]) + 10
          return currentCursor.replace(/start=\d+/, `start=${start}`)
        }
        return `${currentCursor}&start=10`
        
      default:
        return currentCursor
    }
  }
  
  /**
   * Get frontier statistics
   */
  getStats(): {
    totalCandidates: number
    uniqueDomains: number
    averagePriority: number
    topDomains: Array<{ domain: string; count: number }>
  } {
    const totalCandidates = this.candidates.length
    const uniqueDomains = this.seenDomains.size
    const averagePriority = this.candidates.reduce((sum, c) => sum + c.priority, 0) / totalCandidates
    
    const topDomains = Array.from(this.domainCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }))
    
    return {
      totalCandidates,
      uniqueDomains,
      averagePriority,
      topDomains
    }
  }
  
  /**
   * Clear the frontier
   */
  clear(): void {
    this.candidates = []
    this.seenDomains.clear()
    this.domainCounts.clear()
  }
  
  /**
   * Get all candidates (for debugging)
   */
  getAllCandidates(): SearchCandidate[] {
    return [...this.candidates]
  }
}