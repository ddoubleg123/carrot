/**
 * Core crawler service
 * Phase 2: Crawler Enhancements + Phase 3: Queue System
 * Integrates fetching, outlink extraction, priority scoring, and persistence
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { canonicalizeUrlFast, getDomainFromUrl } from '../discovery/canonicalize'
import { extractOutgoingLinks } from '../discovery/wikiUtils'
import { 
  enqueueDiscoveryUrl, 
  dequeueDiscoveryUrl, 
  getDiscoveryQueueDepth,
  moveToDiscoveryDLQ,
  requeueDiscoveryWithBackoff
} from './queues'
import { 
  isCrawlerUrlSeen, 
  markCrawlerUrlSeen 
} from '../redis/discovery'
import { 
  hashUrl, 
  hashText, 
  extractDomain,
  isArticleLikeUrl,
  getPathDepth
} from './utils'
import { 
  calculatePriority, 
  DomainDiversityTracker,
  PriorityConfig 
} from './priority'
import { crawlerConfig } from './config'
import { CRAWLER_PRIORITY_V2 } from '../discovery/flags'
import { slog } from '../log'
import { inc, histogram, gauge } from '../metrics'

const FETCH_TIMEOUT_MS = crawlerConfig.fetchTimeoutMs
const USER_AGENT = crawlerConfig.userAgent

interface FetchResult {
  success: boolean
  url: string
  canonicalUrl: string
  domain: string
  status: 'fetched' | 'failed'
  httpStatus?: number
  reasonCode?: string
  rawHtml?: string
  extractedText?: string
  bytes?: number
  textHash?: string
}

interface CrawlerStats {
  fetched: number
  enqueued: number
  deduped: number
  skipped: number
  persisted: number
  errors: number
  wikiCount: number
}

/**
 * Abortable fetch with timeout
 */
async function abortableFetch(url: string, options: RequestInit = {}, timeout = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...options.headers,
      },
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

/**
 * Simple robots.txt check (basic implementation)
 * Returns true if URL is allowed, false if blocked
 */
