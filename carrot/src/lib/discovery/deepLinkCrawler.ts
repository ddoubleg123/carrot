/**
 * Production Deep-Link Crawler
 * Deterministic pipeline with circuit breakers and structured logging
 */

import { prisma } from '@/lib/prisma'
import { canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'
import { NewsSource } from './newsSource'
import { createHash } from 'crypto'

// ============================================================================
// Types & Config
// ============================================================================

export interface CrawlerResult<T = any> {
  ok: boolean
  data?: T
  error?: {
    code: string
    msg: string
  }
  metrics?: Record<string, number>
}

export interface CrawlerInput {
  notes?: string
  keywords?: string[]
  meta?: Record<string, any>
}

export interface UrlCandidate {
  url: string
  sourceQuery?: string
  normalizedUrl: string
  urlHash: string
}

export interface FetchResult {
  finalUrl: string
  status: number
  headers: Record<string, string>
  html: string
  paywall: boolean
}

export interface ExtractResult {
  title: string
  text: string
  canonical: string
  outlinks: string[]
}

export interface PersistResult {
  id: string
  duplicate: boolean
}

export interface RunMetrics {
  attempts: {
    total: number
    byStep: Record<string, number>
  }
  duplicates: number
  itemsSaved: number
  errorsByCode: Record<string, number>
}

export interface RunSummary {
  id: string
  runId: string
  patchId?: string
  status: 'ok' | 'fail'
  startedAt: string
  completedAt: string
  meta: RunMetrics
  error?: {
    code: string
    msg: string
  }
}

// Config from env
const CONFIG = {
  MAX_ATTEMPTS_TOTAL: Number(process.env.CRAWLER_MAX_ATTEMPTS_TOTAL || 40),
  MAX_ATTEMPTS_PER_STEP: Number(process.env.CRAWLER_MAX_ATTEMPTS_PER_STEP || 10),
  FETCH_TIMEOUT_MS: Number(process.env.CRAWLER_FETCH_TIMEOUT_MS || 15000),
  USER_AGENT: process.env.CRAWLER_USER_AGENT || 'DeepLinkCrawler/1.0',
  CONCURRENCY: Number(process.env.CRAWLER_CONCURRENCY || 4)
}

// ============================================================================
// Structured Logger
// ============================================================================

interface LogEvent {
  id: string
  runId: string
  patchId?: string
  step: string
  status: 'ok' | 'fail' | 'retry'
  ts: string
  provider?: string
  query?: string
  candidateUrl?: string
  finalUrl?: string
  meta?: Record<string, any>
  error?: {
    code: string
    msg: string
  }
}

class CrawlerLogger {
  private runId: string
  private patchId?: string

  constructor(runId: string, patchId?: string) {
    this.runId = runId
    this.patchId = patchId
  }

  log(event: Omit<LogEvent, 'id' | 'runId' | 'patchId' | 'ts'>): void {
    const logLine: LogEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      runId: this.runId,
      patchId: this.patchId,
      ts: new Date().toISOString(),
      ...event
    }
    console.log(JSON.stringify(logLine))
  }
}

// ============================================================================
// Pipeline Stages
// ============================================================================

/**
 * Normalize input metadata
 */
export function normalizeInput(meta: Record<string, any>): CrawlerInput {
  return {
    notes: typeof meta.notes === 'string' ? meta.notes.trim() : undefined,
    keywords: Array.isArray(meta.keywords) 
      ? meta.keywords.filter((k: any) => typeof k === 'string' && k.trim()).map((k: string) => k.trim())
      : undefined,
    meta
  }
}

/**
 * Expand queries with fallbacks
 */
