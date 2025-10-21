/**
 * Main discovery orchestrator that coordinates all discovery components
 * Implements the one-at-a-time loop with SSE streaming
 */

import { canonicalize } from './canonicalize'
import { scoreRelevance, createBullsRelevanceConfig } from './relevance'
import { DeduplicationChecker } from './deduplication'
import { SearchFrontier, RSSProvider, WebSearchProvider } from './frontier'
import { DiscoveryEventStream } from './streaming'
import { HeroImagePipeline } from './hero-pipeline'
import { ContentExtractor, ContentQualityValidator } from './content-quality'
import { auditLogger, AuditStepTypes, AuditStepData } from './audit'

export interface DiscoveryConfig {
  groupId: string
  groupName: string
  groupDescription: string
  groupTags: string[]
  maxItems: number
  timeout: number
}

export interface DiscoveryResult {
  success: boolean
  itemsFound: number
  itemsSkipped: number
  duration: number
  errors: string[]
}

/**
 * Main discovery orchestrator
 */
export class DiscoveryOrchestrator {
  private config: DiscoveryConfig
  private frontier: SearchFrontier
  private deduplication: DeduplicationChecker
  private heroPipeline: HeroImagePipeline
  private isActive = false
  private isPaused = false
  private itemsFound = 0
  private itemsSkipped = 0
  private startTime = 0
  private eventStream?: DiscoveryEventStream

  constructor(config: DiscoveryConfig) {
    this.config = config
    this.frontier = new SearchFrontier(config.groupId)
    this.deduplication = new DeduplicationChecker()
    this.heroPipeline = new HeroImagePipeline()
    
    // Register providers
    this.setupProviders()
  }

  /**
   * Setup search providers
   */
  private setupProviders(): void {
    // RSS Provider for news sources
    const rssProvider = new RSSProvider('espn-rss', 'https://www.espn.com/espn/rss/nba/news')
    this.frontier.registerProvider(rssProvider)
    
    // Web Search Provider
    const searchProvider = new WebSearchProvider('google-search', process.env.GOOGLE_API_KEY || '')
    this.frontier.registerProvider(searchProvider)
  }

  /**
   * Start discovery process
   */
  async start(eventStream: DiscoveryEventStream): Promise<void> {
    this.eventStream = eventStream
    this.isActive = true
    this.isPaused = false
    this.itemsFound = 0
    this.itemsSkipped = 0
    this.startTime = Date.now()

    // Send start event
    eventStream.start(this.config.groupId)

    // Start discovery loop
    await this.runDiscoveryLoop()
  }

  /**
   * Pause discovery
   */
  pause(): void {
    this.isPaused = true
    this.eventStream?.pause()
  }

  /**
   * Resume discovery
   */
  resume(): void {
    this.isPaused = false
    this.eventStream?.idle('Discovery resumed')
  }

  /**
   * Stop discovery
   */
  stop(): void {
    this.isActive = false
    this.isPaused = false
    this.eventStream?.stop('Discovery stopped by user')
  }

