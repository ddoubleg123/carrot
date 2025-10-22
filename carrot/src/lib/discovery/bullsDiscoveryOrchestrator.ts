/**
 * Bulls-Specific Discovery Orchestrator
 * Implements Wikipedia-first strategy with hard relevance gates
 */

import { GroupProfile, getGroupProfile } from './groupProfiles'
import { WikipediaParser, WikipediaResult } from './wikipediaParser'
import { canonicalize } from './canonicalization'
import { SimHash } from './deduplication'

export interface BullsDiscoveryResult {
  sources: DiscoveredSource[]
  wikipediaResult: WikipediaResult
  stats: {
    wikipediaPages: number
    wikipediaCitations: number
    newsArticles: number
    totalSources: number
    duplicatesRemoved: number
    relevanceFiltered: number
  }
}

export interface DiscoveredSource {
  id: string
  title: string
  url: string
  canonicalUrl: string
  type: 'wikipedia' | 'citation' | 'news' | 'article'
  content: string
  description: string
  relevanceScore: number
  source: string
  metadata: {
    domain: string
    publishDate?: string
    author?: string
    outlet?: string
  }
}

export class BullsDiscoveryOrchestrator {
  private wikipediaParser = new WikipediaParser()
  private simHash = new SimHash()
  private seenUrls = new Set<string>()
  private duplicateCount = 0
  private relevanceFiltered = 0

  async discover(patchName: string, description: string, tags: string[]): Promise<BullsDiscoveryResult> {
    console.log('[BullsDiscoveryOrchestrator] Starting Bulls-specific discovery')
    
    // Get Chicago Bulls profile
    const groupProfile = getGroupProfile('chicago-bulls')
    if (!groupProfile) {
      throw new Error('Chicago Bulls group profile not found')
    }

    const allSources: DiscoveredSource[] = []
    
    // STEP 1: Wikipedia-first strategy
    console.log('[BullsDiscoveryOrchestrator] Step 1: Wikipedia parsing')
    const wikipediaResult = await this.parseWikipediaContent(groupProfile)
    
    // Add Wikipedia main page as source
    if (wikipediaResult.mainPage.content) {
      const wikiSource = await this.createSourceFromWikipedia(
        wikipediaResult.mainPage,
        groupProfile,
        'wikipedia'
      )
      if (wikiSource) {
        allSources.push(wikiSource)
      }
    }
    
    // Add Wikipedia references as sources
    console.log(`[BullsDiscoveryOrchestrator] Step 2: Processing ${wikipediaResult.references.length} Wikipedia references`)
    for (const ref of wikipediaResult.references) {
      const refSource = await this.createSourceFromReference(ref, groupProfile)
      if (refSource) {
        allSources.push(refSource)
      }
    }
    
    // STEP 3: Apply hard relevance filtering
    console.log('[BullsDiscoveryOrchestrator] Step 3: Applying relevance filtering')
    const relevantSources = await this.filterRelevantSources(allSources, groupProfile)
    
    console.log('[BullsDiscoveryOrchestrator] ✅ Discovery complete:', {
      totalSources: allSources.length,
      relevant: relevantSources.length,
      filtered: this.relevanceFiltered,
      wikipediaPages: 1,
      wikipediaCitations: wikipediaResult.references.length,
      duplicates: this.duplicateCount
    })

    return {
      sources: relevantSources,
      wikipediaResult,
      stats: {
        wikipediaPages: 1,
        wikipediaCitations: wikipediaResult.references.length,
        newsArticles: 0,
        totalSources: relevantSources.length,
        duplicatesRemoved: this.duplicateCount,
        relevanceFiltered: this.relevanceFiltered
      }
    }
  }