export async function expandQueries(
  input: CrawlerInput,
  opts: { 
    provider?: (keywords: string[]) => Promise<string[]>
    useNewsAPI?: boolean
  } = {}
): Promise<CrawlerResult<string[]>> {
  const queries: string[] = []

  // Try provider first
  if (opts.provider && input.keywords && input.keywords.length > 0) {
    try {
      const providerQueries = await opts.provider(input.keywords)
      if (Array.isArray(providerQueries) && providerQueries.length > 0) {
        queries.push(...providerQueries.filter(q => typeof q === 'string' && q.trim()))
      }
    } catch (error: any) {
      // Fall through to fallback
    }
  }

  // Try NewsAPI if enabled
  if (opts.useNewsAPI && input.keywords && input.keywords.length > 0 && queries.length === 0) {
    try {
      // NewsAPI will be used in generateCandidates, so we just use keywords as queries
      queries.push(...input.keywords)
    } catch (error: any) {
      // Fall through
    }
  }

  // Fallback 1: Build from keywords
  if (queries.length === 0 && input.keywords && input.keywords.length > 0) {
    const keywordQueries = input.keywords
      .filter(k => k.length > 2)
      .map(k => `"${k}"`)
    
    // Add site filters for high-signal domains
    const highSignalDomains = ['nba.com', 'espn.com', 'theathletic.com', 'sportingnews.com', 'bleacherreport.com']
    for (const domain of highSignalDomains) {
      keywordQueries.push(`${input.keywords[0]} site:${domain}`)
    }
    
    queries.push(...keywordQueries)
  }

  // Fallback 2: Extract from notes
  if (queries.length === 0 && input.notes) {
    // Extract quoted phrases
    const quoted = input.notes.match(/"([^"]+)"/g) || []
    quoted.forEach(q => queries.push(q.replace(/"/g, '')))
    
    // Split on commas/semicolons
    const phrases = input.notes
      .split(/[,;]/)
      .map(p => p.trim())
      .filter(p => p.length > 5 && p.length < 100)
    
    queries.push(...phrases.slice(0, 5))
  }

  // Generic web queries as last resort
  if (queries.length === 0 && input.keywords && input.keywords.length > 0) {
    queries.push(input.keywords.join(' '))
  }

  if (queries.length === 0) {
    return {
      ok: false,
      error: {
        code: 'ERR_NO_QUERY_INPUT',
        msg: 'No usable query input from keywords or notes'
      }
    }
  }

  return {
    ok: true,
    data: queries.slice(0, 20), // Cap at 20 queries
    metrics: { queriesGenerated: queries.length }
  }
}

/**
 * Generate URL candidates from queries using NewsAPI
 */
export async function generateCandidates(queries: string[]): Promise<CrawlerResult<UrlCandidate[]>> {
  const candidates: UrlCandidate[] = []
  const seenHashes = new Set<string>()

  // Use NewsAPI to search for each query
  for (const query of queries.slice(0, 10)) { // Limit to 10 queries
    try {
      const articles = await NewsSource.search(query, {
        pageSize: 5, // 5 articles per query
        sortBy: 'relevancy'
      })

      for (const article of articles) {
        if (!article.url || !article.url.startsWith('http')) {
          continue
        }

        const normalizedUrl = canonicalizeUrlFast(article.url)
        if (!normalizedUrl) {
          continue
        }

        const urlHash = createHash('sha256')
          .update(normalizedUrl)
          .digest('hex')

        if (seenHashes.has(urlHash)) {
          continue
        }
        seenHashes.add(urlHash)

        // Extract host for deduplication
        const host = getDomainFromUrl(normalizedUrl)
        const hostPath = host ? `${host}${new URL(normalizedUrl).pathname}` : normalizedUrl

        candidates.push({
          url: article.url,
          sourceQuery: query,
          normalizedUrl,
          urlHash
        })

        if (candidates.length >= 30) { // Cap at 30 candidates
          break
        }
      }

      if (candidates.length >= 30) {
        break
      }

      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error: any) {
      // Continue with next query
      continue
    }
  }

  return {
    ok: true,
    data: candidates,
    metrics: { candidatesGenerated: candidates.length }
  }
}

/**
 * Fetch page with redirects and timeout
 */
export async function fetchPage(url: string): Promise<CrawlerResult<FetchResult>> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const html = await response.text()
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    // Heuristic paywall detection
    const paywall = 
      response.status === 402 || 
      response.status === 451 ||
      html.includes('paywall') ||
      html.includes('subscription required') ||
      html.includes('premium content')

    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        error: {
          code: 'ERR_FETCH_NON_200',
          msg: `HTTP ${response.status}`
        },
        metrics: { fetchTimeMs: Date.now() - startTime }
      }
    }

    return {
      ok: true,
      data: {
        finalUrl: response.url,
        status: response.status,
        headers,
        html,
        paywall
      },
      metrics: { fetchTimeMs: Date.now() - startTime }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        ok: false,
        error: {
          code: 'ERR_FETCH_TIMEOUT',
          msg: `Timeout after ${CONFIG.FETCH_TIMEOUT_MS}ms`
        },
        metrics: { fetchTimeMs: Date.now() - startTime }
      }
    }
    return {
      ok: false,
      error: {
        code: 'ERR_FETCH_FAILED',
        msg: error.message || 'Unknown fetch error'
      },
      metrics: { fetchTimeMs: Date.now() - startTime }
    }
  }
}