  /**
   * Main discovery loop
   */
  private async runDiscoveryLoop(): Promise<void> {
    const relevanceConfig = createBullsRelevanceConfig()
    
    while (this.isActive && this.itemsFound < this.config.maxItems) {
      try {
        // Check if paused
        if (this.isPaused) {
          await this.sleep(1000)
          continue
        }

        // Get next item from frontier
        const frontierItem = this.frontier.getNextItem()
        if (!frontierItem) {
          this.eventStream?.idle('No more sources to search')
          await this.sleep(5000)
          continue
        }

        // Start audit trail
        const auditId = auditLogger.startTrail(this.config.groupId)
        
        // Fetch URLs from provider
        this.eventStream?.searching(frontierItem.source)
        auditLogger.addStep(AuditStepTypes.PROVIDER_FETCH, 
          AuditStepData.providerFetch(frontierItem.source, 0, 0))

        const provider = this.frontier['providers'].get(frontierItem.source)
        if (!provider) {
          this.frontier.updateItemFailure(frontierItem.id, 'error')
          continue
        }

        const searchResult = await provider.fetch(frontierItem.cursor, 10)
        auditLogger.addStep(AuditStepTypes.PROVIDER_FETCH, 
          AuditStepData.providerFetch(frontierItem.source, searchResult.urls.length, 0))

        if (searchResult.urls.length === 0) {
          this.frontier.updateItemFailure(frontierItem.id, 'error')
          continue
        }

        // Process each URL
        for (const url of searchResult.urls) {
          if (!this.isActive || this.itemsFound >= this.config.maxItems) break

          try {
            // Canonicalize URL
            const canonical = canonicalize(url)
            auditLogger.addStep(AuditStepTypes.URL_CANONICALIZE,
              AuditStepData.urlCanonicalize(url, canonical.canonicalUrl))

            // Check for duplicates
            const dupResult = await this.deduplication.checkDuplicate(
              this.config.groupId,
              url,
              '', // Title will be extracted later
              '', // Content will be extracted later
              canonical.domain
            )

            auditLogger.addStep(AuditStepTypes.DUPLICATE_CHECK,
              AuditStepData.duplicateCheck(
                dupResult.isDuplicate ? 'duplicate' : 'unique',
                dupResult.tier || 'none',
                dupResult.similarity
              ))

            if (dupResult.isDuplicate) {
              this.eventStream?.skipped('duplicate', url, { reason: dupResult.reason })
              this.itemsSkipped++
              continue
            }

            // Fetch and extract content
            this.eventStream?.candidate(url)
            const content = await this.fetchAndExtractContent(url)
            
            if (!content) {
              this.eventStream?.skipped('low_relevance', url, { reason: 'Failed to extract content' })
              this.itemsSkipped++
              continue
            }

            // Score relevance
            const relevanceResult = scoreRelevance(content, relevanceConfig)
            auditLogger.addStep(AuditStepTypes.RELEVANCE_SCORE,
              AuditStepData.relevanceScore(relevanceResult.score, relevanceResult.breakdown, relevanceResult.passed))

            if (!relevanceResult.passed) {
              this.eventStream?.skipped('low_relevance', url, { 
                reason: `Score ${relevanceResult.score.toFixed(3)} below threshold`,
                score: relevanceResult.score
              })
              this.itemsSkipped++
              continue
            }

            // Get hero image
            this.eventStream?.enriched(content.title)
            const heroResult = await this.heroPipeline.getHeroImage(
              url,
              content.title,
              content.text,
              content.meta
            )

            if (heroResult) {
              this.eventStream?.heroReady(heroResult.url, heroResult.source)
            }

            // Validate content quality
            const qualityResult = ContentQualityValidator.validate(content)
            if (!qualityResult.isValid) {
              this.eventStream?.skipped('low_relevance', url, { 
                reason: 'Content quality too low',
                issues: qualityResult.issues
              })
              this.itemsSkipped++
              continue
            }

            // Save to database
            const savedItem = await this.saveItem({
              ...content,
              heroImage: heroResult?.url,
              heroSource: heroResult?.source,
              relevanceScore: relevanceResult.score,
              qualityScore: qualityResult.score
            })

            if (savedItem) {
              this.eventStream?.saved(savedItem)
              this.itemsFound++
              auditLogger.completeTrail('saved', 'Item successfully saved', relevanceResult.score)
            } else {
              this.eventStream?.skipped('low_relevance', url, { reason: 'Failed to save item' })
              this.itemsSkipped++
            }

          } catch (error) {
            console.error('[DiscoveryOrchestrator] Error processing URL:', error)
            this.eventStream?.error(`Error processing ${url}: ${error}`)
            auditLogger.addStep(AuditStepTypes.ERROR, AuditStepData.error(String(error), 'url_processing'))
          }

          // Small delay between items
          await this.sleep(300 + Math.random() * 500)
        }

        // Update frontier
        this.frontier.updateItemSuccess(frontierItem.id, searchResult.nextCursor, searchResult.urls.length)

        // Break if we found an item (one-at-a-time)
        if (this.itemsFound > 0) {
          break
        }

      } catch (error) {
        console.error('[DiscoveryOrchestrator] Loop error:', error)
        this.eventStream?.error(`Discovery loop error: ${error}`)
        await this.sleep(5000)
      }
    }

    // Auto-restart if we hit the limit
    if (this.itemsFound >= this.config.maxItems && this.isActive) {
      this.eventStream?.idle('Auto-restarting after 10 items')
      await this.sleep(2000)
      await this.runDiscoveryLoop()
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
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) return null

      const html = await response.text()
      return await ContentExtractor.extractFromHtml(html, url)
    } catch {
      return null
    }
  }

  /**
   * Save item to database
   */
  private async saveItem(item: any): Promise<any> {
    try {
      const response = await fetch('/api/patches/discovered-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patchId: this.config.groupId,
          title: item.title,
          sourceUrl: item.meta.url,
          canonicalUrl: canonicalize(item.meta.url).canonicalUrl,
          type: 'article',
          content: item.text,
          relevanceScore: Math.floor(item.relevanceScore * 100),
          status: 'ready',
          enrichedContent: {
            summary150: item.summary,
            keyPoints: item.keyPoints,
            readingTime: item.readingTime
          },
          mediaAssets: {
            hero: item.heroImage,
            source: item.heroSource
          }
        })
      })

      if (!response.ok) return null

      return await response.json()
    } catch {
      return null
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get discovery statistics
   */
  getStats(): {
    isActive: boolean
    isPaused: boolean
    itemsFound: number
    itemsSkipped: number
    duration: number
    frontierStats: any
  } {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      itemsFound: this.itemsFound,
      itemsSkipped: this.itemsSkipped,
      duration: Date.now() - this.startTime,
      frontierStats: this.frontier.getStats()
    }
  }
}