async function checkRobotsTxt(url: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const urlObj = new URL(url)
    const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`
    
    const response = await abortableFetch(robotsUrl, {}, 5000).catch(() => null)
    if (!response || !response.ok) {
      // If robots.txt doesn't exist or is unreachable, allow by default
      return { allowed: true }
    }
    
    const text = await response.text()
    const userAgent = USER_AGENT.toLowerCase()
    
    // Simple check: look for "User-agent: *" and "Disallow: /"
    const lines = text.split('\n').map(l => l.trim())
    let inUserAgentBlock = false
    let disallowAll = false
    
    for (const line of lines) {
      if (line.toLowerCase().startsWith('user-agent:')) {
        const ua = line.substring(11).trim().toLowerCase()
        inUserAgentBlock = ua === '*' || userAgent.includes(ua)
      } else if (inUserAgentBlock && line.toLowerCase().startsWith('disallow:')) {
        const path = line.substring(9).trim()
        if (path === '/' || urlObj.pathname.startsWith(path)) {
          disallowAll = true
        }
      } else if (line.toLowerCase().startsWith('user-agent:') || line.toLowerCase().startsWith('allow:')) {
        inUserAgentBlock = false
        disallowAll = false
      }
    }
    
    if (disallowAll) {
      return { allowed: false, reason: 'robots_blocked' }
    }
    
    return { allowed: true }
  } catch (error) {
    // On error, allow by default (fail open)
    return { allowed: true }
  }
}

/**
 * Extract text content from HTML (simple implementation)
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities (basic)
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}

/**
 * Fetch and extract content from URL
 */
async function fetchPage(url: string): Promise<FetchResult> {
  const startTime = Date.now()
  const urlHash = hashUrl(url)
  const domain = extractDomain(url) || 'unknown'
  
  try {
    // Check robots.txt
    const robotsCheck = await checkRobotsTxt(url)
    if (!robotsCheck.allowed) {
      inc('robots_blocked', 1, { domain })
      return {
        success: false,
        url,
        canonicalUrl: url,
        domain,
        status: 'failed',
        reasonCode: 'robots_blocked',
      }
    }
    
    // Fetch page
    const response = await abortableFetch(url, {}, FETCH_TIMEOUT_MS)
    const httpStatus = response.status
    
    if (!response.ok) {
      return {
        success: false,
        url,
        canonicalUrl: url,
        domain,
        status: 'failed',
        httpStatus,
        reasonCode: httpStatus === 403 ? 'http_403' : httpStatus === 404 ? 'http_404' : 'http_error',
      }
    }
    
    const rawHtml = await response.text()
    const bytes = rawHtml.length
    const extractedText = extractTextFromHtml(rawHtml)
    const textHash = hashText(extractedText)
    const canonicalUrl = canonicalizeUrlFast(url) || url
    
    // Check if content is too short
    if (extractedText.length < 500) {
      return {
        success: false,
        url,
        canonicalUrl,
        domain,
        status: 'failed',
        httpStatus,
        reasonCode: 'content_too_short',
        rawHtml,
        extractedText,
        bytes,
        textHash,
      }
    }
    
    const duration = Date.now() - startTime
    
    // Metrics
    inc('crawl_ok', 1, { domain })
    histogram('fetch_duration_ms', duration, { domain })
    histogram('text_len', extractedText.length, { domain })
    histogram('outlinks_per_page', 0, { domain }) // Will be updated after extraction
    
    // Log fetch success
    slog('info', {
      service: 'crawler',
      step: 'fetch',
      url: url.slice(0, 200),
      domain,
      action: 'fetch',
      status: 'ok',
      http_status: httpStatus,
      duration_ms: duration,
      bytes,
      text_len: extractedText.length,
    })
    
    return {
      success: true,
      url,
      canonicalUrl,
      domain,
      status: 'fetched',
      httpStatus,
      rawHtml,
      extractedText,
      bytes,
      textHash,
    }
    } catch (error: any) {
      const duration = Date.now() - startTime
      let reasonCode = 'unknown_error'
      
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        reasonCode = 'timeout'
        inc('timeout', 1, { domain })
      } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
        reasonCode = 'dns_error'
        inc('dns_error', 1, { domain })
      } else if (error.message?.includes('ECONNREFUSED')) {
        reasonCode = 'connection_refused'
        inc('connection_refused', 1, { domain })
      }
      
      inc('crawl_fail', 1, { domain, reason: reasonCode })
      
      slog('error', {
        service: 'crawler',
        step: 'fetch',
        url: url.slice(0, 200),
        domain,
        action: 'fetch',
        status: 'error',
        reason_code: reasonCode,
        duration_ms: duration,
        error: error.message?.slice(0, 200),
      })
    
    return {
      success: false,
      url,
      canonicalUrl: url,
      domain,
      status: 'failed',
      reasonCode,
    }
  }
}

/**
 * Main crawler service
 */
export class CrawlerService {
  private stats: CrawlerStats = {
    fetched: 0,
    enqueued: 0,
    deduped: 0,
    skipped: 0,
    persisted: 0,
    errors: 0,
    wikiCount: 0,
  }
  
  private diversityTracker = new DomainDiversityTracker(20, 4)
  private priorityConfig: PriorityConfig = {}
  
  constructor(priorityConfig?: PriorityConfig) {
    this.priorityConfig = priorityConfig || {}
  }
  
  /**
   * Process a single URL from discovery queue
   */
  async processUrl(topic: string): Promise<void> {
    const queued = await dequeueDiscoveryUrl()
    if (!queued) {
      return // Queue empty
    }
    
    const { url, urlHash, priority, sourceUrl, attemptCount = 0 } = queued
    const domain = extractDomain(url) || 'unknown'
    const isWikipedia = domain.includes('wikipedia.org')
    
    // Check if already seen (cross-run dedupe)
    if (await isCrawlerUrlSeen(urlHash)) {
      this.stats.deduped++
      inc('duplicate_content', 1, { domain })
      slog('info', {
        service: 'crawler',
        step: 'dedupe',
        url: url.slice(0, 200),
        domain,
        action: 'skip',
        status: 'duplicate',
        reason_code: 'already_seen',
      })
      return
    }
    
    // Domain diversity check
    if (!this.diversityTracker.canProcessDomain(domain)) {
      this.stats.skipped++
      slog('info', {
        service: 'crawler',
        step: 'diversity',
        url: url.slice(0, 200),
        domain,
        action: 'skip',
        status: 'diversity_limit',
      })
      // Re-enqueue with lower priority
      await enqueueDiscoveryUrl(url, priority - 20, topic, { sourceUrl, attemptCount })
      return
    }
    
    // Wikipedia cap check
    if (isWikipedia && this.stats.wikiCount >= crawlerConfig.wikiCap) {
      this.stats.skipped++
      inc('wiki_skipped_after_cap', 1)
      slog('info', {
        service: 'crawler',
        step: 'wiki_cap',
        url: url.slice(0, 200),
        domain,
        action: 'skip',
        status: 'wiki_cap_reached',
      })
      return
    }
    
    if (isWikipedia) {
      inc('wiki_seen', 1)
    }
    
    // Fetch page
    const fetchResult = await fetchPage(url)
    
    if (!fetchResult.success) {
      this.stats.errors++
      
      // Check if retryable
      const retryableCodes = ['timeout', 'dns_error', 'connection_refused']
      if (retryableCodes.includes(fetchResult.reasonCode || '') && attemptCount < crawlerConfig.maxRetries) {
        await requeueDiscoveryWithBackoff(url, priority, topic, attemptCount, { sourceUrl })
      } else {
        // Move to DLQ
        await moveToDiscoveryDLQ(url, fetchResult.reasonCode || 'unknown_error', {
          attemptCount,
          httpStatus: fetchResult.httpStatus,
        })
      }
      return
    }
    
    this.stats.fetched++
    if (isWikipedia) {
      this.stats.wikiCount++
    }
    this.diversityTracker.recordDomain(domain)
    
    // Mark as seen
    await markCrawlerUrlSeen(urlHash)
    
      // Check for duplicate content (text hash)
      if (fetchResult.textHash) {
        const existing = await (prisma as any).crawlerPage.findFirst({
          where: { textHash: fetchResult.textHash },
          select: { id: true },
        })
        
        if (existing) {
          this.stats.deduped++
          inc('duplicate_content', 1, { domain })
          slog('info', {
            service: 'crawler',
            step: 'content_dedupe',
            url: url.slice(0, 200),
            domain,
            action: 'skip',
            status: 'duplicate_content',
            reason_code: 'text_hash_match',
          })
          return
        }
      }
    
    // Persist to database
    try {
      const page = await (prisma as any).crawlerPage.create({
        data: {
          url: fetchResult.canonicalUrl,
          domain: fetchResult.domain,
          status: 'fetched',
          firstSeenAt: new Date(),
          lastProcessedAt: new Date(),
          textHash: fetchResult.textHash || null,
          bytes: fetchResult.bytes || 0,
          httpStatus: fetchResult.httpStatus || null,
          rawHtml: fetchResult.rawHtml || null,
          extractedText: fetchResult.extractedText || null,
          canonicalUrl: fetchResult.canonicalUrl,
        },
      })
      
      this.stats.persisted++
      
      slog('info', {
        service: 'crawler',
        step: 'persist',
        url: fetchResult.canonicalUrl.slice(0, 200),
        domain: fetchResult.domain,
        action: 'save',
        status: 'ok',
        page_id: page.id,
        bytes: fetchResult.bytes,
        text_len: fetchResult.extractedText?.length || 0,
      })
      
      // Extract outlinks and enqueue
      if (fetchResult.rawHtml) {
        const { offHost, sameHost } = extractOutgoingLinks(fetchResult.rawHtml, fetchResult.canonicalUrl, 40)
        const allLinks = [...offHost, ...sameHost].slice(0, 20)
        
        let enqueuedCount = 0
        for (const link of allLinks) {
          const linkHash = hashUrl(link)
          const linkDomain = extractDomain(link) || 'unknown'
          const isLinkWikipedia = linkDomain.includes('wikipedia.org')
          
          // Skip if already seen
          if (await isCrawlerUrlSeen(linkHash)) {
            continue
          }
          
          // Calculate priority
          const priorityScore = CRAWLER_PRIORITY_V2
            ? calculatePriority(link, this.priorityConfig, {
                isWikipedia: isLinkWikipedia,
                wikiCount: this.stats.wikiCount,
                isDuplicate: false,
                hasPriorFailure: false,
              }).score
            : 50 // Default priority if feature flag off
          
          await enqueueDiscoveryUrl(link, priorityScore, topic, {
            sourceUrl: fetchResult.canonicalUrl,
            metadata: { extractedFrom: fetchResult.canonicalUrl },
          })
          enqueuedCount++
        }
        
        this.stats.enqueued += enqueuedCount
        
        inc('outlinks_enqueued', enqueuedCount, { domain: fetchResult.domain })
        histogram('outlinks_per_page', enqueuedCount, { domain: fetchResult.domain })
        
        slog('info', {
          service: 'crawler',
          step: 'extract_links',
          url: fetchResult.canonicalUrl.slice(0, 200),
          domain: fetchResult.domain,
          action: 'enqueue',
          status: 'ok',
          new_outlinks: enqueuedCount,
          queue_size: await getDiscoveryQueueDepth(),
        })
        
        // Enqueue for extraction
        const { enqueueExtraction } = await import('./queues')
        await enqueueExtraction(page.id, topic, fetchResult.canonicalUrl)
      }
    } catch (error: any) {
      this.stats.errors++
      slog('error', {
        service: 'crawler',
        step: 'persist',
        url: fetchResult.canonicalUrl.slice(0, 200),
        domain: fetchResult.domain,
        action: 'save',
        status: 'error',
        error: error.message?.slice(0, 200),
      })
    }
  }
  
  /**
   * Get current statistics
   */
  getStats(): CrawlerStats {
    return { ...this.stats }
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      fetched: 0,
      enqueued: 0,
      deduped: 0,
      skipped: 0,
      persisted: 0,
      errors: 0,
      wikiCount: 0,
    }
    this.diversityTracker = new DomainDiversityTracker(20, 4)
  }
}