/**
 * Extract content from HTML
 */
export async function extractContent(html: string, finalUrl: string): Promise<CrawlerResult<ExtractResult>> {
  try {
    // Use existing readability/dom extractor if available
    // For now, basic extraction
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM(html, { url: finalUrl })
    const document = dom.window.document

    const title = document.querySelector('title')?.textContent?.trim() || 
                  document.querySelector('h1')?.textContent?.trim() || 
                  'Untitled'
    
    // Remove scripts and styles
    const scripts = document.querySelectorAll('script, style, noscript')
    scripts.forEach(el => el.remove())

    const body = document.body
    const text = body?.textContent?.trim() || ''

    // Extract canonical URL
    const canonical = 
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
      finalUrl

    // Extract outlinks
    const outlinks: string[] = []
    const links = document.querySelectorAll('a[href]')
    links.forEach(link => {
      const href = link.getAttribute('href')
      if (href && href.startsWith('http')) {
        try {
          const resolved = new URL(href, finalUrl).toString()
          outlinks.push(resolved)
        } catch {
          // Skip invalid URLs
        }
      }
    })

    // If text is too short, still return ok but with warning
    if (text.length < 100) {
      return {
        ok: true, // Still ok, just short content
        data: {
          title,
          text: text || 'No content extracted',
          canonical,
          outlinks: outlinks.slice(0, 50)
        },
        metrics: { extractedLength: text.length, fallback: 1 }
      }
    }

    return {
      ok: true,
      data: {
        title,
        text: text.substring(0, 100000), // Cap at 100k chars
        canonical,
        outlinks: outlinks.slice(0, 50)
      }
    }
  } catch (error: any) {
    return {
      ok: false,
      error: {
        code: 'ERR_EXTRACT_FAILED',
        msg: error.message || 'Extraction failed'
      }
    }
  }
}

/**
 * Persist artifact with idempotency
 */