  private async parseWikipediaContent(groupProfile: GroupProfile): Promise<WikipediaResult> {
    try {
      return await this.wikipediaParser.parseGroupPage(groupProfile)
    } catch (error) {
      console.error('[BullsDiscoveryOrchestrator] Wikipedia parsing failed:', error)
      throw new Error(`Wikipedia parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async createSourceFromWikipedia(
    page: WikipediaResult['mainPage'],
    groupProfile: GroupProfile,
    type: 'wikipedia'
  ): Promise<DiscoveredSource | null> {
    try {
      // Canonicalize URL
      const canonicalResult = await canonicalize(page.url)
      
      // Check for duplicates
      if (this.seenUrls.has(canonicalResult.canonicalUrl)) {
        this.duplicateCount++
        return null
      }
      
      this.seenUrls.add(canonicalResult.canonicalUrl)
      
      // Create source
      const source: DiscoveredSource = {
        id: `wiki-${Date.now()}`,
        title: page.title,
        url: page.url,
        canonicalUrl: canonicalResult.canonicalUrl,
        type: 'wikipedia',
        content: page.content,
        description: page.content.substring(0, 200),
        relevanceScore: 100, // Wikipedia is always highly relevant
        source: 'wikipedia',
        metadata: {
          domain: 'wikipedia.org',
          publishDate: page.lastModified,
          outlet: 'Wikipedia'
        }
      }
      
      console.log(`[BullsDiscoveryOrchestrator] ✅ Created Wikipedia source: ${page.title}`)
      return source
      
    } catch (error) {
      console.error('[BullsDiscoveryOrchestrator] Error creating Wikipedia source:', error)
      return null
    }
  }

  private async createSourceFromReference(
    ref: WikipediaResult['references'][0],
    groupProfile: GroupProfile
  ): Promise<DiscoveredSource | null> {
    try {
      // Canonicalize URL
      const canonicalResult = await canonicalize(ref.url)
      
      // Check for duplicates
      if (this.seenUrls.has(canonicalResult.canonicalUrl)) {
        this.duplicateCount++
        return null
      }
      
      this.seenUrls.add(canonicalResult.canonicalUrl)
      
      // Create source
      const source: DiscoveredSource = {
        id: `ref-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: ref.title,
        url: ref.url,
        canonicalUrl: canonicalResult.canonicalUrl,
        type: 'citation',
        content: ref.title, // Will be enriched later
        description: ref.title,
        relevanceScore: 80, // High relevance for Wikipedia citations
        source: 'wikipedia-citation',
        metadata: {
          domain: ref.domain,
          publishDate: ref.date,
          outlet: ref.outlet
        }
      }
      
      console.log(`[BullsDiscoveryOrchestrator] ✅ Created citation source: ${ref.title}`)
      return source
      
    } catch (error) {
      console.error('[BullsDiscoveryOrchestrator] Error creating citation source:', error)
      return null
    }
  }

  private async filterRelevantSources(
    sources: DiscoveredSource[],
    groupProfile: GroupProfile
  ): Promise<DiscoveredSource[]> {
    const relevantSources: DiscoveredSource[] = []
    
    for (const source of sources) {
      // Apply hard relevance gate
      const relevanceCheck = this.checkRelevance(source, groupProfile)
      
      if (relevanceCheck.isRelevant) {
        // Update relevance score based on actual check
        source.relevanceScore = Math.round(relevanceCheck.score * 100)
        relevantSources.push(source)
        console.log(`[BullsDiscoveryOrchestrator] ✅ Relevant: ${source.title} (score: ${source.relevanceScore})`)
      } else {
        this.relevanceFiltered++
        console.log(`[BullsDiscoveryOrchestrator] ❌ Filtered out: ${source.title} (${relevanceCheck.reason})`)
      }
    }
    
    return relevantSources
  }

  private checkRelevance(source: DiscoveredSource, groupProfile: GroupProfile): {
    isRelevant: boolean
    score: number
    matchedEntities: string[]
    reason?: string
  } {
    const text = `${source.title} ${source.content} ${source.description}`.toLowerCase()
    
    // Check for canonical entities (hard requirement)
    const matchedEntities: string[] = []
    for (const entity of groupProfile.canonical_entities) {
      if (text.includes(entity.toLowerCase())) {
        matchedEntities.push(entity)
      }
    }
    
    // Must match at least one canonical entity
    if (matchedEntities.length === 0) {
      return {
        isRelevant: false,
        score: 0,
        matchedEntities: [],
        reason: 'No canonical entities found'
      }
    }
    
    // Calculate relevance score
    let score = 0.5 // Base score for matching canonical entity
    
    // Bonus for key people
    for (const person of groupProfile.key_people) {
      if (text.includes(person.toLowerCase())) {
        score += 0.1
      }
    }
    
    // Bonus for synonyms
    for (const synonym of groupProfile.synonyms) {
      if (text.includes(synonym.toLowerCase())) {
        score += 0.05
      }
    }
    
    // Cap at 1.0
    score = Math.min(1.0, score)
    
    const isRelevant = score >= groupProfile.relevance_threshold
    
    return {
      isRelevant,
      score,
      matchedEntities,
      reason: isRelevant ? undefined : `Score ${score.toFixed(2)} below threshold ${groupProfile.relevance_threshold}`
    }
  }
}
