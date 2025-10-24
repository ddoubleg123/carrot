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

export interface DiscoveryConfig {
  maxItems: number
  timeout: number
  batchSize: number
  relevanceThreshold: number
}

export interface DiscoveryItem {
  id: string
  title: string
  url: string
  canonicalUrl: string
  content: string
  summary: string
  keyPoints: string[]
  heroUrl: string
  heroSource: string
  relevanceScore: number
  createdAt: Date
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
    // Add Wikipedia sources
    this.frontier.addCandidate({
      source: 'wikipedia',
      method: 'api',
      cursor: `search=${encodeURIComponent(this.groupName)}`,
      domain: 'wikipedia.org',
      duplicateRate: 0,
      lastSeen: new Date()
    })
    
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
   * Main discovery loop - one item at a time
   */
  private async discoveryLoop(): Promise<void> {
    let itemsFound = 0
    const startTime = Date.now()
    
    while (itemsFound < this.config.maxItems && (Date.now() - startTime) < this.config.timeout) {
      try {
        // Get next candidate
        const candidate = this.frontier.popMax()
        if (!candidate) {
          this.eventStream.idle('No more candidates available')
          break
        }
        
        this.eventStream.searching(candidate.source)
        
        // Fetch URLs from candidate
        const urls = await this.fetchUrls(candidate)
        
        for (const rawUrl of urls) {
          try {
            // Canonicalize URL
            const canonicalResult = await canonicalize(rawUrl)
            const canonicalUrl = canonicalResult.canonicalUrl
            const domain = canonicalResult.finalDomain
            
            // Check for duplicates
            const duplicateCheck = await this.deduplication.checkDuplicate(
              this.groupId,
              canonicalUrl,
              '', // Title will be fetched later
              '', // Content will be fetched later
              domain
            )
            
            if (duplicateCheck.isDuplicate) {
              this.eventStream.skipped('duplicate', canonicalUrl, {
                reason: duplicateCheck.reason,
                tier: duplicateCheck.tier
              })
              continue
            }
            
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
            
            if (!relevanceResult.isRelevant) {
              this.eventStream.skipped('low_relevance', canonicalUrl, {
                score: relevanceResult.score,
                reason: relevanceResult.reason
              })
              continue
            }
            
            // Enrich content
            const enrichedContent = await this.enrichContent(content)
            this.eventStream.enriched(enrichedContent.title, enrichedContent.summary)
            
            // Generate hero image
            const heroResult = await this.heroPipeline.assignHero(enrichedContent)
            if (heroResult) {
              this.eventStream.heroReady(heroResult.url, heroResult.source)
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
            
            // Reinsert candidate with advanced cursor
            this.frontier.reinsert(candidate, true)
            
            // Break after finding one item (one-at-a-time)
            break
            
          } catch (error) {
            console.warn('[Discovery Loop] Error processing URL:', rawUrl, error)
            continue
          }
        }
        
        // Reinsert candidate for next iteration
        this.frontier.reinsert(candidate, false)
        
        // Small delay between iterations
        await this.sleep(1000)
        
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
      const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      const text = contentMatch ? this.stripHtml(contentMatch[1]) : ''
      
      return {
        title,
        text,
        url
      }
    } catch (error) {
      console.warn('[Content Extraction] Error:', error)
      return null
    }
  }
  
  /**
   * Enrich content with AI
   */
  private async enrichContent(content: any): Promise<any> {
    // This would call AI service for enrichment
    return {
      title: content.title,
      text: content.text,
      summary: content.text.substring(0, 200) + '...',
      keyPoints: [
        'Key point 1',
        'Key point 2',
        'Key point 3'
      ]
    }
  }
  
  /**
   * Save item to database
   */
  private async saveItem(item: any): Promise<DiscoveryItem> {
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
    
    return {
      id: savedItem.id,
      title: savedItem.title,
      url: savedItem.sourceUrl || '',
      canonicalUrl: savedItem.canonicalUrl || '',
      content: savedItem.content || '',
      summary: item.summary,
      keyPoints: item.keyPoints,
      heroUrl: item.heroUrl,
      heroSource: item.heroSource,
      relevanceScore: savedItem.relevanceScore || 0,
      createdAt: savedItem.createdAt
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