/**
 * One-at-a-Time Discovery Worker
 * Processes sources one by one with proper SSE events and hero image pipeline
 */

import { Prisma } from '@prisma/client'
import { BullsDiscoveryOrchestrator, DiscoveredSource } from './bullsDiscoveryOrchestrator'
import { getGroupProfile } from './groupProfiles'
import { canonicalize } from './canonicalization'
import { canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'
import { SimHash } from './deduplication'

export interface WorkerState {
  phase: 'idle' | 'wikipedia' | 'processing' | 'completed' | 'error'
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
}

export interface WorkerEvent {
  type: 'wikipedia:start' | 'wikipedia:refs' | 'candidate:scored' | 'discard:off_topic' | 
        'discard:duplicate' | 'saved' | 'idle' | 'error:wikipedia_empty' | 'error:fetch_timeout' |
        'hero:ai' | 'hero:wikimedia' | 'hero:placeholder'
  data: any
  timestamp: number
}

export class OneAtATimeWorker {
  private orchestrator = new BullsDiscoveryOrchestrator()
  private simHash = new SimHash()
  private seenUrls = new Set<string>()
  private duplicateCount = 0
  private savedCount = 0
  private rejectedCount = 0

  async processSources(
    sources: DiscoveredSource[],
    patchId: string,
    patchHandle: string,
    sendEvent: (event: string, data: any) => void
  ): Promise<{
    saved: number
    rejected: number
    duplicates: number
  }> {
    console.log(`[OneAtATimeWorker] Processing ${sources.length} sources one at a time`)
    
    sendEvent('wikipedia:start', { count: sources.length })
    
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      
      try {
        sendEvent('candidate:scored', { 
          title: source.title, 
          score: source.relevanceScore,
          index: i + 1,
          total: sources.length
        })
        
        // Check for duplicates
        if (this.seenUrls.has(source.canonicalUrl)) {
          this.duplicateCount++
          sendEvent('discard:duplicate', { 
            title: source.title, 
            reason: 'URL already processed' 
          })
          continue
        }
        
        this.seenUrls.add(source.canonicalUrl)
        
        // Process the source
        const result = await this.processSource(source, patchId, patchHandle, sendEvent)
        
        if (result.saved) {
          this.savedCount++
          sendEvent('saved', {
            id: result.id,
            title: source.title,
            url: source.url,
            heroUrl: result.heroUrl,
            heroSource: result.heroSource
          })
        } else {
          this.rejectedCount++
          sendEvent('discard:off_topic', { 
            title: source.title, 
            reason: result.reason 
          })
        }
        
        // Break after first successful save (one-at-a-time)
        if (result.saved) {
          break
        }
        
      } catch (error) {
        console.error(`[OneAtATimeWorker] Error processing ${source.title}:`, error)
        sendEvent('error:fetch_timeout', { 
          title: source.title, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    
    sendEvent('idle', { 
      saved: this.savedCount, 
      rejected: this.rejectedCount, 
      duplicates: this.duplicateCount 
    })
    
    return {
      saved: this.savedCount,
      rejected: this.rejectedCount,
      duplicates: this.duplicateCount
    }
  }

  private async processSource(
    source: DiscoveredSource,
    patchId: string,
    patchHandle: string,
    sendEvent: (event: string, data: any) => void
  ): Promise<{
    saved: boolean
    id?: string
    heroUrl?: string
    heroSource?: string
    reason?: string
  }> {
    try {
      // Fetch and extract content
      const content = await this.fetchAndExtractContent(source.url)
      if (!content) {
        return { saved: false, reason: 'Failed to fetch content' }
      }
      
      // Generate hero image
      const heroResult = await this.generateHeroImage(source, content, sendEvent)
      if (!heroResult.url) {
        return { saved: false, reason: 'Failed to generate hero image' }
      }
      
      // Save to database
      const savedItem = await this.saveToDatabase(source, content, heroResult, patchId, patchHandle)
      
      return {
        saved: true,
        id: savedItem.id,
        heroUrl: heroResult.url,
        heroSource: heroResult.source
      }
      
    } catch (error) {
      console.error(`[OneAtATimeWorker] Error processing source ${source.title}:`, error)
      return { 
        saved: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  private async fetchAndExtractContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (!response.ok) {
        return null
      }
      
      const html = await response.text()
      
      // Simple content extraction
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      
      const title = titleMatch ? titleMatch[1].replace(/ - .*$/, '') : 'Untitled'
      const description = descriptionMatch ? descriptionMatch[1] : ''
      
      // Extract paragraphs
      const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || []
      const content = paragraphs
        .slice(0, 5)
        .map(p => p.replace(/<[^>]+>/g, '').trim())
        .filter(p => p.length > 50)
        .join('\n\n')
      
      return content || description || title
      
    } catch (error) {
      console.error(`[OneAtATimeWorker] Error fetching content from ${url}:`, error)
      return null
    }
  }

  private async generateHeroImage(
    source: DiscoveredSource,
    content: string,
    sendEvent: (event: string, data: any) => void
  ): Promise<{ url: string; source: string } | { url: null; source: null }> {
    // Step 1: Try AI Generator
    try {
      sendEvent('hero:ai', { title: source.title })
      
      const aiResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai/generate-hero-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({
          title: source.title,
          summary: content.substring(0, 200),
          contentType: source.type,
          artisticStyle: 'photorealistic',
          enableHiresFix: true,
          useRefiner: true,
          useFaceRestoration: true,
          useRealesrgan: true
        })
      })
      
      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        if (aiData.success && aiData.imageUrl) {
          return { url: aiData.imageUrl, source: 'ai-generated' }
        }
      }
    } catch (error) {
      console.warn('[OneAtATimeWorker] AI image generation failed:', error)
    }
    
    // Step 2: Try Wikimedia Fallback
    try {
      sendEvent('hero:wikimedia', { title: source.title })
      
      const wikimediaResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/media/wikimedia-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({
          query: `${source.title} Chicago Bulls`,
          limit: 5
        })
      })
      
      if (wikimediaResponse.ok) {
        const wikimediaData = await wikimediaResponse.json()
        if (wikimediaData.images && wikimediaData.images.length > 0) {
          return { url: wikimediaData.images[0].url, source: 'wikimedia' }
        }
      }
    } catch (error) {
      console.warn('[OneAtATimeWorker] Wikimedia search failed:', error)
    }
    
    // Step 3: Branded Placeholder
    sendEvent('hero:placeholder', { title: source.title })
    
    const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(source.title)}&background=dc2626&color=ffffff&size=400&format=png`
    
    return { url: placeholderUrl, source: 'placeholder' }
  }

  private async saveToDatabase(
    source: DiscoveredSource,
    content: string,
    heroResult: { url: string; source: string },
    patchId: string,
    patchHandle: string
  ): Promise<{ id: string }> {
    const { prisma } = await import('@/lib/prisma')
    
    const canonicalUrl = source.canonicalUrl || canonicalizeUrlFast(source.url)
    // Extract domain with fallback: source.metadata.domain -> source.url -> canonicalUrl -> null
    const domain = source.metadata?.domain
      ? getDomainFromUrl(source.metadata.domain)
      : getDomainFromUrl(source.url) ?? getDomainFromUrl(canonicalUrl) ?? null
    
    try {
      const savedItem = await prisma.discoveredContent.create({
        data: {
          patchId,
          title: source.title,
          summary: content.substring(0, 240),
          whyItMatters: '',
          sourceUrl: source.url,
          canonicalUrl,
          domain,
          category: (source.type as any) || 'article',
          relevanceScore: source.relevanceScore ?? 0.5,
          qualityScore: 0,
          facts: this.extractKeyPoints(content).map((point, index) => ({
            label: `Insight ${index + 1}`,
            value: point,
            citation: source.url
          })) as Prisma.InputJsonValue,
          provenance: [source.url] as unknown as Prisma.InputJsonValue,
          hero: {
            url: heroResult.url,
            source: heroResult.source,
            license: heroResult.source === 'ai-generated' ? 'generated' : 'fair-use',
            generatedAt: new Date().toISOString(),
            origin: 'one-at-a-time'
          } as Prisma.JsonObject,
          metadata: {
            sourceDomain: source.metadata.domain,
            urlSlug: `${source.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Math.random().toString(36).substring(7)}`,
            contentUrl: `/patch/${patchHandle}/content/${source.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Math.random().toString(36).substring(7)}`,
            processedAt: new Date().toISOString()
          } as Prisma.JsonObject
        }
      })
      
      // Trigger automatic content cleanup (non-blocking)
      import('@/lib/enrichment/autoCleanup').then(({ autoCleanupContent }) => {
        autoCleanupContent(savedItem.id).catch(err => {
          console.warn(`[OneAtATimeWorker] Auto-cleanup failed for ${savedItem.id}:`, err)
        })
      }).catch(() => {
        // Ignore import errors - cleanup can happen later
      })

      // Enqueue for agent feeding (background, non-blocking)
      try {
        const { enqueueDiscoveredContent, calculateContentHash } = await import('@/lib/agent/feedWorker')
        const contentHash = savedItem.contentHash || calculateContentHash(
          savedItem.title,
          savedItem.summary,
          content
        )
        await enqueueDiscoveredContent(
          savedItem.id,
          patchId,
          contentHash,
          0 // Default priority
        ).catch(err => {
          // Non-fatal - log but don't fail
          console.warn(`[OneAtATimeWorker] Failed to enqueue content for agent feeding:`, err)
        })
      } catch (enqueueError) {
        // Non-fatal - log but don't fail
        console.warn(`[OneAtATimeWorker] Error importing enqueue function:`, enqueueError)
      }

      return { id: savedItem.id }
      
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.warn('[OneAtATimeWorker] Duplicate canonical URL skipped', {
          patchId,
          canonicalUrl
        })
        throw new Error('Duplicate discovered content')
      }
      
      // Log domain-related errors with full context
      if (error?.message?.includes('domain') || error?.code === 'P2003') {
        console.error('[OneAtATimeWorker] Failed to save discovered content (domain error):', {
          error: error.message,
          code: error.code,
          patchId,
          canonicalUrl,
          domain,
          title: source.title,
          url: source.url
        })
      } else {
        console.error('[OneAtATimeWorker] Database save error:', error)
      }
      
      throw error
    }
  }

  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    return sentences.slice(0, 5).map(s => s.trim())
  }
}
