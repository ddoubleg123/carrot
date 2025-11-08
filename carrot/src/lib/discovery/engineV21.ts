import { prisma } from '@/lib/prisma'
import { canonicalize } from './canonicalize'
import { DiscoveryEventStream } from './streaming'
import { audit } from './logger'
import { HeroImagePipeline } from './hero-pipeline'
import {
  popFromFrontier,
  addToFrontier,
  loadDiscoveryPlan,
  markAsSeen,
  isSeen,
  markContentHash,
  isNearDuplicate,
  markAngleCovered,
  getCoveredAngles,
  clearPlan,
  markContestedCovered
} from '@/lib/redis/discovery'
import type { FrontierItem } from '@/lib/redis/discovery'
import { SimHash } from './deduplication'
import { DiscoveryPlan, PlannerSeedCandidate } from './planner'
import { vetSource, VetterResult } from './vetter'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import { evaluateAcceptance, type AcceptanceCard, type AcceptanceResult } from './acceptance'

interface EngineOptions {
  patchId: string
  patchHandle: string
  patchName: string
  runId: string
}

interface ProcessedCandidateResult {
  saved: boolean
  reason?: string
  angle?: string
}

interface Metrics {
  candidatesProcessed: number
  urlsAttempted: number
  itemsSaved: number
  duplicates: number
  dropped: number
  failures: number
  timeToFirstMs?: number
  acceptance?: AcceptanceResult
}

const FETCH_TIMEOUT_MS = 7000
const MIN_CONTENT_LENGTH = 200
const DUPLICATE_HASH_THRESHOLD = 4
const MIN_RELEVANCE_SCORE = 0.75
const MIN_QUALITY_SCORE = 60
const MIN_FACT_COUNT = 3

