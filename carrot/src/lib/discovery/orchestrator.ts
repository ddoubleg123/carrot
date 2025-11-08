/**
 * Main Discovery Orchestrator
 * Coordinates all discovery components for one-at-a-time processing
 */

import { canonicalize } from './canonicalize'
import { DeduplicationChecker } from './deduplication'
import { SearchFrontier } from './frontier'
import { RelevanceEngine } from './relevance'
import { DiscoveryEventStream } from './streaming'
import { HeroImagePipeline } from './hero-pipeline'
import { audit } from './logger'
import { prisma } from '@/lib/prisma'
import { DiscoveredItem } from '@/types/discovered-content'

export interface DiscoveryConfig {
  maxItems: number
  timeout: number
  batchSize: number
  relevanceThreshold: number
}

export class DiscoveryOrchestrator {
  private deduplication: DeduplicationChecker
  private frontier: SearchFrontier
  private relevance: RelevanceEngine
  private heroPipeline: HeroImagePipeline
  private config: DiscoveryConfig
  private metrics = {
    candidatesProcessed: 0,
    urlsProcessed: 0,
    itemsSaved: 0,
    duplicates: 0,
    failures: 0
  }
  
  constructor(
    private groupId: string,
    private groupName: string,
    private groupHandle: string,
    private eventStream: DiscoveryEventStream,
    private runId: string,
    config: Partial<DiscoveryConfig> = {}
  ) {
    this.deduplication = new DeduplicationChecker()
    this.frontier = new SearchFrontier()
    this.relevance = new RelevanceEngine()
    this.heroPipeline = new HeroImagePipeline(process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com')
    
    this.config = {
      maxItems: 10,
      timeout: 300000, // 5 minutes
      batchSize: 1,
      relevanceThreshold: 0.7, // Raised from 0.3 to 0.7 for better quality
      ...config
    }
  }
  
  /**
   * Start discovery process
   */
  async start(): Promise<void> {
    this.eventStream.start(this.groupId, this.runId)
    await this.emitAudit('run_start', 'pending', {
      meta: {
        maxItems: this.config.maxItems,
        timeoutMs: this.config.timeout
      }
    })

    try {
      await (prisma as any).discoveryRun.update({
        where: { id: this.runId },
        data: {
          status: 'live',
          startedAt: new Date()
        }
      }).catch(() => undefined)

      // Build entity profile
      await this.relevance.buildEntityProfile(this.groupId, this.groupName)
      
      // Initialize search frontier
      await this.initializeFrontier()
      
      // Start discovery loop
      await this.discoveryLoop()

      await this.emitAudit('run_complete', 'ok', {
        meta: this.metrics
      })
      await this.finalizeRun('completed')
      
    } catch (error) {
      console.error('[Discovery Orchestrator] Error:', error)
      await this.emitAudit('run_complete', 'fail', {
        error: this.formatError(error),
        meta: this.metrics
      })
      await this.finalizeRun('error', error)
      this.eventStream.error('Discovery failed', error)
    }
  }
  
  /**
   * Initialize search frontier with seed sources
   */
  private async initializeFrontier(): Promise<void> {
    // Check what Wikipedia pages we've already discovered
    const existingWikiPages = await prisma.discoveredContent.findMany({
      where: {
        patchId: this.groupId,
        sourceUrl: {
          contains: 'wikipedia.org'
        }
      },
      select: {
        sourceUrl: true,
        title: true
      }
    })
    
    console.log(`[Initialize Frontier] Found ${existingWikiPages.length} existing Wikipedia pages`)
    
    // If we already have the main Wikipedia page, use entity-specific searches
    if (existingWikiPages.length > 0) {
      // Progressive Wikipedia strategy: search for specific entities
      const entitiesToSearch = this.getNextWikipediaEntities(this.groupName, existingWikiPages)
      
      for (const entity of entitiesToSearch) {
        this.frontier.addCandidate({
          source: 'wikipedia',
          method: 'api',
          cursor: `search=${encodeURIComponent(entity)}`,
          domain: 'wikipedia.org',
          duplicateRate: 0,
          lastSeen: new Date()
        })
      }
    } else {
      // First run: search for the main topic
      this.frontier.addCandidate({
        source: 'wikipedia',
        method: 'api',
        cursor: `search=${encodeURIComponent(this.groupName)}`,
        domain: 'wikipedia.org',
        duplicateRate: 0,
        lastSeen: new Date()
      })
    }
    
    // Add news sources
    this.frontier.addCandidate({
      source: 'newsapi',
      method: 'api',
      cursor: `q=${encodeURIComponent(this.groupName)}`,
      domain: 'newsapi.org',
      duplicateRate: 0,
      lastSeen: new Date()
    })
    
    // Add RSS feeds (Bulls-specific)
    const rssFeeds = [
      'https://www.espn.com/espn/rss/nba/team/_/name/chi/chicago-bulls',
      'https://www.nba.com/bulls/rss',
      'https://www.blogabull.com/rss/index.xml'
    ]

    rssFeeds.forEach((feedUrl) => {
      this.frontier.addCandidate({
        source: 'rss',
        method: 'rss',
        cursor: feedUrl,
        domain: new URL(feedUrl).hostname,
        duplicateRate: 0,
        lastSeen: new Date()
      })
    })
    
    // Add Bulls-specific Google News RSS
    this.frontier.addCandidate({
      source: 'rss',
      method: 'rss',
      cursor: `https://news.google.com/rss/search?q=${encodeURIComponent(this.groupName)}&hl=en-US&gl=US&ceid=US:en`,
      domain: 'news.google.com',
      duplicateRate: 0,
      lastSeen: new Date()
    })
    
  }
  
  /**
   * Add more Wikipedia entities when frontier is low
   */
  private async addMoreWikipediaEntities(): Promise<void> {
    const additionalEntities = [
      'Chicago Bulls roster',
      'Chicago Bulls coaching staff', 
      'Chicago Bulls draft picks',
      'Chicago Bulls trades',
      'Chicago Bulls championships',
      'Chicago Bulls records',
      'Chicago Bulls statistics',
      'Chicago Bulls arena',
      'Chicago Bulls ownership',
      'Chicago Bulls history'
    ]
    
    for (const entity of additionalEntities) {
      this.frontier.addCandidate({
        source: 'wikipedia',
        method: 'api',
        cursor: `search=${encodeURIComponent(entity)}`,
        domain: 'wikipedia.org',
        duplicateRate: 0,
        lastSeen: new Date()
      })
      console.log(`[Discovery Loop] ➕ Added Wikipedia entity: ${entity}`)
    }
  }

  /**
   * Get next Wikipedia entities to search based on what we already have
   */
  private getNextWikipediaEntities(groupName: string, existingPages: any[]): string[] {
    // For Chicago Bulls, search for key entities
    const bullsEntities = [
      'Michael Jordan',
      'Scottie Pippen',
      'Dennis Rodman',
      'Phil Jackson',
      'Derrick Rose',
      'United Center',
      '1995-96 Chicago Bulls season',
      '1996 NBA Finals',
      'Chicago Bulls dynasty',
      'Zach LaVine',
      'DeMar DeRozan',
      'Nikola Vučević'
    ]
    
    // Filter out entities we've already found
    const existingTitles = existingPages.map(p => p.title.toLowerCase())
    const newEntities = bullsEntities.filter(entity => 
      !existingTitles.some(title => title.includes(entity.toLowerCase()))
    )
    
    // Return up to 3 new entities to search
    return newEntities.slice(0, 3)
  }
  
  /**
   * Main discovery loop - one item at a time
   */
  private async discoveryLoop(): Promise<void> {
    let itemsFound = 0
    let consecutiveDuplicates = 0
    const startTime = Date.now()
    
    console.log(`[Discovery Loop] Starting with maxItems=${this.config.maxItems}, timeout=${this.config.timeout}ms`)
    
    while (itemsFound < this.config.maxItems && (Date.now() - startTime) < this.config.timeout) {
      try {
        // Get next candidate
        const candidate = this.frontier.popMax()
        if (!candidate) {
          console.log(`[Discovery Loop] ❌ No more candidates. Stopping after ${itemsFound} items.`)
          this.eventStream.idle('No more candidates available')
          break
        }
        
        console.log(`[Discovery Loop] 📍 Processing candidate: ${candidate.source} (priority: ${candidate.priority})`)
        this.metrics.candidatesProcessed++
        await this.emitAudit('frontier_pop', 'pending', {
          provider: candidate.source,
          query: candidate.cursor,
          meta: {
            priority: candidate.priority
          }
        })
        this.eventStream.searching(candidate.source)
        
        // Fetch URLs from candidate
        let urls: string[] = []
        try {
          urls = await this.fetchUrls(candidate)
        } catch (fetchError) {
          console.warn('[Discovery Loop] Fetch error for candidate:', candidate.source, fetchError)
          this.metrics.failures++
          await this.emitAudit('fetch', 'fail', {
            provider: candidate.source,
            query: candidate.cursor,
            error: this.formatError(fetchError)
          })
          // Give the loop a moment before continuing with other candidates
          await this.sleep(500)
          continue
        }

        let foundItemInThisCandidate = false
        let processedAnyUrl = false

        if (urls.length === 0) {
          this.metrics.failures++
          processedAnyUrl = true
          await this.emitAudit('fetch', 'fail', {
            provider: candidate.source,
            query: candidate.cursor,
            error: { message: 'No URLs returned' }
          })
        } else {
          await this.emitAudit('fetch', 'ok', {
            provider: candidate.source,
            query: candidate.cursor,
            meta: { urlCount: urls.length }
          })
        }
        
        for (const rawUrl of urls) {
          try {
            this.metrics.urlsProcessed++
            await this.emitAudit('candidate', 'pending', {
              provider: candidate.source,
              candidateUrl: rawUrl
            })
            // Canonicalize URL
            const canonicalResult = await canonicalize(rawUrl)
            const canonicalUrl = canonicalResult.canonicalUrl
            const domain = canonicalResult.finalDomain
            await this.emitAudit('canonicalize', 'ok', {
              provider: candidate.source,
              candidateUrl: rawUrl,
              finalUrl: canonicalUrl,
              meta: { domain }
            })
            
            // Check if URL already exists in database
            const existingItem = await prisma.discoveredContent.findFirst({
              where: {
                patchId: this.groupId,
                OR: [
                  { canonicalUrl },
                  { sourceUrl: canonicalUrl }
                ]
              },
              select: { id: true, title: true }
            })
            
            if (existingItem) {
              console.log(`[Discovery Loop] ⏭️  Skipping duplicate: ${canonicalUrl} (Already in database: ${existingItem.title})`)
              this.eventStream.skipped('duplicate', canonicalUrl, {
                reason: `Already in database: ${existingItem.title}`,
                tier: 'A'
              })
              this.metrics.duplicates++
              await this.emitAudit('duplicate_check', 'fail', {
                candidateUrl: canonicalUrl,
                provider: candidate.source,
                decisions: {
                  action: 'drop',
                  reason: 'duplicate',
                  existingId: existingItem.id
                }
              })
              processedAnyUrl = true // We processed this URL (even though it was duplicate)
              consecutiveDuplicates++
              
              // For citation candidates, don't reinsert since they only have one URL
              if (candidate.source === 'citation') {
                console.log(`[Discovery Loop] 🚫 Citation candidate exhausted (duplicate URL), not reinserting`)
                break // Exit the URL loop since citation candidates only have one URL
              }
              
              continue
            }
            
            // Reset duplicate counter on finding a new item
            consecutiveDuplicates = 0
            
            console.log(`[Discovery Loop] ✅ New URL found: ${canonicalUrl}`)
            
            // Fetch and extract content
            const content = await this.fetchAndExtractContent(canonicalUrl)
            if (!content) {
              console.warn(`[Discovery Loop] ⚠️  Content extraction failed for: ${canonicalUrl}`)
              processedAnyUrl = true // Mark as processed so failed URLs don't get reinserted
              consecutiveDuplicates++
              this.metrics.failures++
              await this.emitAudit('content_extract', 'fail', {
                candidateUrl: canonicalUrl,
                provider: candidate.source,
                error: { message: 'Content extraction failed' }
              })
              
              // For citation candidates, don't reinsert since they only have one URL
              if (candidate.source === 'citation') {
                console.log(`[Discovery Loop] 🚫 Citation candidate exhausted (content extraction failed), not reinserting`)
                break // Exit the URL loop since citation candidates only have one URL
              }
              
              continue
            }
            
            console.log(`[Discovery Loop] ✅ Content extracted: ${content.title} (${content.text.length} chars)`)
            
            // Check relevance
            const relevanceResult = await this.relevance.checkRelevance(
              this.groupId,
              content.title,
              content.text,
              domain
            )
            
            console.log(`[Discovery Loop] 📊 Relevance check: ${content.title}`)
            console.log(`[Discovery Loop]    Score: ${relevanceResult.score.toFixed(2)}`)
            console.log(`[Discovery Loop]    Matched: ${relevanceResult.matchedEntities.join(', ') || 'none'}`)
            
            if (!relevanceResult.isRelevant) {
              console.log(`[Discovery Loop] ⏭️  Skipping irrelevant: ${content.title} (score: ${relevanceResult.score.toFixed(2)})`)
              this.eventStream.skipped('low_relevance', canonicalUrl, {
                score: relevanceResult.score,
                reason: relevanceResult.reason
              })
              this.metrics.failures++
              await this.emitAudit('relevance', 'fail', {
                candidateUrl: canonicalUrl,
                provider: candidate.source,
                scores: { relevance: relevanceResult.score },
                decisions: {
                  action: 'drop',
                  reason: relevanceResult.reason || 'low_relevance'
                }
              })
              processedAnyUrl = true // Mark as processed so it's not reinserted
              consecutiveDuplicates++ // Count as a "failed" attempt
              
              // For citation candidates, don't reinsert since they only have one URL
              if (candidate.source === 'citation') {
                console.log(`[Discovery Loop] 🚫 Citation candidate exhausted (irrelevant content), not reinserting`)
                break // Exit the URL loop since citation candidates only have one URL
              }
              
              continue
            }
            
            // Reset consecutive failures on finding relevant content
            consecutiveDuplicates = 0
            
            // Enrich content
            const enrichedContent = await this.enrichContent(content)
            this.eventStream.enriched(enrichedContent.title, enrichedContent.summary)
            
            // Generate hero image (with properly structured data)
            const heroInput = {
              title: enrichedContent.title,
              content: {
                summary150: enrichedContent.summary
              },
              metadata: {
                topic: this.groupName,
                source: content.url
              }
            }
            
            console.log(`[Discovery Loop] 🎨 Calling hero pipeline for: ${enrichedContent.title}`)
            console.log(`[Discovery Loop]    Input:`, {
              title: heroInput.title,
              summary: heroInput.content.summary150?.substring(0, 100),
              topic: heroInput.metadata.topic
            })
            const heroResult = await this.heroPipeline.assignHero(heroInput)
            if (heroResult) {
              console.log(`[Discovery Loop] ✅ Hero generated successfully:`)
              console.log(`[Discovery Loop]    Source: ${heroResult.source}`)
              console.log(`[Discovery Loop]    URL: ${heroResult.url?.substring(0, 100)}...`)
              this.eventStream.heroReady(heroResult.url, heroResult.source)
            } else {
              console.error(`[Discovery Loop] ❌ HERO GENERATION FAILED for: ${enrichedContent.title}`)
              console.error(`[Discovery Loop]    This item will have NO hero image!`)
            }
            
            // Save item
            const savedItem = await this.saveItem({
              title: enrichedContent.title,
              url: canonicalResult.originalUrl,
              canonicalUrl,
              content: enrichedContent.text,
              summary: enrichedContent.summary,
              keyPoints: enrichedContent.keyPoints,
              notableQuotes: enrichedContent.notableQuotes || [],
              heroUrl: heroResult?.url || '',
              heroSource: heroResult?.source || 'minsvg',
              relevanceScore: relevanceResult.score,
              domain
            })
            
            this.eventStream.saved(savedItem)
            this.metrics.itemsSaved++
            await this.emitAudit('save', 'ok', {
              provider: candidate.source,
              candidateUrl: canonicalUrl,
              finalUrl: canonicalUrl,
              meta: {
                title: enrichedContent.title,
                relevanceScore: relevanceResult.score
              }
            })
            itemsFound++
            foundItemInThisCandidate = true
            
            // If this was a Wikipedia page with citations, queue them for discovery
            if (content.citations && content.citations.length > 0) {
              console.log(`[Discovery Loop] 📚 Found ${content.citations.length} citations to explore`)
              
              // Pre-filter citations for Bulls relevance (lenient - include basketball/nba sites)
              const bullsKeywords = ['bulls', 'chicago', 'jordan', 'pippen', 'lavine', 'derozan', 'vucevic', 'nba', 'basketball', 'espn', 'bleacher']
              const relevantCitations = content.citations.filter((url: string) => {
                const urlLower = url.toLowerCase()
                // Allow if it has Bulls keywords OR is from trusted sports domains
                const hasBullsKeyword = bullsKeywords.some(keyword => urlLower.includes(keyword))
                const isSportsDomain = urlLower.includes('espn.com') || urlLower.includes('nba.com') || urlLower.includes('chicagotribune') || urlLower.includes('bleacherreport')
                return hasBullsKeyword || isSportsDomain
              })
              
              console.log(`[Discovery Loop] 🎯 Filtered to ${relevantCitations.length} Bulls-relevant citations (from ${content.citations.length} total)`)
              
              // If we got very few relevant citations, add some backup Wikipedia searches
              if (relevantCitations.length < 5) {
                console.log(`[Discovery Loop] ⚠️  Only ${relevantCitations.length} relevant citations found, will add more Wikipedia entities`)
              }
              
              // Add up to 10 relevant citations to the frontier
              let citationsAdded = 0
              for (const citationUrl of relevantCitations.slice(0, 10)) {
                try {
                  this.frontier.addCandidate({
                    source: 'citation',
                    method: 'http',
                    cursor: citationUrl,
                    domain: new URL(citationUrl).hostname,
                    duplicateRate: 0,
                    lastSeen: new Date()
                  })
                  citationsAdded++
                  console.log(`[Discovery Loop] ➕ Queued citation ${citationsAdded}: ${citationUrl}`)
                } catch (error) {
                  console.warn(`[Discovery Loop] Failed to queue citation: ${citationUrl}`, error)
                }
              }
              console.log(`[Discovery Loop] ✅ Successfully queued ${citationsAdded} Bulls-relevant citations for processing`)
            } else {
              console.log(`[Discovery Loop] ℹ️  No citations found in this content`)
            }
            
            // Reinsert candidate with advanced cursor
            this.frontier.reinsert(candidate, true)
            
            console.log(`[Discovery Loop] ✅ Item ${itemsFound} saved. Continuing to next candidate...`)
            
            // Break after finding one item (one-at-a-time)
            break
            
          } catch (error) {
            console.warn('[Discovery Loop] Error processing URL:', rawUrl, error)
            
            // Mark as processed so failed URLs don't get reinserted
            processedAnyUrl = true
            consecutiveDuplicates++
            this.metrics.failures++
            await this.emitAudit('processing_error', 'fail', {
              provider: candidate.source,
              candidateUrl: rawUrl,
              error: this.formatError(error)
            })
            
            // For citation candidates, don't reinsert since they only have one URL
            if (candidate.source === 'citation') {
              console.log(`[Discovery Loop] 🚫 Citation candidate exhausted (error processing), not reinserting`)
              break // Exit the URL loop since citation candidates only have one URL
            }
            
            continue
          }
        }
        
        // Only reinsert if we didn't process any URLs from this candidate
        if (!processedAnyUrl) {
          console.log(`[Discovery Loop] No URLs processed from ${candidate.source}, reinserting...`)
          this.frontier.reinsert(candidate, false)
        } else {
          console.log(`[Discovery Loop] Processed URLs from ${candidate.source}, not reinserting (candidate exhausted)`)
        }
        
        console.log(`[Discovery Loop] 🔍 Debug: processedAnyUrl=${processedAnyUrl}, consecutiveDuplicates=${consecutiveDuplicates}`)
        
        // If we're stuck with duplicates, try adding more Wikipedia entities
        const frontierSize = this.frontier.getStats().totalCandidates
        if (consecutiveDuplicates >= 5 || (itemsFound < 3 && frontierSize < 5)) {
          console.log(`[Discovery Loop] 🔄 Stuck with duplicates (${consecutiveDuplicates} consecutive) or low frontier (${frontierSize}), adding more Wikipedia entities...`)
          await this.addMoreWikipediaEntities()
          consecutiveDuplicates = 0 // Reset counter after adding new entities
        }
        
        // Small delay between iterations
        await this.sleep(1000)
        
        console.log(`[Discovery Loop] 🔄 Loop continuing... (${itemsFound}/${this.config.maxItems} items found)`)
        
      } catch (error) {
        console.error('[Discovery Loop] Error:', error)
        this.eventStream.error('Discovery loop error', error)
        break
      }
    }
    
    this.eventStream.idle(`Discovery complete. Found ${itemsFound} items.`)
  }
  
  /**
   * Fetch URLs from a search candidate
   */
  private async fetchUrls(candidate: any): Promise<string[]> {
    console.log(`[Discovery Orchestrator] Fetching URLs from ${candidate.source} (method: ${candidate.method})`)
    
    switch (candidate.source) {
      case 'wikipedia':
        return await this.fetchWikipediaUrls(candidate)
      
      case 'newsapi':
        return await this.fetchNewsApiUrls(candidate)
      
      case 'rss':
        return await this.fetchRssUrls(candidate)
      
      case 'citation':
        // For citations, the cursor is the URL itself
        return [candidate.cursor]
      
      default:
        console.warn(`[Discovery Orchestrator] Unknown source: ${candidate.source}`)
        return []
    }
  }
  
  /**
   * Fetch URLs from Wikipedia
   */
  private async fetchWikipediaUrls(candidate: any): Promise<string[]> {
    try {
      // Parse the search query from cursor
      const searchQuery = candidate.cursor.replace('search=', '')
      const decodedQuery = decodeURIComponent(searchQuery)
      
      console.log(`[Discovery Orchestrator] Searching Wikipedia for: ${decodedQuery}`)
      
      // Search Wikipedia for pages
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(decodedQuery)}&format=json&srlimit=20&origin=*`
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.query || !data.query.search) {
        console.log(`[Discovery Orchestrator] No Wikipedia results for: ${decodedQuery}`)
        return []
      }
      
      // Convert page titles to URLs
      const urls = data.query.search.map((result: any) => {
        const title = result.title.replace(/ /g, '_')
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
      })
      
      console.log(`[Discovery Orchestrator] Found ${urls.length} Wikipedia pages`)
      
      return urls
    } catch (error) {
      console.error('[Discovery Orchestrator] Wikipedia fetch error:', error)
      throw error
    }
  }
  
  /**
   * Fetch URLs from NewsAPI
   */
  private async fetchNewsApiUrls(candidate: any): Promise<string[]> {
    // TODO: Implement NewsAPI integration
    console.log('[Discovery Orchestrator] NewsAPI integration not yet implemented')
    return []
  }
  
  /**
   * Fetch URLs from RSS feeds
   */
  private async fetchRssUrls(candidate: any): Promise<string[]> {
    try {
      const feedUrl = candidate.cursor
      console.log(`[Discovery Orchestrator] Fetching RSS feed: ${feedUrl}`)
      
      // Use a simple fetch to get the RSS feed
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`RSS feed error: ${response.status}`)
      }
      
      const text = await response.text()
      
      // Simple regex to extract URLs from RSS
      const urlRegex = /<link>([^<]+)<\/link>/g
      const urls: string[] = []
      let match
      
      while ((match = urlRegex.exec(text)) !== null) {
        const url = match[1].trim()
        if (url && url.startsWith('http')) {
          urls.push(url)
        }
      }
      
      console.log(`[Discovery Orchestrator] Found ${urls.length} URLs from RSS feed`)
      
      return urls.slice(0, 10) // Limit to 10 URLs per feed
    } catch (error) {
      console.error('[Discovery Orchestrator] RSS fetch error:', error)
      return []
    }
  }
  
  /**
   * Fetch and extract content from URL
   */
  private async fetchAndExtractContent(url: string): Promise<any> {
    try {
      console.log(`[Content Extraction] Fetching: ${url}`)
      
      // Check if this is a Wikipedia page
      const isWikipedia = url.includes('wikipedia.org')
      
      if (isWikipedia) {
        return await this.extractWikipediaContent(url)
      }
      
      // For non-Wikipedia pages, use standard extraction
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
        }
      })
      
      if (!response.ok) {
        return null
      }
      
      const html = await response.text()
      
      // Extract title and content (simplified)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1] : 'Untitled'
      
      // Extract main content (simplified)
      const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || 
                          html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                          html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      const text = contentMatch ? this.stripHtml(contentMatch[1]) : ''
      
      console.log(`[Content Extraction] Extracted ${text.length} chars from ${url}`)
      
      // Reject if content is too short (likely extraction failed)
      if (text.length < 100) {
        console.warn(`[Content Extraction] ❌ Content too short (${text.length} chars), likely extraction failed`)
        return null
      }
      
      return {
        title,
        text: text.substring(0, 5000), // Limit to first 5000 chars
        url,
        citations: []
      }
    } catch (error) {
      console.warn('[Content Extraction] Error:', error)
      return null
    }
  }
  
  /**
   * Extract content from Wikipedia page including citations
   */
  private async extractWikipediaContent(url: string): Promise<any> {
    try {
      console.log(`[Wikipedia Extraction] Fetching Wikipedia page: ${url}`)
      
      // Extract page title from URL
      const titleMatch = url.match(/\/wiki\/([^#?]+)/)
      if (!titleMatch) {
        throw new Error('Invalid Wikipedia URL')
      }
      
      const pageTitle = decodeURIComponent(titleMatch[1].replace(/_/g, ' '))
      
      // Use Wikipedia API to get content
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts|revisions&rvprop=content&format=json&origin=*`
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`)
      }
      
      const data = await response.json()
      const pages = data.query?.pages
      
      if (!pages) {
        throw new Error('No Wikipedia page found')
      }
      
      const page = Object.values(pages)[0] as any
      
      if (!page || page.missing) {
        throw new Error('Wikipedia page does not exist')
      }
      
      // Extract plain text content
      const extract = page.extract || ''
      const text = this.stripHtml(extract)
      
      // Get wiki markup to extract citations
      const wikiMarkup = page.revisions?.[0]?.['*'] || ''
      const citations = this.extractWikipediaCitations(wikiMarkup)
      
      console.log(`[Wikipedia Extraction] Extracted ${text.length} chars and ${citations.length} citations from ${pageTitle}`)
      
      return {
        title: page.title,
        text: text.substring(0, 5000), // First 5000 chars
        url,
        citations
      }
    } catch (error) {
      console.error('[Wikipedia Extraction] Error:', error)
      return null
    }
  }
  
  /**
   * Extract citation URLs from Wikipedia markup
   */
  private extractWikipediaCitations(wikiMarkup: string): string[] {
    const citations: string[] = []
    
    // Match external links in Wikipedia references
    // Format: {{cite web|url=https://example.com|...}}
    const citeRegex = /\{\{cite[^}]*\|url=([^\|}\s]+)/gi
    let match
    
    while ((match = citeRegex.exec(wikiMarkup)) !== null) {
      const url = match[1].trim()
      if (url.startsWith('http')) {
        citations.push(url)
      }
    }
    
    // Also match bare URLs in references section
    const refRegex = /<ref[^>]*>[\s\S]*?https?:\/\/[^\s<]+/gi
    while ((match = refRegex.exec(wikiMarkup)) !== null) {
      const urlMatch = match[0].match(/https?:\/\/[^\s<]+/)
      if (urlMatch) {
        citations.push(urlMatch[0])
      }
    }
    
    // Deduplicate
    return [...new Set(citations)]
  }
  
  /**
   * Enrich content with AI
   */
  private async enrichContent(content: any): Promise<any> {
    console.log(`[Enrich Content] 🤖 Calling DeepSeek to summarize: ${content.title}`)
    
    try {
      // Call DeepSeek API to properly summarize content
      const baseUrl = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com'
      
      console.log(`[Enrich Content] Using baseUrl: ${baseUrl}`)
      
      const summarizeResponse = await fetch(`${baseUrl}/api/ai/summarize-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: content.text.substring(0, 5000), // Limit to ~5000 chars for API
          title: content.title,
          url: content.url,
          groupContext: this.groupName, // Pass "Chicago Bulls" for relevance checking
          temperature: 0.2
        })
      })
      
      if (!summarizeResponse.ok) {
        const errorText = await summarizeResponse.text()
        console.error(`[Enrich Content] Summarize API failed: ${summarizeResponse.status}`)
        console.error(`[Enrich Content] Error response: ${errorText}`)
        console.error(`[Enrich Content] Request URL: ${baseUrl}/api/ai/summarize-content`)
        throw new Error('DeepSeek summarization failed')
      }
      
      const deepSeekResult = await summarizeResponse.json()
      
      console.log(`[Enrich Content] ✅ DeepSeek processed content:`)
      console.log(`[Enrich Content]    Quality Score: ${deepSeekResult.qualityScore || 'N/A'}`)
      console.log(`[Enrich Content]    Relevance Score: ${deepSeekResult.relevanceScore || 'N/A'}`)
      console.log(`[Enrich Content]    Is Useful: ${deepSeekResult.isUseful}`)
      console.log(`[Enrich Content]    Summary length: ${deepSeekResult.summary?.length || 0} chars`)
      console.log(`[Enrich Content]    Key facts: ${deepSeekResult.keyFacts?.length || 0}`)
      console.log(`[Enrich Content]    Notable quotes: ${deepSeekResult.notableQuotes?.length || 0}`)
      
      // Reject low-quality or irrelevant content
      if (deepSeekResult.isUseful === false) {
        console.warn(`[Enrich Content] ❌ Content rejected by DeepSeek: Not useful`)
        throw new Error('Content marked as not useful by DeepSeek')
      }
      
      if (deepSeekResult.qualityScore < 60) {
        console.warn(`[Enrich Content] ❌ Content rejected by DeepSeek: Low quality (${deepSeekResult.qualityScore})`)
        throw new Error('Content failed quality check')
      }
      
      if (deepSeekResult.relevanceScore < 50) {
        console.warn(`[Enrich Content] ❌ Content rejected by DeepSeek: Low relevance to ${this.groupName} (${deepSeekResult.relevanceScore})`)
        throw new Error('Content failed relevance check')
      }
      
      return {
        title: content.title,
        text: content.text,
        summary: deepSeekResult.summary || content.text.substring(0, 180),
        keyPoints: deepSeekResult.keyFacts || [],
        notableQuotes: deepSeekResult.notableQuotes || [],
        qualityScore: deepSeekResult.qualityScore,
        deepseekRelevanceScore: deepSeekResult.relevanceScore,
        metadata: {
          topic: this.groupName,
          source: content.url
        }
      }
      
    } catch (error: any) {
      console.error(`[Enrich Content] ❌ DeepSeek error:`, error)
      
      // If it's a quality/relevance rejection, propagate it (don't save the content)
      if (error.message?.includes('quality check') || error.message?.includes('relevance check') || error.message?.includes('not useful')) {
        console.error(`[Enrich Content] 🚫 Content REJECTED, will not be saved`)
        throw error // Propagate rejection - content won't be saved
      }
      
      // Only use fallback if it's a network/API error (not a content rejection)
      console.warn(`[Enrich Content] ⚠️  API error, using fallback summarization`)
      const sentences = content.text.split(/[.!?]+/).filter((s: string) => s.trim().length > 20)
      const keyPoints = sentences.slice(0, 5).map((s: string) => s.trim())
      const summary = content.text.substring(0, 180).trim() + '...'
      
      return {
        title: content.title,
        text: content.text,
        summary,
        keyPoints: keyPoints.length > 0 ? keyPoints : ['Content summarization unavailable'],
        metadata: {
          topic: this.groupName,
          source: content.url
        }
      }
    }
  }
  
  /**
   * Save item to database
   */
  private async saveItem(item: any): Promise<DiscoveredItem> {
    // Generate URL slug and content URL
    const urlSlug = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Math.random().toString(36).substring(7)}`
    const contentUrl = `/patch/${this.groupHandle}/content/${urlSlug}`
    
    const savedItem = await prisma.discoveredContent.create({
      data: {
        patchId: this.groupId,
        title: item.title,
        sourceUrl: item.url,
        canonicalUrl: item.canonicalUrl,
        content: item.content,
        type: 'article',
        status: 'ready',
        relevanceScore: item.relevanceScore,
        enrichedContent: JSON.stringify({
          summary: item.summary,
          keyPoints: item.keyPoints,
          notableQuotes: item.notableQuotes || []
        }),
        mediaAssets: JSON.stringify({
          hero: item.heroUrl,
          source: item.heroSource
        }),
        metadata: JSON.stringify({
          sourceDomain: item.domain,
          urlSlug: urlSlug,
          contentUrl: contentUrl,
          relevanceScore: item.relevanceScore
        })
      }
    })
    
    // Return properly formatted DiscoveredItem
    return {
      id: savedItem.id,
      type: 'article',
      title: savedItem.title,
      url: savedItem.sourceUrl || '',
      canonicalUrl: savedItem.canonicalUrl || '',
      status: 'ready',
      media: {
        hero: item.heroUrl,
        source: item.heroSource,
        license: item.heroSource === 'ai' ? 'generated' : 'source'
      },
      content: {
        summary150: item.summary,
        keyPoints: item.keyPoints,
        readingTimeMin: Math.ceil(item.content.split(' ').length / 200) // ~200 words per minute
      },
      meta: {
        sourceDomain: item.domain,
        publishDate: savedItem.createdAt.toISOString()
      },
      metadata: {
        contentUrl: contentUrl,
        urlSlug: urlSlug,
        relevanceScore: savedItem.relevanceScore || 0
      }
    }
  }
  
  /**
   * Strip HTML tags
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async emitAudit(
    step: string,
    status: 'pending' | 'ok' | 'fail',
    payload: Record<string, any> = {}
  ): Promise<void> {
    try {
      await audit.emit({
        runId: this.runId,
        patchId: this.groupId,
        step,
        status,
        ...payload
      })
    } catch (error) {
      console.error('[Discovery Orchestrator] Failed to emit audit event', error)
    }
  }

  private async finalizeRun(status: 'completed' | 'error', error?: unknown): Promise<void> {
    try {
      await (prisma as any).discoveryRun.update({
        where: { id: this.runId },
        data: {
          status,
          endedAt: new Date(),
          metrics: {
            ...this.metrics,
            status,
            error: error ? this.formatError(error) : undefined
          }
        }
      })
    } catch (updateError) {
      console.error('[Discovery Orchestrator] Failed to finalize discovery run', updateError)
    }
  }

  private formatError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack
      }
    }
    return { message: typeof error === 'string' ? error : JSON.stringify(error) }
  }
}