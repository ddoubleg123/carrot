import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { canonicalize } from './canonicalize'
import { DiscoveryEventStream } from './streaming'
import { audit, logger, MetricsTracker } from './logger'
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
  markContestedCovered,
  incrementSaveCounters,
  getSaveCounters,
  clearSaveCounters,
  frontierSize,
  storeRunMetricsSnapshot,
  enqueueHeroRetry,
  type SaveCounters,
  type RunMetricsSnapshot
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

const FETCH_TIMEOUT_MS = 8000
const MIN_CONTENT_LENGTH = 200
const DUPLICATE_HASH_THRESHOLD = 4
const MIN_RELEVANCE_SCORE = 0.75
const MIN_QUALITY_SCORE = 60
const MIN_FACT_COUNT = 2

interface TelemetryCounters {
  seedsEnqueued: number
  directFetchOk: number
  htmlExtracted: number
  vetterJsonOk: number
  accepted: number
  rejectedThreshold: number
  rejectedParse: number
  paywall: number
  robotsBlock: number
  timeout: number
  softAccepted: number
}

interface ExtractedContent {
  title: string
  text: string
  lang?: string
  headings?: string[]
}

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
  private telemetry: TelemetryCounters = {
    seedsEnqueued: 0,
    directFetchOk: 0,
    htmlExtracted: 0,
    vetterJsonOk: 0,
    accepted: 0,
    rejectedThreshold: 0,
    rejectedParse: 0,
    paywall: 0,
    robotsBlock: 0,
    timeout: 0,
    softAccepted: 0
  }
  private firstItemTimestamp?: number
  private plan: DiscoveryPlan | null = null
  private acceptanceCards: AcceptanceCard[] = []
  private metricsTracker: MetricsTracker
  private lastCounters: SaveCounters = { total: 0, controversy: 0, history: 0 }
  private priorityBurstProcessed = false
  private metricsMutationQueue: Promise<void> = Promise.resolve()

  constructor(private options: EngineOptions, eventStream?: DiscoveryEventStream) {
    this.eventStream = eventStream ?? new DiscoveryEventStream()
    this.heroPipeline = new HeroImagePipeline(process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com')
    this.metricsTracker = new MetricsTracker(`${options.patchHandle}:${options.runId}`)
  }

  private mutateMetrics(mutator: () => void): Promise<void> {
    this.metricsMutationQueue = this.metricsMutationQueue
      .then(() => {
        mutator()
      })
      .catch((error) => {
        console.error('[EngineV21] Metrics mutation failed', error)
      })
    return this.metricsMutationQueue
  }

  private incrementMetric(key: keyof Metrics, delta: number = 1): Promise<void> {
    const numericKeys: Array<keyof Metrics> = [
      'candidatesProcessed',
      'urlsAttempted',
      'itemsSaved',
      'duplicates',
      'dropped',
      'failures'
    ]
    if (!numericKeys.includes(key)) {
      return Promise.resolve()
    }
    return this.mutateMetrics(() => {
      const current = (this.metrics[key] as number | undefined) ?? 0
      this.metrics[key] = (current + delta) as Metrics[keyof Metrics]
    })
  }

  private setMetric<K extends keyof Metrics>(key: K, value: Metrics[K]): Promise<void> {
    return this.mutateMetrics(() => {
      this.metrics[key] = value
    })
  }

  requestStop(): void {
    if (this.stopRequested) return
    this.stopRequested = true
    this.eventStream.stop()
  }

  async start(): Promise<void> {
    const { patchId, patchName, runId } = this.options

    this.eventStream.start(patchId, runId)
    this.structuredLog('run_start', {
      patchId,
      runId,
      patchName
    })

    try {
      this.priorityBurstProcessed = false
      this.plan = await loadDiscoveryPlan<DiscoveryPlan>(runId)
      if (!this.plan) {
        throw new Error(`discovery_plan_missing:${runId}`)
      }
      const seedsCount = Math.min(Array.isArray(this.plan.seedCandidates) ? this.plan.seedCandidates.length : 0, 10)
      this.telemetry = {
        seedsEnqueued: seedsCount,
        directFetchOk: 0,
        htmlExtracted: 0,
        vetterJsonOk: 0,
        accepted: 0,
        rejectedThreshold: 0,
        rejectedParse: 0,
        paywall: 0,
        robotsBlock: 0,
        timeout: 0,
        softAccepted: 0
      }
      await clearSaveCounters(patchId).catch(() => undefined)
      this.lastCounters = { total: 0, controversy: 0, history: 0 }
      const coveredAngles = await getCoveredAngles(runId)
      await this.persistMetricsSnapshot('running', this.lastCounters, { event: 'start' })
      await this.discoveryLoop(coveredAngles)

      if (this.stopRequested) {
        await this.emitRunComplete('suspended')
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
    const { patchId } = this.options
    const startTime = Date.now()

    if (!this.priorityBurstProcessed) {
      const handled = await this.processPriorityBurst(coveredAngles, startTime)
      this.priorityBurstProcessed = true
      if (handled && this.stopRequested) {
        return
      }
    }

    while (!this.stopRequested) {
      const candidate = await popFromFrontier(patchId)

      if (!candidate) {
        const expanded = await this.expandFrontierIfNeeded(patchId, coveredAngles)
        if (!expanded) {
          await this.persistMetricsSnapshot('running', this.lastCounters, { reason: 'frontier_empty' })
          this.eventStream.idle('Frontier empty')
          break
        }
        continue
      }

      await this.processCandidateWithBookkeeping(candidate, coveredAngles, startTime)

      if (this.stopRequested) {
        break
      }
    }
  }

  private async processPriorityBurst(coveredAngles: Set<string>, startTime: number): Promise<boolean> {
    const { patchId } = this.options
    const burst: FrontierItem[] = []
    const toRequeue: FrontierItem[] = []

    while (burst.length < 3) {
      const candidate = await popFromFrontier(patchId)
      if (!candidate) break
      if (candidate.meta?.planPriority === 1 && candidate.provider === 'direct') {
        burst.push(candidate)
      } else {
        toRequeue.push(candidate)
        if (candidate.meta?.planPriority !== 1) {
          break
        }
      }
    }

    if (toRequeue.length) {
      await Promise.all(toRequeue.map((item) => addToFrontier(patchId, item)))
    }

    if (!burst.length) {
      return false
    }

    await Promise.all(
      burst.map(async (candidate) => {
        if (this.stopRequested) return
        await this.processCandidateWithBookkeeping(candidate, coveredAngles, startTime)
      })
    )

    return true
  }

  private async processCandidateWithBookkeeping(
    candidate: FrontierItem,
    coveredAngles: Set<string>,
    startTime: number
  ): Promise<void> {
    const { patchId } = this.options
    await this.incrementMetric('candidatesProcessed')
    const depth = await frontierSize(patchId).catch(() => 0)
    this.metricsTracker.updateFrontierDepth(typeof depth === 'number' ? depth : 0)
    const countersBefore = await getSaveCounters(patchId)
    const result = await this.processCandidate(candidate, countersBefore)
    await this.applyProcessOutcome(result, candidate, coveredAngles, startTime)
  }

  private async applyProcessOutcome(
    result: ProcessedCandidateResult,
    candidate: FrontierItem,
    coveredAngles: Set<string>,
    startTime: number
  ): Promise<void> {
    const { runId } = this.options
    if (result.angle) {
      coveredAngles.add(result.angle)
      await markAngleCovered(runId, result.angle).catch(() => undefined)
    }

    if (result.saved) {
      if (!this.metrics.timeToFirstMs) {
        await this.setMetric('timeToFirstMs', Date.now() - startTime)
      }
      await this.incrementMetric('itemsSaved')
      this.telemetry.accepted++
    } else if (result.reason) {
      if (
        result.reason === 'score_threshold' ||
        result.reason === 'vetter_rejected' ||
        result.reason === 'entity_missing'
      ) {
        this.telemetry.rejectedThreshold++
      } else if (result.reason === 'vetter_parse' || result.reason === 'vetter_insufficient_facts') {
        this.telemetry.rejectedParse++
      }
    }
  }

  private async processCandidate(candidate: FrontierItem, countersBefore: SaveCounters): Promise<ProcessedCandidateResult> {
    const { patchId } = this.options
    const url = candidate.cursor
    const angle = candidate.meta?.angle as string | undefined

    try {
      const startedAt = Date.now()
      this.lastCounters = countersBefore
      this.eventStream.stage('searching', { provider: candidate.provider })
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
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        logger.logDuplicate(canonicalUrl, 'A', candidate.provider)
        this.structuredLog('duplicate_seen', {
          url: canonicalUrl,
          provider: candidate.provider
        })
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'redis_seen' }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'redis_seen' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'redis_seen', angle }
      }

      const existing = await prisma.discoveredContent.findFirst({
        where: { patchId, canonicalUrl },
        select: { id: true }
      })
      if (existing) {
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        logger.logDuplicate(canonicalUrl, 'A', candidate.provider)
        this.structuredLog('duplicate_database', {
          url: canonicalUrl,
          provider: candidate.provider,
          existingId: existing.id
        })
        await markAsSeen(patchId, canonicalUrl).catch(() => undefined)
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'db_duplicate', existingId: existing.id }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'db_duplicate' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'db_duplicate', angle }
      }

      await this.incrementMetric('urlsAttempted')
      this.eventStream.stage('searching', { provider: 'fetcher' })
      this.eventStream.searching('fetch')
      const extracted = await this.fetchAndExtractContent(canonicalUrl)
      if (!extracted || extracted.text.length < MIN_CONTENT_LENGTH) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'content_too_short')
        this.structuredLog('content_short', {
          url: canonicalUrl,
          provider: candidate.provider,
          length: extracted?.text.length ?? 0
        })
        await this.emitAudit('fetch', 'fail', {
          candidateUrl: canonicalUrl,
          error: { message: 'content_too_short' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'content_too_short' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'content_short', angle }
      }

      if (!this.hasEntityMention(extracted)) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'entity_missing')
        this.structuredLog('entity_missing', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle
        })
        await this.emitAudit('fetch', 'fail', {
          candidateUrl: canonicalUrl,
          error: { message: 'entity_missing' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'entity_missing' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'entity_missing', angle }
      }

      const simhash = SimHash.generate(extracted.text)
      const hashString = simhash.toString()
      if (await isNearDuplicate(patchId, hashString, DUPLICATE_HASH_THRESHOLD)) {
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        logger.logDuplicate(canonicalUrl, 'B', candidate.provider)
        this.structuredLog('duplicate_simhash', {
          url: canonicalUrl,
          provider: candidate.provider,
          contentHash: hashString
        })
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'near_duplicate' }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'near_duplicate' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'near_duplicate', angle }
      }

      this.eventStream.stage('vetting', { url: canonicalUrl })
      this.eventStream.searching('vet')
      let synthesis: VetterResult | null = null
      try {
        synthesis = await this.vetCandidate({
          title: extracted.title,
          url: canonicalUrl,
          text: extracted.text,
          angle
        })
      } catch (error) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        const errMessage = error instanceof Error ? error.message : String(error)
        const parseReason =
          errMessage === 'vetter_insufficient_facts' ? 'vetter_insufficient_facts' : 'vetter_parse'
        logger.logSkip(canonicalUrl, parseReason)
        this.structuredLog(parseReason, {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          error: errMessage
        })
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          error: this.formatError(error),
          decisions: { action: 'drop', reason: parseReason }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: parseReason })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: parseReason, angle }
      }

      if (!synthesis || !synthesis.isUseful) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'vetter_rejected')
        this.structuredLog('vetter_rejected', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          meta: synthesis ?? null
        })
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: synthesis,
          decisions: { action: 'drop', reason: 'vetter_rejected' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'vetter_rejected' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'vetter_rejected', angle }
      }

      this.telemetry.vetterJsonOk++

      const factsWithCitations = Array.isArray(synthesis.facts)
        ? synthesis.facts.filter((fact) => fact && typeof fact.citation === 'string' && fact.citation.length > 0).length
        : 0

      const isFirstCard = countersBefore.total === 0
      const softEligible = isFirstCard && synthesis.qualityScore >= 70 && factsWithCitations >= 2
      const minRelevance = softEligible ? 0.7 : MIN_RELEVANCE_SCORE
      const minQuality = softEligible ? 70 : MIN_QUALITY_SCORE

      if (synthesis.relevanceScore < minRelevance || synthesis.qualityScore < minQuality) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'score_threshold')
        this.structuredLog('score_threshold', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore
        })
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: synthesis,
          decisions: { action: 'drop', reason: 'score_threshold' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'score_threshold' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'score_threshold', angle }
      }

      if (softEligible && synthesis.relevanceScore < MIN_RELEVANCE_SCORE) {
        this.telemetry.softAccepted++
        this.structuredLog('soft_accepted', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore
        })
      }

      this.eventStream.stage('hero', { url: canonicalUrl })
      this.eventStream.searching('hero')
      const hero = await this.heroPipeline.assignHero({
        title: extracted.title,
        summary: synthesis.whyItMatters,
        topic: this.options.patchName,
        entity: this.plan?.topic
      })

      if (hero?.source === 'skeleton') {
        await enqueueHeroRetry({
          patchId,
          runId: this.options.runId,
          url: canonicalUrl,
          title: extracted.title
        }).catch(() => undefined)
        this.structuredLog('hero_retry_queued', {
          url: canonicalUrl,
          provider: candidate.provider
        })
      }

      const contestedClaim = this.resolveContestedClaim(synthesis.contested)
      if (contestedClaim) {
        await markContestedCovered(this.options.runId, contestedClaim).catch(() => undefined)
      }

      await markAsSeen(patchId, canonicalUrl).catch(() => undefined)
      await markContentHash(patchId, hashString).catch(() => undefined)

      const viewSourceOk = await checkViewSource(canonicalUrl)

      const isControversy = candidate.meta?.isControversy === true
      const isHistory = candidate.meta?.isHistory === true

      const savedItem = await prisma.discoveredContent.create({
        data: {
          patchId,
          canonicalUrl,
          sourceUrl: canonicalUrl,
          domain: finalDomain,
          publishDate: candidate.meta?.publishDate ?? null,
          category: (candidate.meta?.category as string | undefined) || null,
          isControversy,
          isHistory,
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore,
          whyItMatters: synthesis.whyItMatters,
          summary: synthesis.whyItMatters,
          facts: synthesis.facts as unknown as Prisma.JsonArray,
          quotes: synthesis.quotes as unknown as Prisma.JsonArray,
          provenance: synthesis.provenance as unknown as Prisma.JsonArray,
          hero: hero ? ({ url: hero.url, source: hero.source } as Prisma.JsonObject) : Prisma.JsonNull,
          contentHash: hashString
        } as any
      })

      await incrementSaveCounters(patchId, {
        total: 1,
        controversy: isControversy ? 1 : 0,
        history: isHistory ? 1 : 0
      })

      const factsPayload = synthesis.facts.map((fact) => ({
        label: fact.label,
        value: fact.value,
        citation: fact.citation
      }))

      const cardPayload: DiscoveryCardPayload = {
        id: savedItem.id,
        title: extracted.title,
        url: canonicalUrl,
        canonicalUrl,
        domain: finalDomain,
        category: candidate.meta?.category,
        credibilityTier: candidate.meta?.credibilityTier,
        angle,
        noveltySignals: candidate.meta?.noveltySignals,
        expectedInsights: candidate.meta?.expectedInsights,
        reason: candidate.meta?.notes,
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
        isControversy,
        isHistory,
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

      const countersAfter = await getSaveCounters(patchId)
      this.lastCounters = countersAfter
      const processingTime = Date.now() - startedAt
      this.metricsTracker.recordNovel(processingTime)
      logger.logSuccess(canonicalUrl, processingTime)
      this.structuredLog('saved', {
        url: canonicalUrl,
        provider: candidate.provider,
        angle,
        isControversy,
        isHistory,
        processingTime,
        relevanceScore: synthesis.relevanceScore,
        qualityScore: synthesis.qualityScore
      })
      const controversyRatio = countersAfter.total ? countersAfter.controversy / countersAfter.total : 0

      if (isControversy && controversyRatio < 0.5) {
        await this.emitAudit('coverage', 'ok', {
          candidateUrl: canonicalUrl,
          meta: {
            category: candidate.meta?.category,
            controversyRatio
          }
        })
      }

      this.eventStream.saved(cardPayload)
      this.eventStream.stage('saved', { id: savedItem.id })
      await this.persistMetricsSnapshot('running', countersAfter, {
        lastSavedId: savedItem.id,
        lastSavedUrl: canonicalUrl
      })
      if (angle) {
        await markAngleCovered(this.options.runId, angle).catch(() => undefined)
      }
      return { saved: true, angle }
    } catch (error) {
      await this.incrementMetric('failures')
      this.metricsTracker.recordError()
      logger.logError('candidate_processing_failed', {
        url: candidate.cursor,
        provider: candidate.provider,
        error: error instanceof Error ? error.message : String(error)
      })
      this.structuredLog('processing_error', {
        url: candidate.cursor,
        provider: candidate.provider,
        reason: error instanceof Error ? error.message : String(error)
      })
      await this.emitAudit('processing_error', 'fail', {
        candidateUrl: candidate.cursor,
        error: this.formatError(error)
      })
      console.error('[EngineV21] Candidate processing failed:', error)
      this.eventStream.error('Candidate processing failed', error)
      await this.persistMetricsSnapshot('running', this.lastCounters, {
        lastError: this.formatError(error)
      })
      return { saved: false, reason: 'error', angle }
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = 0,
    timeoutMs: number = FETCH_TIMEOUT_MS
  ): Promise<Response> {
    let attempt = 0
    let currentTimeout = timeoutMs
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await abortableFetch(url, options, currentTimeout)
      } catch (error) {
        if (attempt >= retries) {
          throw error
        }
        const backoff = Math.pow(2, attempt) * 250
        await new Promise((resolve) => setTimeout(resolve, backoff))
        attempt += 1
        currentTimeout = Math.min(currentTimeout * 1.5, 15000)
      }
    }
  }

  private async fetchAndExtractContent(url: string): Promise<ExtractedContent> {
    try {
      const response = await this.fetchWithRetry(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/2.1)'
          }
        },
        1,
        FETCH_TIMEOUT_MS
      )

      if (!response.ok) {
        if (response.status === 401 || response.status === 402) {
          this.telemetry.paywall++
        } else if (response.status === 403) {
          const robots = response.headers.get('x-robots-tag')
          if (robots && robots.length) {
            this.telemetry.robotsBlock++
          } else {
            this.telemetry.paywall++
          }
        }
        throw new Error(`fetch_failed_${response.status}`)
      }

      this.telemetry.directFetchOk++
      const html = await response.text()
      const extracted = this.extractHtmlContent(html)
      this.telemetry.htmlExtracted++
      return extracted
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        this.telemetry.timeout++
      }
      console.error('[EngineV21] Failed to fetch content:', error)
      throw error
    }
  }

  private extractHtmlContent(html: string): ExtractedContent {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i)
    const lang = langMatch ? langMatch[1].toLowerCase() : undefined

    const headingRegex = /<(h1|h2)[^>]*>(.*?)<\/\1>/gi
    const headings: string[] = []
    let headingMatch: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((headingMatch = headingRegex.exec(html))) {
      const headingText = headingMatch[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (headingText) {
        headings.push(headingText)
      }
    }

    const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i)
    const bodyMatch = mainMatch || html.match(/<body[\s\S]*?<\/body>/i)
    const raw = bodyMatch ? bodyMatch[0] : html
    const withoutScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    const textBody = withoutScripts
      .replace(/<\/(p|div|section|br|li)>/gi, '$&\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const headingTrail = headings.slice(0, 4).join(' > ')
    const text = headingTrail ? `${headingTrail}\n\n${textBody}` : textBody

    return {
      title,
      text,
      lang,
      headings
    }
  }

  private hasEntityMention(content: ExtractedContent): boolean {
    const terms = new Set<string>()
    if (this.plan?.topic) {
      terms.add(this.plan.topic.toLowerCase())
    }
    if (Array.isArray(this.plan?.aliases)) {
      this.plan?.aliases
        .map((alias) => alias?.toLowerCase?.())
        .filter((alias): alias is string => Boolean(alias && alias.length))
        .forEach((alias) => terms.add(alias))
    }
    if (terms.size === 0) {
      return true
    }

    const title = content.title?.toLowerCase?.() ?? ''
    const words = content.text?.split(/\s+/).slice(0, 200).join(' ').toLowerCase()
    const body = content.text?.toLowerCase?.() ?? ''

    for (const term of terms) {
      if (!term) continue
      if (title.includes(term)) return true
      if (words.includes(term)) return true
    }

    for (const term of terms) {
      if (!term) continue
      if (body.includes(term)) return true
    }

    return false
  }

  private async expandFrontierIfNeeded(patchId: string, coveredAngles: Set<string>): Promise<boolean> {
    if (!this.plan) {
      return false
    }

    const uncoveredAngles = this.plan.queryAngles.filter(angle => !coveredAngles.has(angle.angle))
    const coverageTargets = this.plan.coverageTargets || { controversyRatio: 0.5, controversyWindow: 4, historyInFirst: 3 }
    const historyTarget = coverageTargets.historyInFirst ?? 3
    const counters = await getSaveCounters(patchId)
    const controversyRatio = counters.total ? counters.controversy / counters.total : 0
    const needControversy = controversyRatio < coverageTargets.controversyRatio
    const overControversy = controversyRatio > (coverageTargets.controversyRatio + 0.1)
    const needHistory = counters.total < 12 && counters.history < historyTarget

    const candidateSeeds = this.plan.seedCandidates.map((seed, index) => {
      let score = 100 - index * 2
      if (needControversy && seed.isControversy) score += 40
      if (overControversy && seed.isControversy) score -= 20
      if (needHistory && seed.isHistory) score += 25
      if (!seed.isControversy && needControversy) score -= 5
      return { seed, score }
    })

    const availableSeeds = uncoveredAngles.length
      ? candidateSeeds.filter(({ seed }) => uncoveredAngles.some((angle) => angle.angle === seed.angle))
      : candidateSeeds

    if (!availableSeeds.length) {
      return false
    }

    availableSeeds.sort((a, b) => b.score - a.score)

    const inserts = availableSeeds.slice(0, 3).map(({ seed, score }) => {
      return addToFrontier(patchId, {
        id: `reseed:${Date.now()}:${seed.url}`,
        provider: 'planner:reseed',
        cursor: seed.url,
        priority: score,
        angle: seed.angle,
        meta: seed as PlannerSeedCandidate
      })
    })

    await Promise.all(inserts)
    return true
  }

  private async vetCandidate(params: { title: string; url: string; text: string; angle?: string }): Promise<VetterResult> {
    const aliases = this.plan?.mustTerms?.filter(term => term && term !== this.plan?.topic) || []
    const contestedClaims = this.plan?.controversyAngles
      ? this.plan.controversyAngles
          .map((angle) => angle.angle)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
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

  private structuredLog(event: string, data: Record<string, unknown>): void {
    try {
      const payload = {
        source: 'discovery_engine_v21',
        runId: this.options.runId,
        patchId: this.options.patchId,
        event,
        timestamp: new Date().toISOString(),
        ...data
      }
      console.log(JSON.stringify(payload))
    } catch (error) {
      console.warn('[EngineV21] Failed to emit structured log', error)
    }
  }

  private async persistMetricsSnapshot(
    status: 'running' | 'completed' | 'error' | 'suspended',
    counters?: SaveCounters,
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      let countersSnapshot = counters
      if (!countersSnapshot) {
        countersSnapshot = await getSaveCounters(this.options.patchId).catch(() => this.lastCounters)
      }
      if (countersSnapshot) {
        this.lastCounters = countersSnapshot
      }
      const trackerMetrics = this.metricsTracker.getMetrics()
      const snapshot: RunMetricsSnapshot = {
        runId: this.options.runId,
        patchId: this.options.patchId,
        status,
        timestamp: new Date().toISOString(),
        metrics: {
          ...this.metrics,
          tracker: trackerMetrics,
          counters: this.lastCounters,
          acceptance: this.metrics.acceptance,
          telemetry: { ...this.telemetry },
          ...extra
        }
      }
      await storeRunMetricsSnapshot(snapshot)
    } catch (error) {
      console.warn('[EngineV21] Failed to persist metrics snapshot', error)
    }
  }

  private resolveContestedClaim(contested: VetterResult['contested']): string | undefined {
    if (!contested || !contested.note) return undefined
    return contested.claim || undefined
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

  private async emitRunComplete(status: 'completed' | 'error' | 'suspended', error?: unknown) {
    const acceptance = status === 'completed' && this.plan
      ? evaluateAcceptance({
          timeToFirstMs: this.metrics.timeToFirstMs,
          savedCards: this.acceptanceCards,
          plannerAngles: Array.from(new Set((this.plan?.queryAngles || []).map((angle) => angle.angle).filter(Boolean))),
          contestedClaims: Array.from(new Set(this.plan?.controversyAngles?.map((angle) => angle.angle).filter(Boolean) || []))
        })
      : null

    if (acceptance) {
      this.metrics.acceptance = acceptance
    }

    const metricsWithTelemetry = { ...this.metrics, telemetry: { ...this.telemetry } }
    const auditMeta = acceptance ? { ...metricsWithTelemetry } : metricsWithTelemetry
    const formattedError = error ? this.formatError(error) : undefined

    await this.emitAudit('run_complete', status === 'completed' || status === 'suspended' ? 'ok' : 'fail', {
      meta: auditMeta,
      error: formattedError
    })

    this.structuredLog('run_complete', {
      status,
      acceptance,
      error: formattedError
    })

    this.metricsTracker.printSummary()
    logger.flush()

    await (prisma as any).discoveryRun.update({
      where: { id: this.options.runId },
      data: {
        status,
        endedAt: new Date(),
        metrics: ({
          ...auditMeta,
          status,
          error: formattedError
        } as unknown) as Prisma.JsonObject
      }
    }).catch((updateError: unknown) => {
      console.error('[EngineV21] Failed to save run metrics', updateError)
    })

    await this.persistMetricsSnapshot(status, this.lastCounters, {
      acceptance,
      error: formattedError
    })
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }
    return { message: String(error) }
  }
}