function abortableFetch(url: string, options: RequestInit = {}, timeout = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

async function checkViewSource(url: string): Promise<boolean> {
  try {
    const response = await abortableFetch(url, { method: 'HEAD' }, 3000)
    if (response.ok) return true
    if (response.status >= 400 && response.status < 500) return false
    const getResponse = await abortableFetch(url, { method: 'GET' }, 3000)
    return getResponse.ok
  } catch (error) {
    console.warn('[EngineV21] View source check failed:', error)
    return false
  }
}

export class DiscoveryEngineV21 {
  private eventStream: DiscoveryEventStream
  private heroPipeline: HeroImagePipeline
  private stopRequested = false
  private metrics: Metrics = {
    candidatesProcessed: 0,
    urlsAttempted: 0,
    itemsSaved: 0,
    duplicates: 0,
    dropped: 0,
    failures: 0
  }
  private firstItemTimestamp?: number
  private plan: DiscoveryPlan | null = null
  private acceptanceCards: AcceptanceCard[] = []

  constructor(private options: EngineOptions, eventStream?: DiscoveryEventStream) {
    this.eventStream = eventStream ?? new DiscoveryEventStream()
    this.heroPipeline = new HeroImagePipeline(process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com')
  }

  requestStop(): void {
    if (this.stopRequested) return
    this.stopRequested = true
    this.eventStream.stop()
  }

  async start(): Promise<void> {
    const { patchId, patchName, runId } = this.options

    this.eventStream.start(patchId, runId)

    try {
      this.plan = await loadDiscoveryPlan<DiscoveryPlan>(runId)
      const coveredAngles = await getCoveredAngles(runId)
      await this.discoveryLoop(coveredAngles)

      if (this.stopRequested) {
        await this.emitRunComplete('aborted')
      } else {
        await this.emitRunComplete('completed')
      }
    } catch (error) {
      console.error('[EngineV21] Fatal error in discovery engine:', error)
      await this.emitRunComplete('error', error)
      this.eventStream.error('Discovery engine failed', error)
      throw error
    } finally {
      await clearPlan(runId).catch(console.error)
    }
  }

  private async discoveryLoop(coveredAngles: Set<string>): Promise<void> {
    const { patchId, patchName, runId } = this.options
    const startTime = Date.now()

    while (!this.stopRequested) {
      const candidate = await popFromFrontier(patchId)

      if (!candidate) {
        const expanded = await this.expandFrontierIfNeeded(patchId, coveredAngles)
        if (!expanded) {
          this.eventStream.idle('Frontier empty')
          break
        }
        continue
      }

      this.metrics.candidatesProcessed++
      const processResult = await this.processCandidate(candidate)
      if (processResult.angle) {
        coveredAngles.add(processResult.angle)
        await markAngleCovered(runId, processResult.angle)
      }

      if (processResult.saved) {
        if (!this.metrics.timeToFirstMs) {
          this.metrics.timeToFirstMs = Date.now() - startTime
        }
        this.metrics.itemsSaved++
      }

      if (this.stopRequested) {
        break
      }
    }
  }

  private async processCandidate(candidate: FrontierItem): Promise<ProcessedCandidateResult> {
    const { patchId } = this.options
    const url = candidate.cursor
    const angle = candidate.meta?.angle as string | undefined

    try {
      this.eventStream.searching(candidate.provider)
      await this.emitAudit('frontier_pop', 'pending', {
        provider: candidate.provider,
        candidateUrl: url,
        angle,
        meta: candidate.meta
      })

      const canonical = await canonicalize(url)
      const canonicalUrl = canonical.canonicalUrl
      const finalDomain = canonical.finalDomain
      await this.emitAudit('canonicalize', 'ok', {
        candidateUrl: url,
        finalUrl: canonicalUrl,
        meta: { domain: finalDomain }
      })

      if (await isSeen(patchId, canonicalUrl)) {
        this.metrics.duplicates++
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'redis_seen' }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'redis_seen' })
        return { saved: false, reason: 'redis_seen', angle }
      }

      const existing = await prisma.discoveredContent.findFirst({
        where: { patchId, canonicalUrl },
        select: { id: true }
      })
      if (existing) {
        this.metrics.duplicates++
        await markAsSeen(patchId, canonicalUrl).catch(() => undefined)
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'db_duplicate', existingId: existing.id }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'db_duplicate' })
        return { saved: false, reason: 'db_duplicate', angle }
      }

      this.metrics.urlsAttempted++
      this.eventStream.searching('fetch')
      const extracted = await this.fetchAndExtractContent(canonicalUrl)
      if (!extracted || extracted.text.length < MIN_CONTENT_LENGTH) {
        this.metrics.dropped++
        await this.emitAudit('fetch', 'fail', {
          candidateUrl: canonicalUrl,
          error: { message: 'content_too_short' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'content_too_short' })
        return { saved: false, reason: 'content_short', angle }
      }

      const simhash = SimHash.generate(extracted.text)
      const hashString = simhash.toString()
      if (await isNearDuplicate(patchId, hashString, DUPLICATE_HASH_THRESHOLD)) {
        this.metrics.duplicates++
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'near_duplicate' }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'near_duplicate' })
        return { saved: false, reason: 'near_duplicate', angle }
      }

      this.eventStream.searching('vet')
      const synthesis = await this.vetCandidate({
        title: extracted.title,
        url: canonicalUrl,
        text: extracted.text,
        angle
      })
      if (!synthesis || !synthesis.isUseful) {
        this.metrics.dropped++
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: synthesis,
          decisions: { action: 'drop', reason: 'vetter_rejected' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'vetter_rejected' })
        return { saved: false, reason: 'vetter_rejected', angle }
      }

      if (synthesis.relevanceScore < MIN_RELEVANCE_SCORE || synthesis.qualityScore < MIN_QUALITY_SCORE) {
        this.metrics.dropped++
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: synthesis,
          decisions: { action: 'drop', reason: 'score_threshold' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'score_threshold' })
        return { saved: false, reason: 'score_threshold', angle }
      }

      this.eventStream.searching('hero')
      const hero = await this.heroPipeline.assignHero({
        title: extracted.title,
        content: { summary150: synthesis.whyItMatters },
        metadata: {
          topic: this.options.patchName,
          source: canonicalUrl
        },
        entity: this.plan?.topic
      })

      const contestedClaim = this.resolveContestedClaim(synthesis.contested)
      if (contestedClaim) {
        await markContestedCovered(this.options.runId, contestedClaim).catch(() => undefined)
      }

      await markAsSeen(patchId, canonicalUrl).catch(() => undefined)
      await markContentHash(patchId, hashString).catch(() => undefined)

      const viewSourceOk = await checkViewSource(canonicalUrl)

      const metadataPayload = {
        angle,
        credibilityTier: candidate.meta?.credibilityTier,
        viewSourceStatus: viewSourceOk ? 200 : 404,
        contested: synthesis.contested || null,
        contestedClaim: contestedClaim || null
      }

      const savedItem = await prisma.discoveredContent.create({
        data: {
          patchId,
          type: candidate.meta?.sourceType || 'article',
          title: extracted.title,
          content: extracted.text.substring(0, 5000),
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore,
          sourceUrl: canonicalUrl,
          canonicalUrl,
          contentHash: hashString,
          whyItMatters: synthesis.whyItMatters,
          facts: synthesis.facts,
          quotes: synthesis.quotes,
          provenance: synthesis.provenance,
          hero: hero ? { url: hero.url, source: hero.source } : null,
          status: viewSourceOk ? 'ready' : 'requires_review',
          metadata: metadataPayload
        }
      })

      const factsPayload = synthesis.facts.map((fact) => ({
        label: fact.label,
        value: fact.value,
        citation: fact.citation
      }))

      const cardPayload: DiscoveryCardPayload = {
        id: savedItem.id,
        title: savedItem.title,
        url: canonicalUrl,
        canonicalUrl,
        domain: finalDomain,
        sourceType: candidate.meta?.sourceType,
        credibilityTier: candidate.meta?.credibilityTier,
        angle,
        noveltySignals: candidate.meta?.noveltySignals,
        expectedInsights: candidate.meta?.expectedInsights,
        reason: candidate.meta?.reason,
        whyItMatters: synthesis.whyItMatters,
        facts: factsPayload,
        quotes: synthesis.quotes,
        provenance: synthesis.provenance,
        contested: synthesis.contested,
        contestedClaim: contestedClaim || undefined,
        hero: hero ? { url: hero.url, source: hero.source } : null,
        relevanceScore: synthesis.relevanceScore,
        qualityScore: synthesis.qualityScore,
        viewSourceOk,
        savedAt: savedItem.createdAt.toISOString()
      }

      this.acceptanceCards.push({
        id: savedItem.id,
        canonicalUrl,
        angle,
        viewSourceOk,
        contested: Boolean(synthesis.contested)
      })

      await this.emitAudit('save', 'ok', {
        candidateUrl: canonicalUrl,
        meta: {
          id: savedItem.id,
          whyItMatters: synthesis.whyItMatters,
          angle,
          heroSource: hero?.source,
          contested: synthesis.contested,
          contestedClaim
        }
      })

      this.eventStream.saved(cardPayload)
      if (angle) {
        await markAngleCovered(this.options.runId, angle).catch(() => undefined)
      }
      return { saved: true, angle }
    } catch (error) {
      this.metrics.failures++
      await this.emitAudit('processing_error', 'fail', {
        candidateUrl: candidate.cursor,
        error: this.formatError(error)
      })
      console.error('[EngineV21] Candidate processing failed:', error)
      this.eventStream.error('Candidate processing failed', error)
      return { saved: false, reason: 'error', angle }
    }
  }

  private async fetchAndExtractContent(url: string): Promise<{ title: string; text: string }> {
    try {
      const response = await abortableFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/2.1)'
        }
      })

      if (!response.ok) {
        throw new Error(`fetch_failed_${response.status}`)
      }

      const html = await response.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
      const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i)
      const bodyMatch = mainMatch || html.match(/<body[\s\S]*?<\/body>/i)
      const raw = bodyMatch ? bodyMatch[0] : html
      const text = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
      const clean = text.replace(/\s+/g, ' ').trim()
      return { title, text: clean }
    } catch (error) {
      console.error('[EngineV21] Failed to fetch content:', error)
      throw error
    }
  }

  private async expandFrontierIfNeeded(patchId: string, coveredAngles: Set<string>): Promise<boolean> {
    if (!this.plan) {
      return false
    }

    const uncoveredAngles = this.plan.queryAngles.filter(angle => !coveredAngles.has(angle.angle))
    const uncoveredSeeds = this.plan.seedCandidates.filter(seed => uncoveredAngles.some(a => a.angle === seed.angle))

    if (!uncoveredSeeds.length) {
      return false
    }

    const inserts = uncoveredSeeds.slice(0, 3).map((seed, index) => {
      const priority = 80 - index * 2
      return addToFrontier(patchId, {
        id: `reseed:${Date.now()}:${seed.url}`,
        provider: 'planner:reseed',
        cursor: seed.url,
        priority,
        angle: seed.angle,
        meta: seed as PlannerSeedCandidate
      })
    })

    await Promise.all(inserts)
    return true
  }

  private async vetCandidate(params: { title: string; url: string; text: string; angle?: string }): Promise<VetterResult> {
    const aliases = this.plan?.mustTerms?.filter(term => term && term !== this.plan?.topic) || []
    const contestedClaims = this.plan?.contestedPlan?.claims?.map(claim => claim.claim)
    const result = await vetSource({
      topic: this.plan?.topic || this.options.patchName,
      aliases,
      url: params.url,
      text: params.text,
      contestedClaims
    })

    const normalisedRelevance = (() => {
      let value = Number(result.relevanceScore ?? 0)
      if (Number.isNaN(value)) return 0
      if (value > 1) {
        if (value > 100) value = value / 100
        else if (value > 10) value = value / 100
        else value = value / 10
      }
      if (value < 0) value = 0
      if (value > 1) value = 1
      return value
    })()

    const qualityScore = Number(result.qualityScore ?? 0)

    const provenance = Array.isArray(result.provenance) ? [...result.provenance] : [params.url]
    if (!provenance.length || provenance[0] !== params.url) {
      provenance.unshift(params.url)
    }

    if (!result.facts || result.facts.length < MIN_FACT_COUNT) {
      throw new Error('vetter_insufficient_facts')
    }

    const quotes = Array.isArray(result.quotes) ? result.quotes.slice(0, 3) : []

    return {
      ...result,
      relevanceScore: normalisedRelevance,
      qualityScore,
      provenance,
      contested: result.contested && result.contested.note ? result.contested : null,
      quotes
    }
  }

  private resolveContestedClaim(contested: VetterResult['contested']): string | undefined {
    if (!contested || !contested.note) return undefined
    if (contested.claim) return contested.claim
    const claims = this.plan?.contestedPlan?.claims || []
    const lowerNote = contested.note.toLowerCase()
    for (const planClaim of claims) {
      if (lowerNote.includes(planClaim.claim.toLowerCase())) {
        return planClaim.claim
      }
    }
    return undefined
  }

  private async emitAudit(step: string, status: 'pending' | 'ok' | 'fail', payload: Record<string, any>) {
    await audit.emit({
      runId: this.options.runId,
      patchId: this.options.patchId,
      step,
      status,
      ...payload
    })
  }

  private async emitRunComplete(status: 'completed' | 'error' | 'aborted', error?: unknown) {
    const acceptance = status === 'completed' && this.plan
      ? evaluateAcceptance({
          timeToFirstMs: this.metrics.timeToFirstMs,
          savedCards: this.acceptanceCards,
          plannerAngles: Array.from(new Set((this.plan?.queryAngles || []).map((angle) => angle.angle).filter(Boolean))),
          contestedClaims: Array.from(new Set(this.plan?.contestedPlan?.claims?.map((claim) => claim.claim).filter(Boolean) || []))
        })
      : null

    if (acceptance) {
      this.metrics.acceptance = acceptance
    }

    const auditMeta = acceptance ? { ...this.metrics } : this.metrics

    await this.emitAudit('run_complete', status === 'completed' ? 'ok' : status === 'aborted' ? 'ok' : 'fail', {
      meta: auditMeta,
      error: error ? this.formatError(error) : undefined
    })

    await prisma.discoveryRun.update({
      where: { id: this.options.runId },
      data: {
        status,
        endedAt: new Date(),
        metrics: {
          ...auditMeta,
          status,
          error: error ? this.formatError(error) : undefined
        }
      }
    }).catch((updateError) => {
      console.error('[EngineV21] Failed to save run metrics', updateError)
    })
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }
    return { message: String(error) }
  }
}
