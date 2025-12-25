/**
 * Main Discovery Orchestrator
 * Coordinates all discovery components for one-at-a-time processing
 */

import { Prisma } from '@prisma/client'
import { canonicalize, canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'
import { DeduplicationChecker, EnhancedDeduplicationChecker, SimHash } from './deduplication'
import { SearchFrontier } from './frontier'
import { RelevanceEngine } from './relevance'
import { DiscoveryEventStream } from './streaming'
import { HeroImagePipeline } from './hero-pipeline'
import { audit } from './logger'
import { prisma } from '@/lib/prisma'
import { DiscoveredItem } from '@/types/discovered-content'
import { isOpenEvidenceV2Enabled } from './flags'
import { isSeen, markAsSeen } from '@/lib/redis/discovery'
import {
  DiscoveryPlan,
  generateGuideSnapshot,
  normaliseSeedCandidate,
  PlannerSeedCandidate
} from './planner'
// Removed Bulls-specific static seeds - discovery is now generic

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
  private stopRequested = false
  private queuedCanonicalUrls = new Set<string>()
  private plannerGuide: DiscoveryPlan | null = null
  
  constructor(
    private groupId: string,
    private groupName: string,
    private groupHandle: string,
    private eventStream: DiscoveryEventStream,
    private runId: string,
    config: Partial<DiscoveryConfig> = {}
  ) {
    this.deduplication = isOpenEvidenceV2Enabled()
      ? new EnhancedDeduplicationChecker()
      : new DeduplicationChecker()
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
      
      await this.ensurePlannerGuide()
      
      // Initialize search frontier
      await this.initializeFrontier()
      
      // Start discovery loop
      await this.discoveryLoop()

      if (this.stopRequested) {
        await this.emitAudit('run_complete', 'ok', {
          meta: { ...this.metrics, stopped: true },
          decisions: {
            action: 'suspend',
            reason: 'user_requested_stop'
          }
        })
        await this.finalizeRun('suspended')
        return
      }

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

  requestStop(): void {
    if (this.stopRequested) return
    this.stopRequested = true
    this.eventStream.stop()
  }

  /**
   * Initialize search frontier with seed sources
   */
  private async initializeFrontier(): Promise<void> {
    if (this.plannerGuide && this.plannerGuide.seedCandidates?.length) {
      const added = await this.seedFrontierFromPlanner(this.plannerGuide)
      if (added > 0) {
        console.log(`[Initialize Frontier] Seeded ${added} planner candidates for ${this.groupName}`)
        return
      }
      console.warn('[Initialize Frontier] Planner seeds missing or invalid, falling back to legacy seeds')
    }

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
    
    // Add generic Google News RSS for the topic
    this.frontier.addCandidate({
      source: 'rss',
      method: 'rss',
      cursor: `https://news.google.com/rss/search?q=${encodeURIComponent(this.groupName)}&hl=en-US&gl=US&ceid=US:en`,
      domain: 'news.google.com',
      duplicateRate: 0,
      lastSeen: new Date()
    })
    
  }

  private async ensurePlannerGuide(): Promise<void> {
    try {
      const patch = await prisma.patch.findUnique({
        where: { id: this.groupId },
        select: {
          title: true,
          tags: true,
          entity: true,
          guide: true
        }
      })

      if (!patch) {
        console.warn('[Discovery Orchestrator] Failed to load patch for planner guide', this.groupId)
        return
      }

      let guide = patch.guide as unknown as DiscoveryPlan | null
      if (!guide) {
        const entityName = (patch.entity as any)?.name
        const entityAliases = Array.isArray((patch.entity as any)?.aliases)
          ? (patch.entity as any).aliases.filter((value: unknown): value is string => typeof value === 'string')
          : []
        const topic = typeof entityName === 'string' && entityName.trim().length ? entityName.trim() : patch.title
        const aliases =
          entityAliases.length > 0
            ? entityAliases
            : patch.tags.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)

        guide = await generateGuideSnapshot(topic, aliases)
        await prisma.patch.update({
          where: { id: this.groupId },
          data: { guide: guide as unknown as Prisma.JsonObject }
        })
      }

      if (guide) {
        const seeds = Array.isArray(guide.seedCandidates) ? guide.seedCandidates.filter((seed) => seed?.url) : []
        if (seeds.length === 0) {
          console.warn('[Discovery Orchestrator] Planner guide has no seeds', this.groupId)
        } else if (seeds.length !== 10) {
          console.warn(
            '[Discovery Orchestrator] Planner guide does not contain exactly 10 seeds',
            this.groupId,
            seeds.length
          )
        }
        this.plannerGuide = {
          ...guide,
          seedCandidates: seeds.map((seed) => {
            try {
              return normaliseSeedCandidate(seed as PlannerSeedCandidate)
            } catch (error) {
              console.warn('[Discovery Orchestrator] Invalid planner seed skipped', seed, error)
              return null
            }
          }).filter((seed): seed is PlannerSeedCandidate => Boolean(seed))
        }
      }
    } catch (error) {
      console.error('[Discovery Orchestrator] Failed to ensure planner guide', error)
      this.plannerGuide = null
    }
  }

  private async seedFrontierFromPlanner(plan: DiscoveryPlan): Promise<number> {
    if (!plan.seedCandidates?.length) {
      return 0
    }

    const isDirectoryOrListingPage = (url: string): boolean => {
      try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname.toLowerCase()
        const hostname = urlObj.hostname.toLowerCase()

        if (pathname.includes('/privacy') || hostname.includes('privacy')) return true
        if (pathname === '/' || pathname.match(/^\/[^\/]+\/$/)) return true

        const directoryPatterns = [
          /\/tag\//,
          /\/category\//,
          /\/archive\//,
          /\/sitemap/,
          /\/feed/,
          /\/rss/,
          /\/news\/?$/,
          /\/articles\/?$/,
          /\/blog\/?$/,
          /\/sites\/[^\/]+\/?$/,
          /\/sports\/[^\/]+\/?$/,
          /\/sports\/[^\/]+\/[^\/]+\/?$/,
          /\/nba\/[^\/]+\/?$/
        ]
        if (directoryPatterns.some((p) => p.test(pathname))) return true

        const segments = pathname.split('/').filter(Boolean)
        if (pathname.endsWith('/') && segments.length >= 2) return true

        if (segments.length >= 2) {
          const last = segments[segments.length - 1]
          const categoryWords = ['news', 'sports', 'tag', 'category', 'archive', 'blog', 'articles', 'bulls']
          if (categoryWords.includes(last) || last.length < 5) return true
          const hasSportsPath = pathname.includes('/sports/') || pathname.includes('/nba/')
          const looksLikeArticleSlug = /\d{4}|\d{2}-\d{2}|article|story|post/.test(last)
          if (hasSportsPath && !looksLikeArticleSlug && last.length > 5 && last.length < 30) return true
        }
        return false
      } catch {
        return false
      }
    }

    const seedsSorted = [...plan.seedCandidates].sort((a, b) => {
      const priorityA = a.priority ?? 999
      const priorityB = b.priority ?? 999
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      return 0
    })

    const domainCounts = new Map<string, number>()
    let contestedCount = 0
    let establishmentCount = 0
    const selected: PlannerSeedCandidate[] = []

    for (const candidate of seedsSorted) {
      if (!candidate.url) continue
      // Skip directory/listing pages to avoid fetch: content_too_short
      if (isDirectoryOrListingPage(candidate.url)) continue
      const isContested = candidate.stance === 'contested' || candidate.isControversy === true
      if (isContested) {
        if (contestedCount >= 5) continue
      } else if (establishmentCount >= 5) {
        continue
      }

      let domain = 'unknown'
      try {
        domain = new URL(candidate.url).hostname.toLowerCase()
      } catch {
        // ignore malformed host
      }

      const currentCount = domainCounts.get(domain) ?? 0
      const uniqueDomainCount = domainCounts.size
      
      // Guarantee at least 10 distinct domains
      // If we have < 10 unique domains, allow up to 3 per domain
      // Once we have 10+ unique domains, limit to 2 per domain
      const domainLimit = uniqueDomainCount < 10 ? 3 : 2
      if (currentCount >= domainLimit) continue
      
      // Track unique domains
      if (!domainCounts.has(domain)) {
        domainCounts.set(domain, 0)
      }
      domainCounts.set(domain, currentCount + 1)
      selected.push(candidate as PlannerSeedCandidate)
      if (isContested) contestedCount++
      else establishmentCount++

      // Continue until we have at least 10 unique domains OR 10 items
      // But prioritize getting 10 unique domains
      if (domainCounts.size >= 10 && selected.length >= 10) break
    }

    if (!selected.length) {
      return 0
    }

    let finalUniqueDomainCount = domainCounts.size
    const minUniqueDomains = Number(process.env.DISCOVERY_MIN_UNIQUE_DOMAINS || 5)
    
    // Log seed generation
    const { discoveryLogger } = await import('./structuredLogger')
    discoveryLogger.seed(selected.length, finalUniqueDomainCount, {
      patchId: this.groupId,
      runId: this.runId
    })
    
    if (finalUniqueDomainCount < 10) {
      console.warn(
        '[Initialize Frontier] Only got',
        finalUniqueDomainCount,
        'unique domains (target: 10). Seeds:',
        selected.length
      )
      // If we have < minUniqueDomains unique domains, add static fallback seeds
      if (finalUniqueDomainCount < minUniqueDomains) {
        console.warn(
          `[Initialize Frontier] Low seed diversity (${finalUniqueDomainCount} < ${minUniqueDomains}), adding static fallback seeds`
        )
        
        // Static seeds removed - discovery now uses dynamic seed generation
        // This allows all topics to work generically without hardcoded seeds
        const staticSeeds: any[] = []
        const existingDomains = new Set(domainCounts.keys())
        
        for (const staticSeed of staticSeeds) {
          if (selected.length >= 20) break // Don't add too many
          
          const staticDomain = staticSeed.domain.toLowerCase()
          // Only add if domain is new or we have very few domains
          if (!existingDomains.has(staticDomain) || finalUniqueDomainCount < 5) {
            const staticCandidate: PlannerSeedCandidate = {
              url: staticSeed.url,
              titleGuess: staticSeed.title,
              category: staticSeed.category as PlannerSeedCandidate['category'],
              angle: 'coverage', // Generic angle for fallback seeds
              priority: 3, // Low priority fallback (3 is lowest valid priority)
              stance: 'establishment',
              isControversy: false
            }
            selected.push(staticCandidate)
            
            if (!existingDomains.has(staticDomain)) {
              domainCounts.set(staticDomain, 1)
              existingDomains.add(staticDomain)
              finalUniqueDomainCount = domainCounts.size
            } else {
              domainCounts.set(staticDomain, (domainCounts.get(staticDomain) || 0) + 1)
            }
          }
        }
        
        console.log(
          `[Initialize Frontier] After fallback: ${selected.length} seeds from ${domainCounts.size} unique domains`
        )
        
        // If still below minimum after fallback, warn but proceed (never abort)
        if (domainCounts.size < minUniqueDomains) {
          console.warn(
            `[Initialize Frontier] Still low diversity after fallback (${domainCounts.size} < ${minUniqueDomains}), but proceeding anyway`
          )
        }
      }
    }

    const seeds = selected.map((seed, index) => {
      let domain = 'unknown'
      try {
        domain = new URL(seed.url).hostname
      } catch {
        // ignore
      }

      const basePriority =
        seed.priority === 1 ? 500 : seed.priority === 2 ? 420 : seed.priority === 3 ? 360 : 300 - index * 5
      const stanceBoost = seed.stance === 'contested' || seed.isControversy ? 40 : 0

      return {
        source: 'direct',
        method: 'direct',
        cursor: seed.url,
        domain,
        lastSeen: new Date(),
        duplicateRate: 0,
        priority: basePriority + stanceBoost,
        meta: {
          directSeed: true,
          planPriority: seed.priority,
          angle: seed.angle,
          stance: seed.stance ?? (seed.isControversy ? 'contested' : 'establishment'),
          category: seed.category,
          expectedInsights: seed.expectedInsights,
          credibilityTier: seed.credibilityTier,
          noveltySignals: seed.noveltySignals,
          quotePullHints: seed.quotePullHints,
          verification: seed.verification,
          isControversy: seed.isControversy ?? seed.stance === 'contested',
          isHistory: seed.isHistory,
          whyItMatters: seed.whyItMatters,
          notes: seed.notes,
          titleGuess: seed.titleGuess
        }
      }
    })

    let inserted = 0
    for (const seed of seeds) {
      this.frontier.addCandidate(seed)
      inserted++
    }
    return inserted
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
   * This is now generic - entities are discovered dynamically from Wikipedia pages
   */
  private getNextWikipediaEntities(groupName: string, existingPages: any[]): string[] {
    // Generic approach: extract entities from existing Wikipedia pages
    // This allows any topic to discover related entities dynamically
    // Return empty array - entities will be discovered from Wikipedia links
    return []
  }
  
  /**
   * Main discovery loop - one item at a time
   */
  private async discoveryLoop(): Promise<void> {
    let itemsFound = 0
    let consecutiveDuplicates = 0
    const startTime = Date.now()
    
    console.log(`[Discovery Loop] Starting with maxItems=${this.config.maxItems}, timeout=${this.config.timeout}ms`)
    
    while (!this.stopRequested && itemsFound < this.config.maxItems && (Date.now() - startTime) < this.config.timeout) {
      if (this.stopRequested) {
        break
      }
      try {
        // Get next candidate
        const candidate = this.frontier.popMax()
        if (!candidate) {
          console.log(`[Discovery Loop] ❌ No more candidates. Stopping after ${itemsFound} items.`)
          this.eventStream.idle('No more candidates available')
          break
        }
 
        if (this.stopRequested) {
          console.log('[Discovery Loop] ⏹️ Stop requested. Exiting before processing candidate.')
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
          if (this.stopRequested) {
            console.log('[Discovery Loop] ⏹️ Stop requested during URL processing. Exiting loop.')
            break
          }
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
              if (isOpenEvidenceV2Enabled()) {
                try {
                  await markAsSeen(this.groupId, canonicalUrl, 30)
                } catch (redisError) {
                  console.warn('[Discovery Loop] Failed to mark duplicate URL as seen in Redis', redisError)
                }
              }
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
            const heroResult = await this.heroPipeline.assignHero({
              title: enrichedContent.title,
              summary: enrichedContent.summary,
              topic: this.groupName
            })
            if (heroResult) {
              console.log(`[Discovery Loop] ✅ Hero generated successfully:`)
              console.log(`[Discovery Loop]    Source: ${heroResult.source}`)
              console.log(`[Discovery Loop]    URL: ${heroResult.url?.substring(0, 100)}...`)
              this.eventStream.heroReady(heroResult.url, heroResult.source)
              await this.emitAudit('hero', 'ok', {
                candidateUrl: canonicalUrl,
                meta: { heroSource: heroResult.source }
              })
            } else {
              console.error(`[Discovery Loop] ❌ HERO GENERATION FAILED for: ${enrichedContent.title}`)
              console.error(`[Discovery Loop]    This item will have NO hero image!`)
            }
            
            // Save item
            const simHash = SimHash.generate(content.text)
            if (this.deduplication instanceof EnhancedDeduplicationChecker) {
              const redisCheck = await this.deduplication.checkDuplicateRedis(this.groupId, canonicalUrl, simHash.toString())
              if (redisCheck.isDuplicate) {
                console.log(`[Discovery Loop] ⏭️  Skipping duplicate by Redis: ${redisCheck.reason}`)
                try {
                  await markAsSeen(this.groupId, canonicalUrl, 30)
                } catch (redisError) {
                  console.warn('[Discovery Loop] Failed to mark Redis duplicate as seen', redisError)
                }
                this.metrics.duplicates++
                await this.emitAudit('duplicate_check', 'fail', {
                  candidateUrl: canonicalUrl,
                  provider: candidate.source,
                  decisions: {
                    action: 'drop',
                    reason: redisCheck.reason,
                    tier: 'redis'
                  }
                })
                this.eventStream.skipped('duplicate', canonicalUrl, { reason: redisCheck.reason })
                continue
              }
            }

            const savedItem = await this.saveItem({
              title: enrichedContent.title,
              url: canonicalResult.originalUrl,
              canonicalUrl,
              content: enrichedContent.text,
              summary: enrichedContent.summary,
              keyPoints: enrichedContent.keyPoints,
              notableQuotes: enrichedContent.notableQuotes || [],
              heroUrl: heroResult?.url || '',
              heroSource: heroResult?.source || 'skeleton',
              relevanceScore: relevanceResult.score,
              domain
            })
            
            this.eventStream.saved(savedItem)
            this.metrics.itemsSaved++

            if (this.deduplication instanceof EnhancedDeduplicationChecker) {
              await this.deduplication.markAsSeenRedis(this.groupId, canonicalUrl, simHash.toString())
            } else {
              this.deduplication.markAsSeen(this.groupId, canonicalUrl, enrichedContent.text, domain, enrichedContent.title)
            }
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
              // Use all citations - relevance filtering happens later via RelevanceEngine
              const relevantCitations = content.citations
              
              console.log(`[Discovery Loop] 🎯 Found ${relevantCitations.length} citations to explore (from ${content.citations.length} total)`)
              
              // If we got very few relevant citations, add some backup Wikipedia searches
              if (relevantCitations.length < 5) {
                console.log(`[Discovery Loop] ⚠️  Only ${relevantCitations.length} relevant citations found, will add more Wikipedia entities`)
              }
              
              // Add up to 10 relevant citations to the frontier
              let citationsAdded = 0
              for (const citationUrl of relevantCitations.slice(0, 10)) {
                try {
                  const canonicalCitation = await canonicalize(citationUrl)
                  const canonicalCitationUrl = canonicalCitation.canonicalUrl

                  if (!canonicalCitationUrl) {
                    continue
                  }

                  if (this.queuedCanonicalUrls.has(canonicalCitationUrl)) {
                    continue
                  }

                  if (isOpenEvidenceV2Enabled()) {
                    try {
                      if (await isSeen(this.groupId, canonicalCitationUrl)) {
                        continue
                      }
                    } catch (seenError) {
                      console.warn('[Discovery Loop] Failed to check Redis seen state for citation', seenError)
                    }
                  }

                  this.frontier.addCandidate({
                    source: 'citation',
                    method: 'http',
                    cursor: canonicalCitationUrl,
                    domain: canonicalCitation.finalDomain,
                    duplicateRate: 0,
                    lastSeen: new Date()
                  })
                  this.queuedCanonicalUrls.add(canonicalCitationUrl)
                  citationsAdded++
                  console.log(`[Discovery Loop] ➕ Queued citation ${citationsAdded}: ${canonicalCitationUrl}`)
                } catch (error) {
                  console.warn(`[Discovery Loop] Failed to queue citation: ${citationUrl}`, error)
                }
              }
              console.log(`[Discovery Loop] ✅ Successfully queued ${citationsAdded} citations for processing`)
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
 
        if (this.stopRequested) {
          console.log('[Discovery Loop] ⏹️ Stop requested after candidate processing. Breaking out of loop.')
          break
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
    
    if (!this.stopRequested) {
      this.eventStream.idle(`Discovery complete. Found ${itemsFound} items.`)
    }
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
      
      case 'direct':
        // For direct seeds, the cursor is the URL itself - route to HTTP fetcher
        // This will be handled by the engine's processCandidate which uses HttpFetcher
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
      const params = new URLSearchParams(candidate.cursor)
      const searchQuery = params.get('search') || candidate.cursor.replace('search=', '')
      const offset = parseInt(params.get('offset') ?? '0', 10)
      const decodedQuery = decodeURIComponent(searchQuery || '')

      console.log(`[Discovery Orchestrator] Searching Wikipedia for: ${decodedQuery} (offset=${offset})`)

      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(decodedQuery)}&sroffset=${offset}&format=json&srlimit=20&srprop=snippet&origin=*`

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

      const urls: string[] = []
      const seenTitles = new Set<string>()

      for (const result of data.query.search as Array<{ title: string }>) {
        const normalizedTitle = result.title.toLowerCase()
        if (seenTitles.has(normalizedTitle)) {
          continue
        }
        seenTitles.add(normalizedTitle)

        const title = result.title.replace(/ /g, '_')
        urls.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`)
      }

      console.log(`[Discovery Orchestrator] Found ${urls.length} Wikipedia pages (offset=${offset})`)

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
      
      // Check if this is an Anna's Archive book URL
      const isAnnasArchive = url.includes('annas-archive.org') && (url.includes('/md5/') || url.includes('/book/') || url.includes('/file/'))
      
      if (isAnnasArchive) {
        return await this.extractAnnasArchiveContent(url)
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
   * Extract content from Anna's Archive book
   */
  private async extractAnnasArchiveContent(url: string): Promise<any> {
    try {
      console.log(`[Anna's Archive Extraction] Extracting book content from: ${url}`)
      
      // Import the extraction function
      const { extractBookContent } = await import('../../../scripts/extract-annas-archive-book')
      
      // Extract full book content (this includes DRM handling)
      const fullContent = await extractBookContent(url)
      
      if (!fullContent || fullContent.length < 100) {
        console.warn(`[Anna's Archive Extraction] ❌ Content extraction failed or too short (${fullContent?.length || 0} chars)`)
        return null
      }
      
      // Extract title from URL or content
      // Try to get title from the page first
      let title = 'Untitled Book'
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
          }
        })
        if (response.ok) {
          const html = await response.text()
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (titleMatch) {
            title = titleMatch[1].replace(/\s*[-|]\s*Anna's Archive.*$/i, '').trim()
          }
        }
      } catch (error) {
        // If title extraction fails, use default
        console.warn(`[Anna's Archive Extraction] Could not extract title from page: ${error}`)
      }
      
      console.log(`[Anna's Archive Extraction] ✅ Extracted ${fullContent.length} chars from: ${title}`)
      
      return {
        title,
        text: fullContent.substring(0, 20000), // Limit to first 20000 chars for processing
        url,
        citations: [],
        metadata: {
          source: 'annas-archive',
          fullContentLength: fullContent.length
        }
      }
    } catch (error: any) {
      console.error(`[Anna's Archive Extraction] ❌ Error extracting book content:`, error)
      return null
    }
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
      
      // Self-audit: Log grammar/quality issues for monitoring
      const qualityScore = deepSeekResult.qualityScore || 0
      const hasGrammarIssues = deepSeekResult.issues?.some((issue: string) => 
        issue.toLowerCase().includes('grammar') || 
        issue.toLowerCase().includes('spelling') ||
        issue.toLowerCase().includes('fixed')
      ) || false
      
      if (qualityScore < 70 || hasGrammarIssues) {
        console.log(`[Enrich Content] ⚠️  Quality/grammar issues detected (score: ${qualityScore})`)
        console.log(`[Enrich Content]    Issues: ${deepSeekResult.issues?.join(', ') || 'None listed'}`)
      }
      
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
    
    const canonicalUrl = item.canonicalUrl || canonicalizeUrlFast(item.url)
    // Extract domain with fallback: item.domain -> item.url -> canonicalUrl -> null
    const domain = item.domain 
      ? getDomainFromUrl(item.domain) 
      : getDomainFromUrl(item.url) ?? getDomainFromUrl(canonicalUrl) ?? null

    try {
      const savedItem = await prisma.discoveredContent.create({
        data: {
          patchId: this.groupId,
          title: item.title,
          sourceUrl: item.url,
          canonicalUrl,
          domain,
          category: 'article',
          summary: item.summary || item.content.substring(0, 240),
          whyItMatters: '',
          relevanceScore: item.relevanceScore ?? 0,
          qualityScore: item.qualityScore ?? 0,
          facts: (item.keyPoints || []).map((point: string, index: number) => ({
            label: `Insight ${index + 1}`,
            value: point,
            citation: item.url
          })) as Prisma.InputJsonValue,
          quotes: (item.notableQuotes || []).map((quote: any) => ({
            text: typeof quote === 'string' ? quote : quote?.text,
            speaker: quote?.speaker,
            citation: quote?.citation || item.url
          })) as Prisma.InputJsonValue,
          provenance: [item.url] as unknown as Prisma.InputJsonValue,
          hero: {
            url: item.heroUrl,
            source: item.heroSource,
            license: item.heroSource === 'ai' ? 'generated' : 'source',
            enrichedAt: new Date().toISOString(),
            origin: 'legacy-orchestrator'
          } as Prisma.JsonObject,
          metadata: {
            sourceDomain: item.domain,
            urlSlug,
            contentUrl,
            keyPoints: item.keyPoints || [],
            notableQuotes: item.notableQuotes || [],
            relevanceScore: item.relevanceScore,
            processedAt: new Date().toISOString()
          } as Prisma.JsonObject
        }
      })
 
      // Trigger automatic content cleanup (non-blocking)
      import('@/lib/enrichment/autoCleanup').then(({ autoCleanupContent }) => {
        autoCleanupContent(savedItem.id).catch(err => {
          console.warn(`[Orchestrator] Auto-cleanup failed for ${savedItem.id}:`, err)
        })
      }).catch(() => {
        // Ignore import errors - cleanup can happen later
      })

      // Trigger hero image self-audit if missing or placeholder (non-blocking)
      const heroJson = savedItem.hero as any
      const heroUrl = heroJson?.url
      const isPlaceholder = !heroUrl || 
        heroUrl.includes('via.placeholder.com') || 
        heroUrl.includes('placeholder') ||
        heroUrl.startsWith('data:image/svg') ||
        heroUrl.includes('skeleton')
      
      if (isPlaceholder) {
        console.log(`[Orchestrator] 🎨 Hero image missing/placeholder, triggering self-audit for: ${savedItem.title}`)
        // Trigger hero generation via enrichment worker (non-blocking)
        import('@/lib/enrichment/worker').then(({ enrichContentId }) => {
          enrichContentId(savedItem.id).then(result => {
            if (result.ok) {
              console.log(`[Orchestrator] ✅ Self-audit generated hero image for: ${savedItem.title}`)
            }
          }).catch(err => {
            console.warn(`[Orchestrator] Self-audit hero generation failed for ${savedItem.id}:`, err)
          })
        }).catch(() => {
          // Ignore import errors - can be fixed later
        })
      }

      // Enqueue for agent feeding (background, non-blocking)
      try {
        const { enqueueDiscoveredContent, calculateContentHash } = await import('@/lib/agent/feedWorker')
        const contentHash = savedItem.contentHash || calculateContentHash(
          savedItem.title,
          savedItem.summary,
          item.content || savedItem.textContent
        )
        await enqueueDiscoveredContent(
          savedItem.id,
          this.groupId,
          contentHash,
          0 // Default priority
        ).catch(err => {
          // Non-fatal - log but don't fail
          console.warn(`[Orchestrator] Failed to enqueue content for agent feeding:`, err)
        })
      } catch (enqueueError) {
        // Non-fatal - log but don't fail
        console.warn(`[Orchestrator] Error importing enqueue function:`, enqueueError)
      }

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
          summary150: item.summary || item.content.substring(0, 150),
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
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.warn('[Discovery Orchestrator] Duplicate canonical URL skipped', {
          patchId: this.groupId,
          canonicalUrl
        })
        throw new Error('Duplicate discovered content')
      }
      
      // Log domain-related errors with full context
      if (error?.message?.includes('domain') || error?.code === 'P2003') {
        console.error('[Discovery Orchestrator] Failed to save discovered content (domain error):', {
          error: error.message,
          code: error.code,
          patchId: this.groupId,
          canonicalUrl,
          domain,
          title: item.title,
          url: item.url
        })
      }
      
      throw error
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

  private async finalizeRun(status: 'completed' | 'error' | 'suspended', error?: unknown): Promise<void> {
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