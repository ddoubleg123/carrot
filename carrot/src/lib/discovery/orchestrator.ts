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
  
  constructor(
    private groupId: string,
    private groupName: string,
    private eventStream: DiscoveryEventStream,
    config: Partial<DiscoveryConfig> = {}
  ) {
    this.deduplication = new DeduplicationChecker()
    this.frontier = new SearchFrontier()
    this.relevance = new RelevanceEngine()
    this.heroPipeline = new HeroImagePipeline()
    
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
    try {
      // Build entity profile
      await this.relevance.buildEntityProfile(this.groupId, this.groupName)
      
      // Initialize search frontier
      await this.initializeFrontier()
      
      // Start discovery loop
      await this.discoveryLoop()
      
    } catch (error) {
      console.error('[Discovery Orchestrator] Error:', error)
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
    this.frontier.addCandidate({
      source: 'rss',
      method: 'rss',
      cursor: `https://feeds.feedburner.com/ESPN${this.groupName.replace(' ', '')}`, // e.g., ESPNChicagoBulls
      domain: 'espn.com',
      duplicateRate: 0,
      lastSeen: new Date()
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
    
    this.eventStream.start(this.groupId)
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
        this.eventStream.searching(candidate.source)
        
        // Fetch URLs from candidate
        const urls = await this.fetchUrls(candidate)
        
        let foundItemInThisCandidate = false
        let processedAnyUrl = false
        
        for (const rawUrl of urls) {
          try {
            // Canonicalize URL
            const canonicalResult = await canonicalize(rawUrl)
            const canonicalUrl = canonicalResult.canonicalUrl
            const domain = canonicalResult.finalDomain
            
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
              processedAnyUrl = true // We processed this URL (even though it was duplicate)
              consecutiveDuplicates++
              continue
            }
            
            // Reset duplicate counter on finding a new item
            consecutiveDuplicates = 0
            
            console.log(`[Discovery Loop] ✅ New URL found: ${canonicalUrl}`)
            
            // Fetch and extract content
            const content = await this.fetchAndExtractContent(canonicalUrl)
            if (!content) {
              continue
            }
            
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
              processedAnyUrl = true // Mark as processed so it's not reinserted
              consecutiveDuplicates++ // Count as a "failed" attempt
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
              heroUrl: heroResult?.url || '',
              heroSource: heroResult?.source || 'minsvg',
              relevanceScore: relevanceResult.score,
              domain
            })
            
            this.eventStream.saved(savedItem)
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
    
    try {
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
    } catch (error) {
      console.error(`[Discovery Orchestrator] Error fetching URLs from ${candidate.source}:`, error)
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
      return []
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
    console.log(`[Enrich Content] Processing: ${content.title}`)
    
    // Extract meaningful key points from the content
    const sentences = content.text.split(/[.!?]+/).filter((s: string) => s.trim().length > 20)
    const keyPoints = sentences.slice(0, 5).map((s: string) => s.trim())
    
    // Create a better summary (first 150 chars)
    const summary = content.text.substring(0, 180).trim() + '...'
    
    console.log(`[Enrich Content] Created ${keyPoints.length} key points from ${sentences.length} sentences`)
    
    return {
      title: content.title,
      text: content.text,
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['No key points available'],
      metadata: {
        topic: this.groupName,
        source: content.url
      }
    }
  }
  
  /**
   * Save item to database
   */
  private async saveItem(item: any): Promise<DiscoveredItem> {
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
          keyPoints: item.keyPoints
        }),
        mediaAssets: JSON.stringify({
          hero: item.heroUrl,
          source: item.heroSource
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
}