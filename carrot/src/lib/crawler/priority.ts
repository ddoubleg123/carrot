/**
 * Priority scoring system for crawler URLs
 * Phase 2: Crawler Enhancements
 */

import { isArticleLikeUrl, getPathDepth, extractDomain } from './utils'

export interface PriorityScore {
  score: number
  breakdown: {
    baseDomain: number
    pathDepth: number
    articleBonus: number
    wikiPenalty: number
    duplicatePenalty: number
    priorFailPenalty: number
  }
}

export interface PriorityConfig {
  baseDomainScores?: Record<string, number> // domain -> score
  articleRegexBonus?: number // bonus for article-like URLs
  pathDepthMultiplier?: number // multiplier for path depth
  wikiPenalty?: number // penalty for Wikipedia after cap
  duplicatePenalty?: number // penalty for previously seen URLs
  priorFailPenalty?: number // penalty for URLs that failed before
  defaultDomainScore?: number // default score for unknown domains
}

const DEFAULT_CONFIG: Required<PriorityConfig> = {
  baseDomainScores: {
    'espn.com': 100,
    'theathletic.com': 100,
    'nbcchicago.com': 90,
    'nba.com': 90,
    'reuters.com': 95,
    'apnews.com': 95,
    'bbc.com': 90,
    'theguardian.com': 90,
    'nytimes.com': 95,
  },
  articleRegexBonus: 20,
  pathDepthMultiplier: 5,
  wikiPenalty: -50,
  duplicatePenalty: -30,
  priorFailPenalty: -40,
  defaultDomainScore: 50,
}

/**
 * Calculate priority score for a URL
 */
export function calculatePriority(
  url: string,
  config: PriorityConfig = {},
  context: {
    isWikipedia?: boolean
    wikiCount?: number // number of Wikipedia pages already processed
    isDuplicate?: boolean
    hasPriorFailure?: boolean
  } = {}
): PriorityScore {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const domain = extractDomain(url) || ''
  
  // Base domain score
  const baseDomain = cfg.baseDomainScores[domain] || cfg.defaultDomainScore
  
  // Path depth bonus
  const depth = getPathDepth(url)
  const pathDepth = depth * cfg.pathDepthMultiplier
  
  // Article regex bonus
  const articleBonus = isArticleLikeUrl(url) ? cfg.articleRegexBonus : 0
  
  // Wikipedia penalty (after first 2 pages)
  let wikiPenalty = 0
  if (context.isWikipedia && (context.wikiCount || 0) > 2) {
    wikiPenalty = cfg.wikiPenalty
  }
  
  // Duplicate penalty
  const duplicatePenalty = context.isDuplicate ? cfg.duplicatePenalty : 0
  
  // Prior failure penalty
  const priorFailPenalty = context.hasPriorFailure ? cfg.priorFailPenalty : 0
  
  const totalScore = baseDomain + pathDepth + articleBonus + wikiPenalty + duplicatePenalty + priorFailPenalty
  
  return {
    score: Math.max(0, totalScore), // Ensure non-negative
    breakdown: {
      baseDomain,
      pathDepth,
      articleBonus,
      wikiPenalty,
      duplicatePenalty,
      priorFailPenalty,
    },
  }
}

/**
 * Domain diversity tracker
 * Ensures max N URLs from same domain per window of M dequeues
 */
export class DomainDiversityTracker {
  private recentDomains: string[] = []
  private readonly windowSize: number
  private readonly maxPerDomain: number

  constructor(windowSize: number = 20, maxPerDomain: number = 4) {
    this.windowSize = windowSize
    this.maxPerDomain = maxPerDomain
  }

  /**
   * Check if domain is within diversity limits
   */
  canProcessDomain(domain: string): boolean {
    const recent = this.recentDomains.slice(-this.windowSize)
    const count = recent.filter(d => d === domain).length
    return count < this.maxPerDomain
  }

  /**
   * Record that a domain was processed
   */
  recordDomain(domain: string): void {
    this.recentDomains.push(domain)
    // Keep only last windowSize entries
    if (this.recentDomains.length > this.windowSize * 2) {
      this.recentDomains = this.recentDomains.slice(-this.windowSize)
    }
  }

  /**
   * Get current domain distribution in window
   */
  getDomainDistribution(): Record<string, number> {
    const recent = this.recentDomains.slice(-this.windowSize)
    return recent.reduce((acc, domain) => {
      acc[domain] = (acc[domain] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}