export async function persistArtifact(
  runId: string,
  item: {
    url: string
    finalUrl: string
    urlHash: string
    html: string
    text: string
    title: string
    canonical: string
    status: number
    headers: Record<string, string>
    paywall: boolean
    sourceQuery?: string
  }
): Promise<CrawlerResult<PersistResult>> {
  try {
    // Check for duplicate by urlHash
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM discovered_content 
      WHERE content_hash = ${item.urlHash} 
      LIMIT 1
    `

    if (existing.length > 0) {
      // Increment seen count (if you have that column)
      return {
        ok: true,
        data: {
          id: existing[0].id,
          duplicate: true
        },
        metrics: { duplicate: 1 }
      }
    }

    // Save new artifact
    // Note: This assumes you have a table for raw crawler artifacts
    // For now, we'll save to discovered_content with metadata
    const domain = getDomainFromUrl(item.canonical) ?? getDomainFromUrl(item.finalUrl) ?? null

    const saved = await prisma.discoveredContent.create({
      data: {
        patchId: runId, // Using runId as patchId for now
        title: item.title,
        sourceUrl: item.url,
        canonicalUrl: item.canonical,
        domain,
        summary: item.text.substring(0, 500),
        whyItMatters: null,
        relevanceScore: 0.5,
        qualityScore: 0,
        contentHash: item.urlHash,
        metadata: {
          runId,
          finalUrl: item.finalUrl,
          status: item.status,
          headers: item.headers,
          paywall: item.paywall,
          sourceQuery: item.sourceQuery,
          rawHtmlLength: item.html.length,
          extractedTextLength: item.text.length
        } as any
      }
    })

    return {
      ok: true,
      data: {
        id: saved.id,
        duplicate: false
      },
      metrics: { saved: 1 }
    }
  } catch (error: any) {
    return {
      ok: false,
      error: {
        code: 'ERR_PERSIST_FAILED',
        msg: error.message || 'Persistence failed'
      }
    }
  }
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export class DeepLinkCrawler {
  private logger: CrawlerLogger
  private runId: string
  private patchId?: string
  private startedAt: string
  private attempts: RunMetrics['attempts']
  private errorsByCode: Record<string, number> = {}
  private duplicates = 0
  private itemsSaved = 0
  private summary?: RunSummary

  constructor(runId: string, patchId?: string) {
    this.runId = runId
    this.patchId = patchId
    this.startedAt = new Date().toISOString()
    this.logger = new CrawlerLogger(runId, patchId)
    this.attempts = {
      total: 0,
      byStep: {}
    }
  }

  private incrementAttempt(step: string): boolean {
    this.attempts.total++
    this.attempts.byStep[step] = (this.attempts.byStep[step] || 0) + 1

    // Check caps
    if (this.attempts.total > CONFIG.MAX_ATTEMPTS_TOTAL) {
      return false
    }
    if (this.attempts.byStep[step] > CONFIG.MAX_ATTEMPTS_PER_STEP) {
      return false
    }
    return true
  }

  private recordError(code: string, msg: string): void {
    this.errorsByCode[code] = (this.errorsByCode[code] || 0) + 1
    this.logger.log({
      step: 'error',
      status: 'fail',
      error: { code, msg }
    })
  }

  async run(meta: Record<string, any>): Promise<RunSummary> {
    // Normalize input
    const input = normalizeInput(meta)
    
    // Expand queries
    if (!this.incrementAttempt('query_expand')) {
      return await this.finalize('fail', {
        code: 'ERR_ATTEMPT_CAP',
        msg: 'Attempt cap reached at query_expand'
      })
    }

    const queryResult = await expandQueries(input, { useNewsAPI: true })
    if (!queryResult.ok) {
      this.recordError(queryResult.error!.code, queryResult.error!.msg)
      this.logger.log({
        step: 'query_expand',
        status: 'fail',
        error: queryResult.error
      })
      return await this.finalize('fail', queryResult.error!)
    }

    this.logger.log({
      step: 'query_expand',
      status: 'ok',
      meta: { queriesGenerated: queryResult.data?.length || 0 }
    })

    // Generate candidates
    if (!this.incrementAttempt('generate_candidates')) {
      return await this.finalize('fail', {
        code: 'ERR_ATTEMPT_CAP',
        msg: 'Attempt cap reached at generate_candidates'
      })
    }

    const candidateResult = await generateCandidates(queryResult.data!)
    if (!candidateResult.ok || !candidateResult.data || candidateResult.data.length === 0) {
      this.logger.log({
        step: 'generate_candidates',
        status: 'ok',
        meta: { candidatesGenerated: 0 }
      })
      return await this.finalize('ok', undefined) // No candidates, but not an error
    }

    this.logger.log({
      step: 'generate_candidates',
      status: 'ok',
      meta: { candidatesGenerated: candidateResult.data.length }
    })

    // Process candidates with concurrency (process all in batches)
    const candidates = candidateResult.data
    const batches: UrlCandidate[][] = []
    for (let i = 0; i < candidates.length; i += CONFIG.CONCURRENCY) {
      batches.push(candidates.slice(i, i + CONFIG.CONCURRENCY))
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(candidate => this.processCandidate(candidate, 0))
      )

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.duplicate) {
            this.duplicates++
          } else {
            this.itemsSaved++
          }
        }
      }
    }

    return await this.finalize('ok', undefined)
  }

  private async processCandidate(candidate: UrlCandidate, retryCount = 0): Promise<PersistResult | null> {
    // Fetch with exponential backoff on retry
    if (!this.incrementAttempt('fetch')) {
      return null
    }

    // Exponential backoff: 100ms * 2^retryCount + jitter (0-250ms)
    if (retryCount > 0) {
      const backoffMs = Math.min(100 * Math.pow(2, retryCount) + Math.random() * 250, 5000)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }

    const fetchResult = await fetchPage(candidate.url)
    if (!fetchResult.ok) {
      // Retry on timeout or transient errors (max 2 retries)
      if ((fetchResult.error!.code === 'ERR_FETCH_TIMEOUT' || fetchResult.error!.code === 'ERR_FETCH_FAILED') && retryCount < 2) {
        this.logger.log({
          step: 'fetch',
          status: 'retry',
          candidateUrl: candidate.url,
          error: fetchResult.error,
          retryCount: retryCount + 1
        })
        return this.processCandidate(candidate, retryCount + 1)
      }

      this.recordError(fetchResult.error!.code, fetchResult.error!.msg)
      this.logger.log({
        step: 'fetch',
        status: 'fail',
        candidateUrl: candidate.url,
        error: fetchResult.error
      })
      return null
    }

    this.logger.log({
      step: 'fetch',
      status: 'ok',
      candidateUrl: candidate.url,
      finalUrl: fetchResult.data!.finalUrl
    })

    // Extract
    if (!this.incrementAttempt('extract')) {
      return null
    }

    const extractResult = await extractContent(fetchResult.data!.html, fetchResult.data!.finalUrl)
    if (!extractResult.ok) {
      this.recordError(extractResult.error!.code, extractResult.error!.msg)
      this.logger.log({
        step: 'extract',
        status: 'fail',
        finalUrl: fetchResult.data!.finalUrl,
        error: extractResult.error
      })
      // Continue with fallback data if available
      if (!extractResult.data) {
        return null
      }
    } else {
      this.logger.log({
        step: 'extract',
        status: 'ok',
        finalUrl: fetchResult.data!.finalUrl
      })
    }

    // Persist
    if (!this.incrementAttempt('persist')) {
      return null
    }

    const urlHash = createHash('sha256')
      .update(candidate.normalizedUrl)
      .digest('hex')

    const persistResult = await persistArtifact(this.runId, {
      url: candidate.url,
      finalUrl: fetchResult.data!.finalUrl,
      urlHash,
      html: fetchResult.data!.html,
      text: extractResult.data!.text,
      title: extractResult.data!.title,
      canonical: extractResult.data!.canonical,
      status: fetchResult.data!.status,
      headers: fetchResult.data!.headers,
      paywall: fetchResult.data!.paywall,
      sourceQuery: candidate.sourceQuery
    })

    if (!persistResult.ok) {
      this.recordError(persistResult.error!.code, persistResult.error!.msg)
      this.logger.log({
        step: 'persist',
        status: 'fail',
        finalUrl: fetchResult.data!.finalUrl,
        error: persistResult.error
      })
      return null
    }

    this.logger.log({
      step: 'persist',
      status: 'ok',
      finalUrl: fetchResult.data!.finalUrl,
      meta: { duplicate: persistResult.data!.duplicate }
    })

    return persistResult.data!
  }

  private async finalize(status: 'ok' | 'fail', error?: { code: string; msg: string }): Promise<RunSummary> {
    const completedAt = new Date().toISOString()
    
    this.summary = {
      id: this.runId,
      runId: this.runId,
      patchId: this.patchId,
      status,
      startedAt: this.startedAt,
      completedAt,
      meta: {
        attempts: this.attempts,
        duplicates: this.duplicates,
        itemsSaved: this.itemsSaved,
        errorsByCode: this.errorsByCode
      },
      error
    }

    this.logger.log({
      step: 'run_complete',
      status,
      meta: {
        itemsSaved: this.itemsSaved,
        duplicates: this.duplicates,
        attempts: this.attempts,
        errorsByCode: this.errorsByCode
      },
      error
    })

    // Store summary for API access (server-side only)
    if (typeof window === 'undefined') {
      try {
        const { storeRunSummary } = await import('./crawlerStore')
        storeRunSummary(this.runId, this.summary)
      } catch {
        // Ignore if store not available
      }
    }

    return this.summary
  }

  getSummary(): RunSummary | undefined {
    return this.summary
  }
}

