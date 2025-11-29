import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { canonicalize, canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'
import { createHash } from 'crypto'
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
  incrementSaveCounters,
  getSaveCounters,
  clearSaveCounters,
  frontierSize,
  storeRunMetricsSnapshot,
  enqueueHeroRetry,
  getRunState,
  getZeroSaveDiagnostics,
  pushPaywallBranch,
  type SaveCounters,
  type RunMetricsSnapshot
} from '@/lib/redis/discovery'
import type { FrontierItem } from '@/lib/redis/discovery'
import { SimHash } from './deduplication'
import { DiscoveryPlan, PlannerSeedCandidate } from './planner'
import { vetSource, VetterResult } from './vetter'
import { DiscoveryCardPayload, type DiscoveryHero } from '@/types/discovery-card'
import { evaluateAcceptance, type AcceptanceCard, type AcceptanceResult } from './acceptance'
import {
  expandPlannerQuery,
  filterQuerySuggestions,
  type FilteredSuggestion,
  QueryExpanderConstants
} from './queryExpander'
import { DEEP_LINK_SCRAPER } from './flags'
import { extractOffHostLinks } from './refOut'
import { passesDeepLinkFilters } from './filters'
import {
  SchedulerGuards,
  type ControversyWindow,
  type WikiGuardState
} from './scheduler'
import {
  isDiscoveryV2ShadowModeEnabled,
  isDiscoveryV2WriteModeEnabled
} from './flags'
import { buildPaywallPlan } from './paywall'
import { extractOutgoingLinks, extractWikipediaReferences } from './wikiUtils'

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
  host?: string | null
  paywallBranch?: string | null
}

type NumericMetricKey =
  | 'candidatesProcessed'
  | 'urlsAttempted'
  | 'itemsSaved'
  | 'duplicates'
  | 'dropped'
  | 'failures'

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

type HeroViewpointClass = 'support' | 'counter' | 'neutral'

interface HeroGateEntry {
  domain: string | null
  viewpointClass: HeroViewpointClass
  rawViewpoint?: string | null
  isSfw: boolean
  publishDate?: string | null
  savedAt: number
}

const FETCH_TIMEOUT_MS = Number(process.env.DISCOVERY_V2_FETCH_TIMEOUT_MS ?? 6500)
const FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; CarrotBot/2.1)'
const MIN_CONTENT_LENGTH = Number(process.env.DISCOVERY_V2_MIN_CONTENT_LENGTH ?? 450)
const DUPLICATE_HASH_THRESHOLD = Number(process.env.DISCOVERY_V2_DUPLICATE_HASH_THRESHOLD ?? 7)
const MIN_RELEVANCE_SCORE = 0.65
const MIN_QUALITY_SCORE = 70
const MIN_IMPORTANCE_SCORE = 50 // Minimum importance score (0-100) - filters out low-importance content like game recaps
const PREFERRED_IMPORTANCE_SCORE = 70 // Preferred importance for high-priority content
const MIN_FACT_COUNT = 2
const CANONICAL_COOLDOWN_MS = 30 * 60 * 1000
const NON_PROVIDER_FAILURE_REASONS = new Set([
  'redis_seen',
  'db_duplicate',
  'signature_duplicate',
  'near_duplicate',
  'query_expanded',
  'query_deferred',
  'query_no_results',
  'query_insufficient_results',
  'run_suspended',
  'canonical_cooldown',
  'host_cap',
  'run_cap'
])

class PaywallBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaywallBlockedError'
  }
}

class RobotsBlockedError extends Error {
  constructor(
    message: string,
    public readonly meta: {
      userAgent: string
      rule: string | null
      status: number
      url: string
    }
  ) {
    super(message)
    this.name = 'RobotsBlockedError'
  }
}

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
  queriesExpanded: number
  queryExpansionSkipped: number
  queryDeferred: number
}

interface ExtractedContent {
  title: string
  text: string
  lang?: string
  headings?: string[]
  rawHtml?: string
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
    softAccepted: 0,
    queriesExpanded: 0,
    queryExpansionSkipped: 0,
    queryDeferred: 0
  }
  private firstItemTimestamp?: number
  private plan: DiscoveryPlan | null = null
  private acceptanceCards: AcceptanceCard[] = []
  private metricsTracker: MetricsTracker
  private lastCounters: SaveCounters = { total: 0, controversy: 0, history: 0 }
  private priorityBurstProcessed = false
  private metricsMutationQueue: Promise<void> = Promise.resolve()
  private runSignatures = new Set<string>()
  private wikiRefCache = new Set<string>()
  private refOutCache = new Set<string>()
  private attemptedControversy = 0
  private attemptedTotal = 0
  private contestedKeywords = new Set<string>()
  private lastRunStateCheck = 0
  private lastRunState: 'live' | 'suspended' | 'paused' | null = null
  private seedCanonicalUrls = new Set<string>()
  private expansionCooldowns = new Map<string, { lastSeen: number; cooldownUntil: number }>()
  private scheduler: SchedulerGuards
  private wikiGuardState: WikiGuardState = { active: false, share: 0, window: 0 }
  private controversyWindow: ControversyWindow = { attemptRatio: 0, saveRatio: 0, size: 0 }
  private zeroSaveWarningIssued = false
  private zeroSaveAutoPaused = false
  private shadowMode = false
  private simhashes: bigint[] = []
  private redisPatchId: string
  private firstTwentyHosts: string[] = []
  private firstTwelveAngles: string[] = []
  private firstTwelveViewpoints: string[] = []
  private hookAttemptCounts = new Map<string, number>()
  private hostThrottleHits: Record<string, number> = {}
  private heartbeatTimer?: NodeJS.Timeout
  private startTime?: number
  private heroGateMap = new Map<string, HeroGateEntry[]>()
  private discoveryTelemetry: any | null = null // DiscoveryTelemetry instance
  private lastHeroGateEvaluation: {
    eligible: boolean
    supportDomain?: string | null
    counterDomain?: string | null
    score?: number | null
  } = {
    eligible: false
  }
  private earlyHostReseedTriggered = false
  private midWaveReseedTriggered = false
  private fullQuotaReseedTriggered = false
  private reseedAttempts = 0
  // Raise circuit breaker threshold during debug - allow more reseed attempts before hard-stop
  private readonly MAX_RESEED_ATTEMPTS = Number(process.env.CRAWLER_MAX_RESEED_ATTEMPTS || 10)
  private lastReseedTime = 0
  private reseedBackoffMs = 100

  constructor(private options: EngineOptions, eventStream?: DiscoveryEventStream) {
    this.eventStream = eventStream ?? new DiscoveryEventStream()
    this.heroPipeline = new HeroImagePipeline(process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com')
    this.metricsTracker = new MetricsTracker(`${options.patchHandle}:${options.runId}`)
    this.shadowMode = isDiscoveryV2ShadowModeEnabled() && !isDiscoveryV2WriteModeEnabled()
    this.redisPatchId = this.shadowMode ? `shadow::${options.patchId}` : options.patchId
    this.scheduler = new SchedulerGuards({
      patchId: options.patchId,
      redisPatchId: this.redisPatchId,
      wikiShareMax: Number(process.env.DISCOVERY_V2_WIKI_SHARE_MAX ?? 0.3),
      qpsPerHost: Number(process.env.DISCOVERY_V2_QPS_PER_HOST ?? 0.5)
    })
    // Initialize discovery telemetry (async, but non-blocking)
    this.initDiscoveryTelemetry().catch(err => {
      console.warn('[EngineV21] Failed to initialize discovery telemetry:', err)
    })
  }

  private async initDiscoveryTelemetry() {
    try {
      const { DiscoveryTelemetry } = await import('./telemetry')
      this.discoveryTelemetry = new DiscoveryTelemetry(this.options.patchId, this.options.runId)
    } catch (error) {
      console.warn('[EngineV21] Failed to initialize discovery telemetry:', error)
    }
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

  private isNumericMetric(key: keyof Metrics): key is NumericMetricKey {
    return (
      key === 'candidatesProcessed' ||
      key === 'urlsAttempted' ||
      key === 'itemsSaved' ||
      key === 'duplicates' ||
      key === 'dropped' ||
      key === 'failures'
    )
  }

  private incrementMetric(key: keyof Metrics, delta: number = 1): Promise<void> {
    if (!this.isNumericMetric(key)) {
      return Promise.resolve()
    }
    return this.mutateMetrics(() => {
      const current = (this.metrics[key] ?? 0) as number
      this.metrics[key] = (current + delta) as Metrics[NumericMetricKey]
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
    this.stopHeartbeat()
  }

  private startHeartbeat(): void {
    const interval = Number(process.env.DISCOVERY_HEARTBEAT_MS || 15000)
    this.heartbeatTimer = setInterval(async () => {
      try {
        const { slog } = await import('@/lib/log')
        const { pushEvent } = await import('./eventRing')
        const { frontierSize } = await import('@/lib/redis/discovery')
        
        const queueLen = await frontierSize(this.redisPatchId).catch(() => -1)
        const uptime_s = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000)
        
        const logObj = {
          step: 'discovery',
          msg: 'heartbeat',
          job_id: this.options.patchId,
          run_id: this.options.runId,
          queue_len: queueLen,
          uptime_s,
          fetched: this.metrics.candidatesProcessed,
          enqueued: this.telemetry.queriesExpanded,
          deduped: this.metrics.duplicates,
          skipped: this.telemetry.robotsBlock + this.telemetry.paywall,
          persisted: this.metrics.itemsSaved,
          errors: this.metrics.failures,
        }
        slog('info', logObj)
        pushEvent(logObj)
      } catch {
        // Non-fatal if logging fails
      }
    }, interval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  async start(): Promise<void> {
    const { patchId, patchName, runId } = this.options
    this.startTime = Date.now()

    this.eventStream.start(patchId, runId)
    this.structuredLog('run_start', {
      patchId,
      runId,
      patchName
    })

    // Structured logging for start
    try {
      const { slog } = await import('@/lib/log')
      const { pushEvent } = await import('./eventRing')
      const logObj = {
        step: 'discovery',
        msg: 'start',
        job_id: patchId,
        run_id: runId,
        patchName,
      }
      slog('info', logObj)
      pushEvent(logObj)
    } catch {
      // Non-fatal
    }

    // Start heartbeat
    this.startHeartbeat()

    try {
      this.priorityBurstProcessed = false
      this.plan = await loadDiscoveryPlan<DiscoveryPlan>(runId)
      if (!this.plan) {
        throw new Error(`discovery_plan_missing:${runId}`)
      }
      this.seedCanonicalUrls = new Set(
        (this.plan.seedCandidates ?? [])
          .map((seed) => canonicalizeUrlFast(seed.url))
          .filter((value): value is string => Boolean(value && value.length))
      )
      this.contestedKeywords = this.buildContestedKeywords(this.plan)
      this.runSignatures.clear()
      this.wikiRefCache.clear()
      this.refOutCache.clear()
      this.attemptedControversy = 0
      this.attemptedTotal = 0
      this.lastRunState = 'live'
      this.firstTwentyHosts = []
      this.firstTwelveAngles = []
      this.firstTwelveViewpoints = []
      this.hookAttemptCounts.clear()
      this.hostThrottleHits = {}
      this.heroGateMap.clear()
      this.lastHeroGateEvaluation = { eligible: false }
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
        softAccepted: 0,
        queriesExpanded: 0,
        queryExpansionSkipped: 0,
        queryDeferred: 0
      }
      await this.scheduler.hydrateFromRedis()

      const zeroSaveState = await getZeroSaveDiagnostics(this.redisPatchId).catch(() => null)
      if (zeroSaveState) {
        this.zeroSaveWarningIssued = zeroSaveState.status === 'warning' || zeroSaveState.status === 'paused'
        this.zeroSaveAutoPaused = zeroSaveState.status === 'paused'
      } else {
        this.zeroSaveWarningIssued = false
        this.zeroSaveAutoPaused = false
      }

      await clearSaveCounters(this.redisPatchId).catch(() => undefined)
      this.lastCounters = { total: 0, controversy: 0, history: 0 }
      const coveredAngles = await getCoveredAngles(runId)
      await this.persistMetricsSnapshot('running', this.lastCounters, { event: 'start' })
      await this.discoveryLoop(coveredAngles)

      const status = this.stopRequested ? 'suspended' : 'completed'
      await this.emitRunComplete(status)
      
      // Structured logging for stop
      try {
        const { slog } = await import('@/lib/log')
        const { pushEvent } = await import('./eventRing')
        const duration_s = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
        const logObj = {
          step: 'discovery',
          msg: 'stop',
          job_id: this.options.patchId,
          run_id: this.options.runId,
          status,
          duration_s,
          fetched: this.metrics.candidatesProcessed,
          enqueued: this.telemetry.queriesExpanded,
          deduped: this.metrics.duplicates,
          skipped: this.telemetry.robotsBlock + this.telemetry.paywall,
          persisted: this.metrics.itemsSaved,
          errors: this.metrics.failures,
        }
        slog('info', logObj)
        pushEvent(logObj)
      } catch {
        // Non-fatal
      }
    } catch (error) {
      console.error('[EngineV21] Fatal error in discovery engine:', error)
      await this.emitRunComplete('error', error)
      this.eventStream.error('Discovery engine failed', error)
      
      // Structured logging for fatal error
      try {
        const { slog } = await import('@/lib/log')
        const { pushEvent } = await import('./eventRing')
        const logObj = {
          step: 'discovery',
          msg: 'fatal',
          job_id: this.options.patchId,
          run_id: this.options.runId,
          error: error instanceof Error ? error.message : String(error),
        }
        slog('error', logObj)
        pushEvent(logObj)
      } catch {
        // Non-fatal
      }
      
      throw error
    } finally {
      this.stopHeartbeat()
      await clearPlan(runId).catch(console.error)
    }
  }

  private async discoveryLoop(coveredAngles: Set<string>): Promise<void> {
    const redisPatchId = this.redisPatchId
    const startTime = Date.now()

    if (!this.priorityBurstProcessed) {
      const handled = await this.processPriorityBurst(coveredAngles, startTime)
      this.priorityBurstProcessed = true
      if (handled && this.stopRequested) {
        return
      }
    }

    while (!this.stopRequested) {
      if (!(await this.ensureLiveState('loop'))) {
        break
      }
      const candidate = await this.pullCandidateWithBias(redisPatchId)

      if (!candidate) {
        const expanded = await this.expandFrontierIfNeeded(redisPatchId, coveredAngles)
        if (!expanded) {
          await this.persistMetricsSnapshot('running', this.lastCounters, { reason: 'frontier_empty' })
          this.eventStream.idle('Frontier empty')
          
          // Log idle state
          try {
            const { slog } = await import('@/lib/log')
            const { pushEvent } = await import('./eventRing')
            const { frontierSize } = await import('@/lib/redis/discovery')
            const queueLen = await frontierSize(redisPatchId).catch(() => 0)
            const logObj = {
              step: 'discovery',
              msg: 'idle',
              job_id: this.options.patchId,
              run_id: this.options.runId,
              queue_len: queueLen,
              reason: 'frontier_empty',
            }
            slog('info', logObj)
            pushEvent(logObj)
          } catch {
            // Non-fatal
          }
          
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
    const redisPatchId = this.redisPatchId
    const burst: FrontierItem[] = []
    const toRequeue: FrontierItem[] = []

    while (burst.length < 3) {
      if (!(await this.ensureLiveState('priority_burst'))) {
        return false
      }
      const candidate = await popFromFrontier(redisPatchId)
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
      await Promise.all(toRequeue.map((item) => addToFrontier(redisPatchId, item)))
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
    const redisPatchId = this.redisPatchId
    const now = Date.now()
    const host = this.resolveHost(candidate)
    const isContested = this.isControversyCandidate(candidate)
    this.recordFirstWaveStats(host, candidate)
    this.scheduler.recordAttempt({
      timestamp: now,
      host,
      isContested,
      isWikipedia: Boolean(host && host.endsWith('wikipedia.org'))
    })
    this.wikiGuardState = this.scheduler.getWikiGuardState()
    this.controversyWindow = this.scheduler.getControversyWindow()
    this.hostThrottleHits = this.scheduler.getThrottleSnapshot()
    await this.incrementMetric('candidatesProcessed')

    if (host && this.scheduler.getHostAttemptCount(host) > this.scheduler.getHostAttemptCap()) {
      await this.emitAudit('guard', 'fail', {
        candidateUrl: candidate.cursor,
        provider: candidate.provider,
        meta: { reason: 'host_cap', host, cap: this.scheduler.getHostAttemptCap() }
      })
      this.structuredLog('host_cap_guard', { host, cap: this.scheduler.getHostAttemptCap() })
      return
    }

    const totalAttempts = this.scheduler.getTotalAttemptCount()
    const runCap = this.scheduler.getRunAttemptCap()
    if (totalAttempts > runCap) {
      this.structuredLog('run_cap_guard', { attempts: totalAttempts, cap: runCap })
      await this.emitAudit('guard', 'fail', {
        candidateUrl: candidate.cursor,
        provider: candidate.provider,
        meta: { reason: 'run_cap', cap: runCap, attempts: totalAttempts }
      })
      this.stopRequested = true
      return
    }

    const depth = await frontierSize(redisPatchId).catch(() => 0)
    this.metricsTracker.updateFrontierDepth(typeof depth === 'number' ? depth : 0)
    const countersBefore = await getSaveCounters(redisPatchId)
    this.attemptedTotal += 1
    if (isContested) {
      this.attemptedControversy += 1
    }
    const result = await this.processCandidate(candidate, countersBefore)
    await this.applyProcessOutcome(result, candidate, coveredAngles, startTime)
    const frontierDepth = typeof depth === 'number' ? depth : 0
    this.emitMetricsSnapshot(frontierDepth)
    await this.handleZeroSaveSlo()
    // Circuit breaker: prevent infinite reseed loops
    if (this.scheduler.needsReseed() && this.reseedAttempts < this.MAX_RESEED_ATTEMPTS) {
      const now = Date.now()
      const timeSinceLastReseed = now - this.lastReseedTime
      const backoffWithJitter = this.reseedBackoffMs + Math.random() * 250
      
      if (timeSinceLastReseed >= backoffWithJitter) {
        await this.triggerReseed(coveredAngles, 'scheduler_guard')
        this.reseedAttempts++
        this.lastReseedTime = now
        this.reseedBackoffMs = Math.min(this.reseedBackoffMs * 2, 5000) // Exponential backoff, max 5s
      }
    } else if (this.scheduler.needsReseed() && this.reseedAttempts >= this.MAX_RESEED_ATTEMPTS) {
      this.structuredLog('reseed_circuit_breaker', {
        reason: 'max_reseed_attempts_reached',
        attempts: this.reseedAttempts,
        maxAttempts: this.MAX_RESEED_ATTEMPTS
      })
      // Don't stop the run on reseed circuit breaker - just log and continue
      // The zero-save SLO will handle stopping if needed
      console.warn(`[EngineV21] Reseed circuit breaker reached (${this.reseedAttempts}/${this.MAX_RESEED_ATTEMPTS}), but continuing discovery`)
    }
  }

  private shouldBiasControversy(): boolean {
    if (this.attemptedTotal >= 10) return false
    if (this.attemptedTotal === 0) return true
    return this.attemptedControversy / Math.max(this.attemptedTotal, 1) < 0.5
  }

  private isControversyCandidate(candidate: FrontierItem): boolean {
    if (candidate.meta?.isControversy === true) return true
    if (typeof candidate.meta?.stance === 'string' && candidate.meta.stance.toLowerCase() === 'contested') return true
    const angle = candidate.angle?.toLowerCase?.() ?? ''
    const cursor = typeof candidate.cursor === 'string' ? candidate.cursor.toLowerCase() : ''
    for (const keyword of this.contestedKeywords) {
      if (!keyword) continue
      if (angle.includes(keyword) || cursor.includes(keyword)) {
        return true
      }
    }
    return false
  }

  private async pullCandidateWithBias(patchId: string): Promise<FrontierItem | null> {
    let attempts = 0
    while (attempts < 12) {
      const candidate = await popFromFrontier(patchId)
      if (!candidate) {
        return null
      }
      const host = this.resolveHost(candidate)
      const isContested = this.isControversyCandidate(candidate)
      const evaluation = this.scheduler.evaluateCandidate({
        candidate,
        host,
        isContested
      })
      if (evaluation.action === 'accept') {
        return evaluation.candidate
      }
      await addToFrontier(patchId, evaluation.candidate)
      attempts += 1
    }
    return null
  }

  private async ensureLiveState(context: string): Promise<boolean> {
    const state = await this.getCurrentRunState()
    if (state && state !== 'live') {
      this.structuredLog('run_state_exit', { state, context })
      this.stopRequested = true
      return false
    }
    return true
  }

  private async getCurrentRunState(): Promise<'live' | 'suspended' | 'paused' | null> {
    const now = Date.now()
    if (now - this.lastRunStateCheck < 1000 && this.lastRunState !== null) {
      return this.lastRunState
    }
    try {
      const state = await getRunState(this.options.patchId)
      this.lastRunState = state
      this.lastRunStateCheck = now
      return state
    } catch {
      this.lastRunState = 'live'
      this.lastRunStateCheck = now
      return 'live'
    }
  }

  private computeSignature(url: string, content: ExtractedContent): string {
    const preview = `${content.title ?? ''}::${(content.text ?? '').slice(0, 280)}`
    return createHash('sha1').update(url.toLowerCase()).update(preview).digest('hex')
  }

  private isWikipediaUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase()
      return host.endsWith('wikipedia.org')
    } catch {
      return false
    }
  }

  private async enqueueWikipediaReferences(
    rawHtml: string | undefined,
    sourceUrl: string,
    parent: FrontierItem
  ): Promise<void> {
    if (!rawHtml || !this.isWikipediaUrl(sourceUrl)) return
    if (this.wikiRefCache.has(sourceUrl)) return
    this.wikiRefCache.add(sourceUrl)

    const citations = extractWikipediaReferences(rawHtml, sourceUrl, 20)
    if (!citations.length) return

    await this.enqueueRefOutLinks(citations, parent, sourceUrl, 'wikipedia')
  }

  private async enqueueHtmlOutgoingReferences(
    rawHtml: string | undefined,
    sourceUrl: string,
    parent: FrontierItem
  ): Promise<void> {
    if (!rawHtml) return

    const { offHost, sameHost } = extractOutgoingLinks(rawHtml, sourceUrl, 40)
    const ordered = [...offHost, ...sameHost].slice(0, 20)
    if (!ordered.length) return

    await this.enqueueRefOutLinks(ordered, parent, sourceUrl, 'html')
  }

  private async enqueueRefOutLinks(
    links: string[],
    parent: FrontierItem,
    sourceUrl: string,
    context: 'wikipedia' | 'html'
  ): Promise<void> {
    const sourceHost = (() => {
      try {
        return new URL(sourceUrl).hostname.toLowerCase()
      } catch {
        return null
      }
    })()

    const viewpoint = (parent.meta?.viewpoint as string | undefined) ?? (parent.meta?.stance as string | undefined)
    const angleCategory = (parent.meta?.angleCategory as string | undefined) ?? parent.meta?.angle
    const enqueued: string[] = []

    await Promise.all(
      links.map(async (rawUrl, index) => {
        // Filter out invalid URLs before processing
        if (!this.isValidHttpUrl(rawUrl)) {
          return
        }

        const canonical = canonicalizeUrlFast(rawUrl)
        if (!canonical) return
        if (this.refOutCache.has(canonical) || this.seedCanonicalUrls.has(canonical)) return
        if (this.isWikipediaUrl(canonical)) return

        let parsed: URL
        try {
          parsed = new URL(canonical)
        } catch {
          return
        }

        const segments = parsed.pathname.split('/').filter(Boolean)
        if (segments.length < 2) return

        // Skip directory/listing pages and privacy pages
        if (this.isDirectoryOrListingPage(canonical)) return

        this.refOutCache.add(canonical)
        this.seedCanonicalUrls.add(canonical)

        const item: FrontierItem = {
          id: `ref_out:${Date.now()}:${Math.random()}`,
          provider: 'direct',
          cursor: canonical,
          priority: parent.priority - 6 - index * 2,
          angle: parent.angle ?? undefined,
          meta: {
            reason: context === 'wikipedia' ? 'ref_out_wiki' : 'ref_out',
            parent: sourceUrl,
            parentHost: sourceHost ?? null,
            hookId: parent.meta?.hookId,
            viewpoint,
            angleCategory,
            originatingProvider: parent.provider,
            originatingReason: parent.meta?.reason,
            minPubDate: parent.meta?.minPubDate
          }
        }

        await addToFrontier(this.redisPatchId, item)
        enqueued.push(canonical)
      })
    )

    if (!enqueued.length) return

    this.structuredLog('ref_out_enqueued', {
      source: sourceUrl,
      count: enqueued.length,
      context
    })
    await this.emitAudit('ref_out_expand', 'ok', {
      candidateUrl: sourceUrl,
      meta: { enqueued, context }
    })
  }

  private isValidHttpUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false
    
    const trimmed = url.trim()
    if (!trimmed) return false
    
    // Reject non-HTTP(S) protocols (data:, javascript:, mw-data:, etc.)
    const invalidProtocols = ['data:', 'javascript:', 'mailto:', 'tel:', 'file:', 'mw-data:', 'about:', 'chrome:', 'edge:']
    const lowerUrl = trimmed.toLowerCase()
    if (invalidProtocols.some(proto => lowerUrl.startsWith(proto))) {
      return false
    }
    
    // Reject PDF files and other non-HTML content
    const nonHtmlExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.tar', '.gz']
    if (nonHtmlExtensions.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + '?'))) {
      return false
    }
    
    // Must start with http:// or https:// (or be a valid absolute URL)
    if (!trimmed.match(/^https?:\/\//i)) {
      // Try to validate if it's a valid URL that can be made absolute
      try {
        const testUrl = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : `https://${trimmed}`)
        // Additional check: reject URLs with invalid path patterns
        if (testUrl.pathname.includes('mw-data:') || testUrl.pathname.includes('TemplateStyles:')) {
          return false
        }
        return true
      } catch {
        return false
      }
    }
    
    // Additional validation: check for Wikipedia internal resource patterns
    if (trimmed.includes('mw-data:') || trimmed.includes('TemplateStyles:')) {
      return false
    }
    
    return true
  }

  private normaliseHost(input: string | null | undefined): string | null {
    if (!input) return null
    try {
      const normalised = input.replace(/^https?:\/\//i, '')
      return new URL(`https://${normalised}`).hostname.toLowerCase()
    } catch {
      try {
        return new URL(input).hostname.toLowerCase()
      } catch {
        return input.toLowerCase()
      }
    }
  }

  private isDirectoryOrListingPage(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname.toLowerCase()
      const hostname = urlObj.hostname.toLowerCase()
      
      // Privacy policy pages
      if (pathname.includes('/privacy') || hostname.includes('privacy')) {
        return true
      }
      
      // URLs ending with just a slash (directory)
      if (pathname === '/' || pathname.match(/^\/[^\/]+\/$/)) {
        return true
      }
      
      // Common directory/listing patterns
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
        /\/sports\/[^\/]+\/?$/,  // /sports/category/ (single category level)
        /\/sports\/[^\/]+\/[^\/]+\/?$/,  // /sports/category/team/ (team directory)
        /\/nba\/[^\/]+\/?$/,  // /nba/category/ (single category level)
      ]
      
      if (directoryPatterns.some(pattern => pattern.test(pathname))) {
        return true
      }
      
      // Check if path looks like a listing (ends with category but no article slug)
      const pathSegments = pathname.split('/').filter(Boolean)
      
      // If URL ends with / and has 2+ segments, likely a directory
      if (pathname.endsWith('/') && pathSegments.length >= 2) {
        return true
      }
      
      // Check for category-like patterns
      if (pathSegments.length >= 2) {
        const lastSegment = pathSegments[pathSegments.length - 1]
        const categoryWords = ['news', 'sports', 'tag', 'category', 'archive', 'blog', 'articles', 'bulls']
        
        // If last segment is a category word or very short, likely a listing
        if (categoryWords.includes(lastSegment) || lastSegment.length < 5) {
          return true
        }
        
        // If path contains /sports/ or /nba/ and ends with a team/category name (not an article slug)
        const hasSportsPath = pathname.includes('/sports/') || pathname.includes('/nba/')
        if (hasSportsPath) {
          // Team/category names are usually lowercase with hyphens, no dates/numbers
          const looksLikeArticleSlug = /\d{4}|\d{2}-\d{2}|article|story|post/.test(lastSegment)
          if (!looksLikeArticleSlug && lastSegment.length > 5 && lastSegment.length < 30) {
            // Likely a team/category name, not an article
            return true
          }
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  private resolveHost(candidate: FrontierItem): string | null {
    const metaHost = typeof candidate.meta?.host === 'string' ? candidate.meta.host : undefined
    if (metaHost && metaHost.length > 0) {
      return this.normaliseHost(metaHost)
    }
    const cursor = typeof candidate.cursor === 'string' ? candidate.cursor : ''
    if (!cursor) return null
    try {
      return new URL(cursor).hostname.toLowerCase()
    } catch {
      return null
    }
  }

  private recordFirstWaveStats(host: string | null, candidate: FrontierItem): void {
    if (host && this.firstTwentyHosts.length < 20) {
      this.firstTwentyHosts.push(host)
    }

    const angleCategory = (candidate.meta?.angleCategory as string | undefined) ?? (candidate.meta?.angle as string | undefined) ?? candidate.angle
    if (angleCategory && this.firstTwelveAngles.length < 12) {
      this.firstTwelveAngles.push(angleCategory)
    }

    const viewpoint = (candidate.meta?.viewpoint as string | undefined) ?? (candidate.meta?.stance as string | undefined)
    if (viewpoint && this.firstTwelveViewpoints.length < 12) {
      this.firstTwelveViewpoints.push(viewpoint)
    }

    const hookId = typeof candidate.meta?.hookId === 'string' ? candidate.meta.hookId : undefined
    if (hookId && this.firstTwentyHosts.length < 20) {
      this.hookAttemptCounts.set(hookId, (this.hookAttemptCounts.get(hookId) ?? 0) + 1)
    }
  }

  private toCountMap(values: string[], limit: number): Record<string, number> {
    const acc = new Map<string, number>()
    for (let i = 0; i < values.length && i < limit; i += 1) {
      const value = values[i]
      if (!value) continue
      acc.set(value, (acc.get(value) ?? 0) + 1)
    }
    return Object.fromEntries(acc.entries())
  }

  private shouldRecordFailure(reason?: string): boolean {
    if (!reason) return true
    return !NON_PROVIDER_FAILURE_REASONS.has(reason)
  }

  private async recordSuccessOutcome(host: string, outcome: 'success' | 'failure'): Promise<void> {
    await this.scheduler.persistSuccessRate(host, outcome)
  }

  private async handleZeroSaveSlo(): Promise<void> {
    const status = await this.scheduler.handleZeroSave(this.metrics.candidatesProcessed, this.startTime)
    this.zeroSaveWarningIssued = status === 'warning'
    this.zeroSaveAutoPaused = status === 'paused'
    if (status === 'paused') {
      this.eventStream.pause()
      this.stopRequested = true
    }
  }

  private async triggerReseed(coveredAngles: Set<string>, reason: string): Promise<void> {
    // Circuit breaker check
    if (this.reseedAttempts >= this.MAX_RESEED_ATTEMPTS) {
      this.structuredLog('reseed_blocked', {
        reason: 'circuit_breaker',
        attempts: this.reseedAttempts,
        maxAttempts: this.MAX_RESEED_ATTEMPTS
      })
      return
    }

    try {
      const reseeded = await this.expandFrontierIfNeeded(this.redisPatchId, coveredAngles)
      if (reseeded) {
        this.structuredLog('reseed_triggered', {
          reason,
          hostDiversity: this.scheduler.getHostDiversityCount(),
          wikiGuard: this.wikiGuardState.active,
          attempt: this.reseedAttempts + 1,
          maxAttempts: this.MAX_RESEED_ATTEMPTS
        })
        await this.emitAudit('reseed', 'ok', {
          provider: 'scheduler',
          candidateUrl: null,
          meta: {
            reason,
            hostDiversity: this.scheduler.getHostDiversityCount(),
            wikiGuard: this.wikiGuardState.active,
            attempt: this.reseedAttempts + 1
          }
        })
      }
    } catch (error) {
      console.warn('[EngineV21] Failed to trigger reseed', error)
      this.structuredLog('reseed_failed', {
        reason: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async enqueueQuerySuggestion(
    parent: FrontierItem,
    item: FilteredSuggestion,
    index: number
  ): Promise<void> {
    const basePriority =
      parent.priority +
      (typeof item.suggestion.priorityOffset === 'number' ? item.suggestion.priorityOffset : 0)
    const newItem: FrontierItem = {
      id: `query_result:${Date.now()}:${Math.random()}`,
      provider: 'direct',
      cursor: item.suggestion.url,
      priority: basePriority - index * 4,
      angle: parent.meta?.angle as string | undefined,
      meta: {
        reason: 'planner_query',
        queryProvider: parent.provider,
        queryPlanIndex: parent.meta?.planIndex,
        sourceType: item.suggestion.sourceType,
        host: item.suggestion.host,
        keywords: item.suggestion.keywords,
        plannerQueryMeta: item.suggestion.metadata,
        hookId: parent.meta?.hookId,
        viewpoint: parent.meta?.viewpoint,
        angleCategory: parent.meta?.angleCategory,
        minPubDate: parent.meta?.minPubDate,
        queryAttempts: parent.meta?.queryAttempts ?? 0
      }
    }

    await addToFrontier(this.redisPatchId, newItem)
  }

  private async requeueQueryCandidate(candidate: FrontierItem, nextAttempt: number): Promise<void> {
    const updated: FrontierItem = {
      ...candidate,
      id: `query_retry:${Date.now()}:${Math.random()}`,
      priority: candidate.priority - 10,
      meta: {
        ...candidate.meta,
        queryAttempts: nextAttempt
      }
    }

    await addToFrontier(this.redisPatchId, updated)
  }

  private emitMetricsSnapshot(frontierDepth: number): void {
    const first20Hosts = this.firstTwentyHosts.slice(0, 20)
    const distinctFirst20Hosts = Array.from(new Set(first20Hosts))
    const first12AngleCounts = this.toCountMap(this.firstTwelveAngles, 12)
    const first12ViewpointCounts = this.toCountMap(this.firstTwelveViewpoints, 12)

    // Logs-only SLO alerts
    try {
      // Zero-save thresholds (warn@25, error/pause@40)
      if (this.metrics.itemsSaved === 0) {
        if (this.metrics.candidatesProcessed === 25) {
          console.warn(
            `[Discovery SLO] zero-save warning@25 attempts (handle=${this.options.patchHandle}, run=${this.options.runId})`
          )
        } else if (this.metrics.candidatesProcessed === 40) {
          // Note: This is just a warning log - actual pause is handled by scheduler.ts with time-based check
          console.warn(
            `[Discovery SLO] zero-save warning@40 attempts (handle=${this.options.patchHandle}, run=${this.options.runId}) - pause will occur after 2+ minutes if no saves`
          )
        }
      }

      // Host diversity: <6 distinct hosts in first 20 dequeues
      if (first20Hosts.length >= 20 && distinctFirst20Hosts.length < 6) {
        console.warn(
          `[Discovery SLO] low host diversity in first-20 (distinct=${distinctFirst20Hosts.length}) (handle=${this.options.patchHandle}, run=${this.options.runId})`
        )
      }

      // Wikipedia share >30% in rolling window
      const wikiShareMax = Number(process.env.DISCOVERY_V2_WIKI_SHARE_MAX ?? 0.3)
      if (this.wikiGuardState.share > wikiShareMax) {
        console.warn(
          `[Discovery SLO] high wiki share (${(this.wikiGuardState.share * 100).toFixed(
            1
          )}%) (handle=${this.options.patchHandle}, run=${this.options.runId})`
        )
      }
    } catch {
      // best-effort logging only
    }
    const hookAttemptCounts = Object.fromEntries(this.hookAttemptCounts.entries())
    const hookValues = Object.values(hookAttemptCounts) as number[]
    const totalAttempts = this.scheduler.getTotalAttemptCount()
    const first20HostTargetMet = first20Hosts.length >= 20 ? distinctFirst20Hosts.length >= 6 : false
    const first12AngleTargetMet = this.firstTwelveAngles.length >= 12 ? Object.keys(first12AngleCounts).length >= 4 : false
    const first12ViewpointTargetMet = this.firstTwelveViewpoints.length >= 12 ? Object.keys(first12ViewpointCounts).length >= 3 : false
    const hooksAttemptTargetMet = first20Hosts.length >= 20 && hookValues.length > 0
      ? hookValues.every((value) => value >= 2)
      : false
    this.eventStream.metrics({
      frontier: frontierDepth,
      duplicates: this.metrics.duplicates,
      skipped: this.metrics.dropped,
      saved: this.metrics.itemsSaved,
      attempted: this.metrics.candidatesProcessed,
      runState: this.lastRunState ?? 'live',
      wikiShare: this.wikiGuardState.share,
      wikiGuardActive: this.wikiGuardState.active,
      hostDiversity: this.scheduler.getHostDiversityCount(),
      controversyAttemptRatio: this.controversyWindow.attemptRatio,
      controversySaveRatio: this.controversyWindow.saveRatio,
      zeroSaveWarning: this.zeroSaveWarningIssued,
      zeroSavePaused: this.zeroSaveAutoPaused,
      first20Hosts,
      first20HostCount: distinctFirst20Hosts.length,
      first12Angles: first12AngleCounts,
      first12Viewpoints: first12ViewpointCounts,
      hookAttemptCounts,
      hostThrottleHits: this.hostThrottleHits,
      hostAttemptSnapshot: this.scheduler.getHostAttemptSnapshot(),
      hostAttemptCap: this.scheduler.getHostAttemptCap(),
      runAttemptCap: this.scheduler.getRunAttemptCap(),
      totalAttempts,
      heroGate: this.lastHeroGateEvaluation,
      quotaStatus: {
        first20Hosts: first20HostTargetMet,
        first12Angles: first12AngleTargetMet,
        first12Viewpoints: first12ViewpointTargetMet,
        hookAttempts: hooksAttemptTargetMet
      }
    })
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
      this.scheduler.recordSave({ timestamp: Date.now(), isContested: this.isControversyCandidate(candidate) })
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

    if (result.host) {
      if (result.saved) {
        await this.recordSuccessOutcome(result.host, 'success')
      } else if (this.shouldRecordFailure(result.reason)) {
        await this.recordSuccessOutcome(result.host, 'failure')
      }
    }
  }

  private async expandQueryCandidate(candidate: FrontierItem): Promise<string> {
    const { patchId } = this.options
    const attempts = Number(candidate.meta?.queryAttempts ?? 0)
    const expansion = await expandPlannerQuery({
      candidate,
      attempt: attempts,
      totalDequeues: this.scheduler.getTotalAttemptCount()
    })

    const extractHostFromUrl = (rawUrl: string): string | null => {
      try {
        return new URL(rawUrl).hostname.toLowerCase()
      } catch {
        return null
      }
    }

    const filterResult = await filterQuerySuggestions(expansion.suggestions, {
      patchId,
      seeds: this.seedCanonicalUrls,
      cooldowns: this.expansionCooldowns,
      isSeen
    })

    const accepted = filterResult.accepted
    const skipped = filterResult.skipped

    const hostSet = new Set<string>()
    accepted.forEach((item) => {
      const host = item.suggestion.host ?? extractHostFromUrl(item.suggestion.url)
      if (host && !host.endsWith('wikipedia.org')) {
        hostSet.add(host)
      }
    })

    const meetsMinimum = accepted.length >= QueryExpanderConstants.MIN_RESULTS_PER_QUERY
    const meetsHostMix = hostSet.size >= 3

    let enqueuedCount = 0
    if (meetsMinimum && meetsHostMix) {
      for (let index = 0; index < accepted.length; index += 1) {
        const item = accepted[index]
        await this.enqueueQuerySuggestion(candidate, item, index)
      }
      enqueuedCount = accepted.length
      this.telemetry.queriesExpanded += enqueuedCount
    }

    if (skipped.length > 0) {
      this.telemetry.queryExpansionSkipped += skipped.length
    }

    const skippedByReason = skipped.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.reason] = (acc[entry.reason] ?? 0) + 1
      return acc
    }, {})

    await this.emitAudit('query_expand', accepted.length > 0 ? 'ok' : 'fail', {
      candidateUrl: typeof candidate.cursor === 'string' ? candidate.cursor : undefined,
      provider: candidate.provider,
      meta: {
        generated: enqueuedCount,
        skipped: skippedByReason,
        deferredGeneral: expansion.deferredGeneral,
        attempts,
        hostMix: hostSet.size,
        meetsThresholds: meetsMinimum && meetsHostMix
      }
    })

    this.structuredLog('query_expand', {
      provider: candidate.provider,
      generated: enqueuedCount,
      skipped: skippedByReason,
      deferredGeneral: expansion.deferredGeneral,
      attempts,
      hostMix: hostSet.size,
      meetsThresholds: meetsMinimum && meetsHostMix
    })

    await this.persistMetricsSnapshot('running', this.lastCounters, {
      queryExpansion: {
        provider: candidate.provider,
        accepted: enqueuedCount,
        skipped: skippedByReason,
        deferred: expansion.deferredGeneral,
        attempts,
        hostMix: hostSet.size,
        meetsThresholds: meetsMinimum && meetsHostMix
      }
    })

    if (enqueuedCount > 0) {
      return 'query_expanded'
    }

    if (expansion.deferredGeneral) {
      this.telemetry.queryDeferred += 1
      if (attempts + 1 <= QueryExpanderConstants.GENERAL_UNLOCK_ATTEMPTS) {
        await this.requeueQueryCandidate(candidate, attempts + 1)
      }
      return 'query_deferred'
    }

    if (!meetsMinimum || !meetsHostMix) {
      this.telemetry.queryDeferred += 1
      if (attempts + 1 <= QueryExpanderConstants.GENERAL_UNLOCK_ATTEMPTS) {
        await this.requeueQueryCandidate(candidate, attempts + 1)
      }
      return 'query_insufficient_results'
    }

    return 'query_no_results'
  }

  private async processCandidate(candidate: FrontierItem, countersBefore: SaveCounters): Promise<ProcessedCandidateResult> {
    // Record processed
    if (this.discoveryTelemetry) {
      this.discoveryTelemetry.recordProcessed()
    }
    const { patchId } = this.options
    const redisPatchId = this.redisPatchId
    const url = candidate.cursor
    const angle = candidate.meta?.angle as string | undefined
    const hostHint = this.resolveHost(candidate)

    try {
      if (!(await this.ensureLiveState('pre_candidate'))) {
        return { saved: false, reason: 'run_suspended', angle, host: hostHint }
      }

      if (typeof candidate.provider === 'string' && candidate.provider.startsWith('query:')) {
        const queryResult = await this.expandQueryCandidate(candidate)
        return { saved: false, reason: queryResult, angle, host: hostHint }
      }

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
      const cooldownResult = this.scheduler.recordCanonicalHit(canonicalUrl)
      if (cooldownResult === 'cooldown') {
        await addToFrontier(redisPatchId, {
          ...candidate,
          id: `cooldown:${Date.now()}:${Math.random()}`,
          priority: candidate.priority - 20
        })
        await this.emitAudit('cooldown', 'pending', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          meta: { reason: 'canonical_cooldown', cooldownMs: CANONICAL_COOLDOWN_MS }
        })
        return { saved: false, reason: 'canonical_cooldown', angle }
      }
      const host = finalDomain ? finalDomain.toLowerCase() : hostHint

      if (!(await this.ensureLiveState('post_canonical'))) {
        return { saved: false, reason: 'run_suspended', angle, host }
      }
      await this.emitAudit('canonicalize', 'ok', {
        candidateUrl: url,
        finalUrl: canonicalUrl,
        meta: { domain: finalDomain }
      })

      // For Wikipedia pages: extract outlinks BEFORE checking if seen
      // This ensures we mine Wikipedia as a launchpad for deep links
      const isWiki = this.isWikipediaUrl(canonicalUrl)
      if (isWiki && DEEP_LINK_SCRAPER) {
        // Fetch content first to extract outlinks
        const fetchResult = await this.fetchAndExtractContent({
          canonicalUrl,
          candidate,
          host
        }).catch(() => null)
        
        if (fetchResult?.extracted?.rawHtml) {
          const WIKI_OUTLINK_LIMIT = Number(process.env.CRAWL_WIKI_OUTLINK_LIMIT || 25)
          const refs = await extractOffHostLinks(fetchResult.extracted.rawHtml, canonicalUrl, { maxLinks: WIKI_OUTLINK_LIMIT })
          let enqueued = 0
          for (const ref of refs) {
            if (!passesDeepLinkFilters(ref.url, ref.sourceHost)) continue
            const item: FrontierItem = {
              id: `wiki_out:${Date.now()}:${Math.random()}`,
              provider: 'direct',
              cursor: ref.url,
              priority: (candidate.priority ?? 300) - 5 - enqueued,
              angle: candidate.angle ?? undefined,
              meta: {
                reason: 'wiki_outlink',
                parent: canonicalUrl,
                parentHost: host,
                hookId: candidate.meta?.hookId,
                viewpoint: (candidate.meta?.viewpoint as string | undefined) ?? (candidate.meta?.stance as string | undefined),
                angleCategory: (candidate.meta?.angleCategory as string | undefined) ?? candidate.meta?.angle,
                originatingProvider: candidate.provider,
                originatingReason: candidate.meta?.reason,
                seed_processed: true // Mark that we've processed this seed for outlinks
              }
            }
            await addToFrontier(this.redisPatchId, item)
            enqueued++
          }
          if (enqueued > 0) {
            this.structuredLog('wiki_outlinks_enqueued', { 
              source: canonicalUrl, 
              count: enqueued,
              limit: WIKI_OUTLINK_LIMIT
            })
          }
          // Now mark as seen AFTER extracting outlinks
          await markAsSeen(redisPatchId, canonicalUrl).catch(() => undefined)
          await this.emitAudit('wiki_processed', 'ok', { 
            candidateUrl: canonicalUrl,
            outlinks_enqueued: enqueued
          })
          await this.persistMetricsSnapshot('running', countersBefore)
          return { saved: false, reason: 'wiki_launchpad_processed', angle, host }
        }
      }

      // Fast skip check with timestamp + durable seen tracking
      const { isSeenWithTimestamp } = await import('@/lib/redis/discovery')
      const { isUrlSeen, markUrlSeen } = await import('./seenTracker')
      
      // Check durable seen table first (7-day window)
      const seenCheck = await isUrlSeen(this.options.patchId, canonicalUrl, this.options.runId)
      if (seenCheck.seen) {
        const { discoveryLogger } = await import('./structuredLogger')
        discoveryLogger.seenSkip(canonicalUrl, seenCheck.reason || 'seen', {
          patchId: this.options.patchId,
          runId: this.options.runId,
          lastSeen: seenCheck.lastSeen?.toISOString()
        })
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        if (this.discoveryTelemetry) {
          this.discoveryTelemetry.recordDuplicate()
        }
        logger.logDuplicate(canonicalUrl, 'A', candidate.provider)
        this.structuredLog('duplicate_seen_durable', {
          url: canonicalUrl,
          provider: candidate.provider,
          lastSeen: seenCheck.lastSeen
        })
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'seen_durable', lastSeen: seenCheck.lastSeen }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'seen_durable' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'seen_durable', angle, host }
      }
      
      // Also check Redis fast skip (24h)
      const redisSeenCheck = await isSeenWithTimestamp(redisPatchId, canonicalUrl, 24) // 24h fast skip
      
      if (redisSeenCheck.seen) {
        // Fast skip if crawled < 24h ago
        if (redisSeenCheck.canSkip) {
          // Track fast skips in first 10 candidates to ensure we don't waste time
          const isFirst10 = this.metrics.candidatesProcessed < 10
          if (isFirst10) {
            this.structuredLog('fast_skip_first10', {
              url: canonicalUrl,
              provider: candidate.provider,
              candidate_number: this.metrics.candidatesProcessed + 1,
              last_crawled_at: redisSeenCheck.lastCrawledAt,
              hours_ago: redisSeenCheck.lastCrawledAt ? Math.round((Date.now() - redisSeenCheck.lastCrawledAt) / (60 * 60 * 1000) * 10) / 10 : null
            })
          }
          
          this.structuredLog('fast_skip', {
            url: canonicalUrl,
            provider: candidate.provider,
            last_crawled_at: redisSeenCheck.lastCrawledAt,
            hours_ago: redisSeenCheck.lastCrawledAt ? Math.round((Date.now() - redisSeenCheck.lastCrawledAt) / (60 * 60 * 1000) * 10) / 10 : null
          })
          
          // Structured logging for fast skip
          try {
            const { slog } = await import('@/lib/log')
            const { pushEvent } = await import('./eventRing')
            const logObj = {
              step: 'discovery',
              msg: 'skip',
              job_id: this.options.patchId,
              run_id: this.options.runId,
              url: canonicalUrl?.slice(0, 200),
              reason: 'fast_skip_24h',
              last_crawled_at: redisSeenCheck.lastCrawledAt,
              candidate_number: this.metrics.candidatesProcessed + 1,
            }
            slog('info', logObj)
            pushEvent(logObj)
          } catch {
            // Non-fatal
          }
          
          await this.emitAudit('duplicate_check', 'fail', {
            candidateUrl: canonicalUrl,
            provider: candidate.provider,
            decisions: { action: 'drop', reason: 'fast_skip_24h', lastCrawledAt: redisSeenCheck.lastCrawledAt }
          })
          this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'fast_skip_24h' })
          await this.persistMetricsSnapshot('running', countersBefore)
          return { saved: false, reason: 'fast_skip_24h', angle, host }
        }
        
        // Regular duplicate (seen but > 24h ago, allow retry)
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        if (this.discoveryTelemetry) {
          this.discoveryTelemetry.recordDuplicate()
        }
        logger.logDuplicate(canonicalUrl, 'A', candidate.provider)
        this.structuredLog('duplicate_seen', {
          url: canonicalUrl,
          provider: candidate.provider,
          last_crawled_at: redisSeenCheck.lastCrawledAt
        })
        
        // Structured logging for skip
        try {
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            step: 'discovery',
            msg: 'skip',
            job_id: this.options.patchId,
            run_id: this.options.runId,
            url: canonicalUrl?.slice(0, 200),
            reason: 'redis_seen',
            last_crawled_at: redisSeenCheck.lastCrawledAt,
          }
          slog('info', logObj)
          pushEvent(logObj)
        } catch {
          // Non-fatal
        }
        
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'redis_seen', lastCrawledAt: redisSeenCheck.lastCrawledAt }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'redis_seen' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'redis_seen', angle, host }
      }

      if (!this.shadowMode) {
        const existing = await prisma.discoveredContent.findFirst({
          where: { patchId, canonicalUrl },
          select: { id: true }
        })
        if (existing) {
          await this.incrementMetric('duplicates')
          this.metricsTracker.recordDuplicate()
          if (this.discoveryTelemetry) {
            this.discoveryTelemetry.recordDuplicate()
          }
          logger.logDuplicate(canonicalUrl, 'A', candidate.provider)
          this.structuredLog('duplicate_database', {
            url: canonicalUrl,
            provider: candidate.provider,
            existingId: existing.id
          })
          await markAsSeen(this.redisPatchId, canonicalUrl).catch(() => undefined)
          await this.emitAudit('duplicate_check', 'fail', {
            candidateUrl: canonicalUrl,
            provider: candidate.provider,
            decisions: { action: 'drop', reason: 'db_duplicate', existingId: existing.id }
          })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'db_duplicate' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'db_duplicate', angle, host }
        }
      }

      await this.incrementMetric('urlsAttempted')
      this.eventStream.stage('searching', { provider: 'fetcher' })
      this.eventStream.searching('fetch')
      const fetchResult = await this.fetchAndExtractContent({
        canonicalUrl,
        candidate,
        host
      })
      
      // Handle case where all branches failed with extractor_empty
      if (!fetchResult) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'extractor_empty_all_branches')
        this.structuredLog('extract_fail', {
          url: canonicalUrl,
          reason: 'extractor_empty_all_branches',
          textLength: 0
        })
        await this.emitAudit('fetch', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          error: { message: 'extractor_empty_all_branches' }
        })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'extractor_empty_all_branches', angle, host }
      }
      
      const extracted = fetchResult.extracted
      const paywallBranch = fetchResult.branch
      const renderUsed = fetchResult.renderUsed
      
      // Record successful extraction
      if (extracted && this.discoveryTelemetry) {
        this.discoveryTelemetry.recordExtractOk()
      }
      if (paywallBranch && !paywallBranch.startsWith('canonical')) {
        this.structuredLog('paywall_branch_used', {
          branch: paywallBranch,
          url: fetchResult.finalUrl,
          canonical: canonicalUrl
        })
      }
      if (!(await this.ensureLiveState('post_fetch'))) {
        return { saved: false, reason: 'run_suspended', angle, host }
      }

      // Deep-link scraper: skip summary/wiki pages and enqueue ref_out links (pre-vet)
      if (DEEP_LINK_SCRAPER) {
        try {
          const urlObj = new URL(canonicalUrl)
          const isWiki = this.isWikipediaUrl(canonicalUrl)
          const pathDepthForSummary = urlObj.pathname.split('/').filter(Boolean).length
          const isSummary = isWiki || pathDepthForSummary < 2
          if (isSummary) {
            const html = extracted?.rawHtml || ''
            if (html && html.length > 0) {
              const refs = await extractOffHostLinks(html, canonicalUrl, { maxLinks: 20 })
              let enqueued = 0
              for (const ref of refs) {
                if (!passesDeepLinkFilters(ref.url, ref.sourceHost)) continue
                const item: FrontierItem = {
                  id: `ref_out:${Date.now()}:${Math.random()}`,
                  provider: 'direct',
                  cursor: ref.url,
                  priority: (candidate.priority ?? 300) - 10 - enqueued,
                  angle: candidate.angle ?? undefined,
                  meta: {
                    reason: 'ref_out',
                    parent: canonicalUrl,
                    parentHost: urlObj.hostname.toLowerCase(),
                    hookId: candidate.meta?.hookId,
                    viewpoint: (candidate.meta?.viewpoint as string | undefined) ?? (candidate.meta?.stance as string | undefined),
                    angleCategory: (candidate.meta?.angleCategory as string | undefined) ?? candidate.meta?.angle,
                    originatingProvider: candidate.provider,
                    originatingReason: candidate.meta?.reason
                  }
                }
                await addToFrontier(this.redisPatchId, item)
                enqueued++
              }
              if (enqueued > 0) {
                this.structuredLog('ref_out_enqueued', { source: canonicalUrl, count: enqueued, context: isWiki ? 'wikipedia' : 'summary' })
              }
            }
            await this.emitAudit('summary_skipped', 'ok', { candidateUrl: canonicalUrl })
            await this.persistMetricsSnapshot('running', countersBefore)
            return { saved: false, reason: 'summary_skipped', angle, host }
          }
        } catch {
          // ignore
        }
      }
      // Require min content length (400 chars for partial, 800 for full) OR presence of <article>/main nodes
      const textLength = extracted?.text ? extracted.text.length : 0
      const hasArticleOrMain = extracted?.rawHtml ? /<(article|main)[\s>]/i.test(extracted.rawHtml) : false
      const structuredOverride = candidate.meta?.hasStructuredStats === true || hasArticleOrMain
      const MIN_CHARS_FULL = 800
      const MIN_CHARS_PARTIAL = 400 // Phase 3: treat < 400 as partial, not failure
      const isPartial = textLength >= MIN_CHARS_PARTIAL && textLength < MIN_CHARS_FULL && !structuredOverride
      
      if (!extracted || textLength < MIN_CHARS_PARTIAL) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'content_too_short')
        this.structuredLog('extract_fail', {
          url: canonicalUrl,
          reason: textLength < MIN_CHARS_PARTIAL ? 'min_content_length' : 'no_article_main',
          textLength,
          hasArticleOrMain
        })
        // Pre-harvest: if we have HTML but content is short (directory/listing),
        // extract outgoing links and enqueue them before dropping.
        try {
          if (extracted?.rawHtml) {
            if (this.isWikipediaUrl(canonicalUrl)) {
              await this.enqueueWikipediaReferences(extracted.rawHtml, canonicalUrl, candidate)
            }
            // Extract and count links for logging
            let linksCount = 0
            try {
              const { offHost, sameHost } = extractOutgoingLinks(extracted.rawHtml, canonicalUrl, 40)
              linksCount = (offHost?.length || 0) + (sameHost?.length || 0)
            } catch {
              // Non-fatal if link extraction fails
            }
            
            await this.enqueueHtmlOutgoingReferences(extracted.rawHtml, canonicalUrl, candidate)
            
            // Log extract event (links extracted)
            try {
              const { slog } = await import('@/lib/log')
              const { pushEvent } = await import('./eventRing')
              const logObj = {
                step: 'discovery',
                msg: 'extract',
                job_id: this.options.patchId,
                run_id: this.options.runId,
                url: canonicalUrl?.slice(0, 200),
                links: linksCount,
              }
              slog('info', logObj)
              pushEvent(logObj)
            } catch {
              // Non-fatal
            }
          }
        } catch {
          // ignore harvesting errors
        }
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
        return { saved: false, reason: 'content_short', angle, host }
      }

      const signature = this.computeSignature(canonicalUrl, extracted)
      if (this.runSignatures.has(signature)) {
        await this.incrementMetric('duplicates')
        this.metricsTracker.recordDuplicate()
        logger.logDuplicate(canonicalUrl, 'C', candidate.provider)
        this.structuredLog('duplicate_signature', {
          url: canonicalUrl,
          provider: candidate.provider
        })
        await this.emitAudit('duplicate_check', 'fail', {
          candidateUrl: canonicalUrl,
          provider: candidate.provider,
          decisions: { action: 'drop', reason: 'signature_duplicate' }
        })
        this.eventStream.skipped('duplicate', canonicalUrl, { reason: 'signature_duplicate' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'signature_duplicate', angle, host }
      }
      this.runSignatures.add(signature)

      if (this.isWikipediaUrl(canonicalUrl)) {
        await this.enqueueWikipediaReferences(extracted.rawHtml, canonicalUrl, candidate)
      }

      await this.enqueueHtmlOutgoingReferences(extracted.rawHtml, canonicalUrl, candidate)

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
        return { saved: false, reason: 'entity_missing', angle, host }
      }

      const simhash = SimHash.generate(extracted.text)
      const hashString = simhash.toString()
      if (await isNearDuplicate(redisPatchId, hashString, DUPLICATE_HASH_THRESHOLD)) {
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
        return { saved: false, reason: 'near_duplicate', angle, host }
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
        return { saved: false, reason: parseReason, angle, host }
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
        return { saved: false, reason: 'vetter_rejected', angle, host }
      }

      this.telemetry.vetterJsonOk++

      const factsWithCitations = Array.isArray(synthesis.facts)
        ? synthesis.facts.filter((fact) => fact && typeof fact.citation === 'string' && fact.citation.length > 0).length
        : 0

      const isFirstCard = countersBefore.total === 0
      const softEligible = isFirstCard && synthesis.qualityScore >= 70 && factsWithCitations >= 2
      const minRelevance = softEligible ? 0.7 : MIN_RELEVANCE_SCORE
      const minQuality = softEligible ? 70 : MIN_QUALITY_SCORE
      const importanceScore = synthesis.importanceScore ?? 50 // Default to medium if not provided

      // Check importance score - reject low-importance content (game recaps, routine news)
      if (importanceScore < MIN_IMPORTANCE_SCORE) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        logger.logSkip(canonicalUrl, 'low_importance')
        this.structuredLog('low_importance', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          importanceScore,
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore
        })
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: { ...synthesis, importanceScore },
          decisions: { action: 'drop', reason: 'low_importance' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { 
          reason: 'low_importance',
          importanceScore 
        })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'low_importance', angle, host }
      }

      if (synthesis.relevanceScore < minRelevance || synthesis.qualityScore < minQuality) {
        await this.incrementMetric('dropped')
        this.metricsTracker.recordError()
        if (this.discoveryTelemetry) {
          this.discoveryTelemetry.recordRelevanceFail()
        }
        logger.logSkip(canonicalUrl, 'score_threshold')
        this.structuredLog('score_threshold', {
          url: canonicalUrl,
          provider: candidate.provider,
          angle,
          relevanceScore: synthesis.relevanceScore,
          qualityScore: synthesis.qualityScore,
          importanceScore: importanceScore
        })
        await this.emitAudit('synthesis', 'fail', {
          candidateUrl: canonicalUrl,
          meta: synthesis,
          decisions: { action: 'drop', reason: 'score_threshold' }
        })
        this.eventStream.skipped('low_relevance', canonicalUrl, { reason: 'score_threshold' })
        await this.persistMetricsSnapshot('running', countersBefore)
        return { saved: false, reason: 'score_threshold', angle, host }
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

      const viewpointRaw = (candidate.meta?.viewpoint as string | undefined) ?? (candidate.meta?.stance as string | undefined) ?? null
      const heroKey = this.resolveHeroKey(candidate)
      const heroEntry: HeroGateEntry = {
        domain: finalDomain ?? hostHint ?? null,
        viewpointClass: this.classifyViewpoint(viewpointRaw),
        rawViewpoint: viewpointRaw,
        isSfw: synthesis.isSfw !== false,
        publishDate: synthesis.publishDate ?? (candidate.meta?.publishDate as string | undefined) ?? null,
        savedAt: Date.now()
      }
      const heroEligibility = this.evaluateHeroEligibility(heroKey, heroEntry)
      const heroScore = this.computeHeroScore({
        isControversy: candidate.meta?.isControversy === true,
        publishDate: heroEntry.publishDate,
        credibilityTier: candidate.meta?.credibilityTier as number | undefined,
        noveltySignals: candidate.meta?.noveltySignals,
        host: heroEntry.domain,
        viewpointClass: heroEntry.viewpointClass,
        viewpointEligible: heroEligibility.eligible
      })
      this.lastHeroGateEvaluation = { ...heroEligibility, score: heroScore }

      let hero: DiscoveryHero | null = null
      if (heroEligibility.eligible) {
        this.eventStream.stage('hero', {
          url: canonicalUrl,
          supportDomain: heroEligibility.supportDomain,
          counterDomain: heroEligibility.counterDomain
        })
        this.eventStream.searching('hero')
        hero = await this.heroPipeline.assignHero({
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
      } else {
        this.eventStream.stage('hero', { url: canonicalUrl, eligible: false })
      }

      // Don't mark as seen yet - only after successful save
      await markContentHash(this.redisPatchId, hashString).catch(() => undefined)

      // Content-level near-duplicate using SimHash (Hamming ≤ 7)
      try {
        const contentForHash = (extracted?.text || '').slice(0, 5000)
        if (contentForHash.length > 0) {
          const hash = SimHash.generate(contentForHash)
          for (const existing of this.simhashes) {
            const d = SimHash.hammingDistance(hash, existing)
            if (d <= 7) {
              await this.incrementMetric('duplicates')
              this.metricsTracker.recordDuplicate()
              this.structuredLog('duplicate_simhash', {
                url: canonicalUrl,
                provider: candidate.provider,
                hamming: d
              })
              await this.emitAudit('duplicate_check', 'fail', {
                candidateUrl: canonicalUrl,
                provider: candidate.provider,
                decisions: { action: 'drop', reason: 'near_duplicate', hamming: d }
              })
              await this.persistMetricsSnapshot('running', countersBefore)
              return { saved: false, reason: 'near_duplicate', angle, host }
            }
          }
          this.simhashes.push(hash)
          if (this.simhashes.length > 2000) this.simhashes.shift()
        }
      } catch {
        // best-effort; ignore errors
      }

      const viewSourceOk = await checkViewSource(canonicalUrl)

      const isControversy = candidate.meta?.isControversy === true
      const isHistory = candidate.meta?.isHistory === true

      // Extract domain with fallback chain: finalDomain -> canonicalUrl -> null
      const domain = finalDomain 
        ? getDomainFromUrl(finalDomain) 
        : getDomainFromUrl(canonicalUrl) ?? null

      let savedId: string
      let savedCreatedAt: Date
      if (this.shadowMode) {
        savedId = `shadow:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
        savedCreatedAt = new Date()
      } else {
        try {
          const t = Date.now()
          
          // DB-first duplicate check (before create)
          const existing = await prisma.discoveredContent.findUnique({
            where: {
              patchId_canonicalUrl: {
                patchId,
                canonicalUrl
              }
            },
            select: { id: true, contentHash: true, textContent: true }
          })
          
          if (existing) {
            // Update existing record if contentHash changed (recrawl)
            const cleanedText = (extracted.text || '').trim()
            const newContentHash = createHash('sha256').update(cleanedText).digest('hex')
            
            if (existing.contentHash === newContentHash) {
              // Content unchanged, skip
              savedId = existing.id
              savedCreatedAt = new Date()
              return { saved: true, reason: 'duplicate', angle, host }
            }
            
            // Content changed, will update below
          }
          
          // Extract fair-use quote and paraphrase summary
          const { extractFairUseQuote } = await import('./fairUse')
          const { summarizeParaphrase } = await import('./paraphrase')
          
          const fairUseQuote = extractFairUseQuote(extracted.rawHtml || '', extracted.text || '')
          const paraphraseResult = await summarizeParaphrase(extracted.text || '', extracted.title)
          
          // Fair-use quote stored in metadata (not in quotes array which expects VetterQuote format)
          // VetterQuote format: { text: string, speaker?: string, citation: string }
          // Fair-use quote has different structure, so we keep it separate in metadata
          const enhancedQuotes = synthesis.quotes || []
          
          // Enhance summary with paraphrase points
          const summaryWithParaphrase = paraphraseResult.summaryPoints.length > 0
            ? `${synthesis.whyItMatters}\n\nKey points:\n${paraphraseResult.summaryPoints.map(p => `• ${p}`).join('\n')}`
            : synthesis.whyItMatters
          
          // Capture fetch metadata for storage
          const htmlBytes = extracted.rawHtml ? Buffer.from(extracted.rawHtml).length : 0
          const textBytes = extracted.text?.length || 0
          const hasArticleOrMain = extracted.rawHtml ? /<(article|main)[\s>]/i.test(extracted.rawHtml) : false
          const isPartialContent = textBytes >= 400 && textBytes < 800 && !hasArticleOrMain
          
          // Compute contentHash = sha256(cleanedText)
          const cleanedText = (extracted.text || '').trim()
          const contentHash = createHash('sha256').update(cleanedText).digest('hex')
          
          // Get canonicalHost and canonicalPathHash from canonicalization result
          const canonicalResult = await canonicalize(canonicalUrl).catch(() => null)
          const canonicalHost = canonicalResult?.canonicalHost || domain || null
          const canonicalPathHash = canonicalResult?.canonicalPathHash || ''
          
          // MIN_TEXT_BYTES_FOR_HERO threshold (default 600, configurable)
          const MIN_TEXT_BYTES_FOR_HERO = Number(process.env.MIN_TEXT_BYTES_FOR_HERO || '600')
          const shouldCreateHero = textBytes >= MIN_TEXT_BYTES_FOR_HERO
          
          // Save → Hero transaction
          const savedItem = await prisma.$transaction(async (tx) => {
            // Upsert discovered content
            const content = existing
              ? await tx.discoveredContent.update({
                  where: { id: existing.id },
                  data: {
                    title: extracted.title,
                    sourceUrl: canonicalUrl,
                    domain,
                    sourceDomain: canonicalHost,
                    publishDate: candidate.meta?.publishDate ?? null,
                    category: (candidate.meta?.category as string | undefined) || null,
                    isControversy,
                    isHistory,
                    relevanceScore: synthesis.relevanceScore,
                    qualityScore: synthesis.qualityScore,
                    importanceScore: importanceScore, // Now stored in database column
                    whyItMatters: synthesis.whyItMatters,
                    summary: summaryWithParaphrase,
                    facts: synthesis.facts as unknown as Prisma.JsonArray,
                    quotes: enhancedQuotes as unknown as Prisma.JsonArray,
                    provenance: synthesis.provenance as unknown as Prisma.JsonArray,
                    hero: hero ? ({ url: hero.url, source: hero.source } as Prisma.JsonObject) : Prisma.JsonNull,
                    contentHash,
                    rawHtml: extracted.rawHtml ? Buffer.from(extracted.rawHtml) : null,
                    textContent: cleanedText,
                    lastCrawledAt: new Date(),
                    metadata: {
                      fairUseQuote: fairUseQuote ? {
                        quoteHtml: fairUseQuote.quoteHtml,
                        quoteWordCount: fairUseQuote.quoteWordCount,
                        quoteStartChar: fairUseQuote.quoteStartChar,
                        quoteEndChar: fairUseQuote.quoteEndChar
                      } : null,
                      summaryPoints: paraphraseResult.summaryPoints,
                      summaryWordCount: paraphraseResult.wordCount,
                      renderUsed: renderUsed,
                      render_ok: renderUsed,
                      fetch_metadata: {
                        render_used: renderUsed,
                        branch_used: paywallBranch || 'direct',
                        status_code: null,
                        html_bytes: htmlBytes,
                        text_bytes: textBytes,
                        failure_reason: null
                      } as Prisma.JsonObject,
                      contentStatus: isPartialContent ? 'partial' : 'full',
                      canonicalHost,
                      canonicalPathHash
                      // importanceScore is now stored in database column, not metadata
                    } as Prisma.JsonObject
                  }
                })
              : await tx.discoveredContent.create({
                  data: {
                    patchId,
                    canonicalUrl,
                    title: extracted.title,
                    sourceUrl: canonicalUrl,
                    domain,
                    sourceDomain: canonicalHost,
                    publishDate: candidate.meta?.publishDate ?? null,
                    category: (candidate.meta?.category as string | undefined) || null,
                    isControversy,
                    isHistory,
                    relevanceScore: synthesis.relevanceScore,
                    qualityScore: synthesis.qualityScore,
                    importanceScore: importanceScore, // Now stored in database column
                    whyItMatters: synthesis.whyItMatters,
                    summary: summaryWithParaphrase,
                    facts: synthesis.facts as unknown as Prisma.JsonArray,
                    quotes: enhancedQuotes as unknown as Prisma.JsonArray,
                    provenance: synthesis.provenance as unknown as Prisma.JsonArray,
                    hero: hero ? ({ url: hero.url, source: hero.source } as Prisma.JsonObject) : Prisma.JsonNull,
                    contentHash,
                    rawHtml: extracted.rawHtml ? Buffer.from(extracted.rawHtml) : null,
                    textContent: cleanedText,
                    lastCrawledAt: new Date(),
                    metadata: {
                      fairUseQuote: fairUseQuote ? {
                        quoteHtml: fairUseQuote.quoteHtml,
                        quoteWordCount: fairUseQuote.quoteWordCount,
                        quoteStartChar: fairUseQuote.quoteStartChar,
                        quoteEndChar: fairUseQuote.quoteEndChar
                      } : null,
                      summaryPoints: paraphraseResult.summaryPoints,
                      summaryWordCount: paraphraseResult.wordCount,
                      renderUsed: renderUsed,
                      render_ok: renderUsed,
                      fetch_metadata: {
                        render_used: renderUsed,
                        branch_used: paywallBranch || 'direct',
                        status_code: null,
                        html_bytes: htmlBytes,
                        text_bytes: textBytes,
                        failure_reason: null
                      } as Prisma.JsonObject,
                      contentStatus: isPartialContent ? 'partial' : 'full',
                      canonicalHost,
                      canonicalPathHash
                      // importanceScore is now stored in database column, not metadata
                    } as Prisma.JsonObject
                  }
                })
            
            // Create hero if threshold met (transactional)
            if (shouldCreateHero) {
              try {
                const { upsertHero } = await import('./heroUpsert')
                await upsertHero({
                  patchId: this.options.patchId,
                  contentId: content.id,
                  url: canonicalUrl,
                  canonicalUrl,
                  title: extracted.title,
                  summary: synthesis.whyItMatters,
                  sourceDomain: canonicalHost ?? undefined,
                  extractedText: cleanedText,
                  traceId: this.options.runId
                })
                
                // Log success
                console.log(`[EngineV21] saved:true hero:true status:SAVED textBytes:${textBytes} contentId:${content.id}`)
              } catch (heroError: any) {
                // Log hero failure but don't fail transaction
                console.warn(`[EngineV21] saved:true hero:false status:ERROR textBytes:${textBytes} error:${heroError.message}`)
              }
            } else {
              console.log(`[EngineV21] saved:true hero:false status:SAVED textBytes:${textBytes} (below threshold ${MIN_TEXT_BYTES_FOR_HERO})`)
            }
            
            return content
          })
          
          savedId = savedItem.id
          savedCreatedAt = savedItem.createdAt
          
          // Record telemetry
          if (this.discoveryTelemetry) {
            this.discoveryTelemetry.recordPersistOk()
          }
          
          // Structured logging
          const { discoveryLogger } = await import('./structuredLogger')
          discoveryLogger.save(true, savedItem.id, canonicalUrl, candidate.meta?.publishDate?.toString() || null)
          
          // Structured logging for successful save (persist)
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            step: 'discovery',
            msg: 'persist',
            job_id: this.options.patchId,
            run_id: this.options.runId,
            url: canonicalUrl?.slice(0, 200),
            id: savedId,
            duration_ms: Date.now() - t,
          }
          slog('info', logObj)
          pushEvent(logObj)
        } catch (error: any) {
          const t = Date.now()
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const { discoveryLogger } = await import('./structuredLogger')
          
          // Prisma P2002 unique constraint -> duplicate
          if (error?.code === 'P2002') {
            const logObj = {
              step: 'save',
              result: 'skip',
              err_code: 'E_DUP',
              job_id: this.options.patchId,
              run_id: this.options.runId,
              duration_ms: Date.now() - t,
              candidate_url: canonicalUrl?.slice(0, 200),
            }
            slog('warn', logObj)
            pushEvent(logObj)
            discoveryLogger.save(true, undefined, canonicalUrl, candidate.meta?.publishDate?.toString(), 'E_DUP')
            // Treat duplicate as success (skip)
            savedId = `dup:${canonicalUrl}`
            savedCreatedAt = new Date()
            return { saved: true, reason: 'duplicate' }
          }
          
          // Prisma P2022 column mismatch - log schema diff
          if (error?.code === 'P2022') {
            // Use fallback values since these variables may not be in scope if error occurred before they were defined
            const payloadKeys = Object.keys({
              patchId,
              canonicalUrl,
              title: extracted.title,
              sourceUrl: canonicalUrl,
              domain,
              publishDate: candidate.meta?.publishDate ?? null,
              category: (candidate.meta?.category as string | undefined) || null,
              isControversy,
              isHistory,
              relevanceScore: synthesis.relevanceScore,
              qualityScore: synthesis.qualityScore,
              whyItMatters: synthesis.whyItMatters,
              summary: synthesis.whyItMatters, // Fallback to whyItMatters if summaryWithParaphrase not available
              facts: synthesis.facts,
              quotes: synthesis.quotes || [], // Fallback to synthesis.quotes if enhancedQuotes not available
              provenance: synthesis.provenance,
              hero: hero,
              contentHash: hashString,
              metadata: {} // Simplified metadata for logging
            })
            
            console.error('[Discovery Engine] P2022 Schema mismatch:', {
              error: error.message,
              code: error.code,
              payloadKeys,
              patchId,
              canonicalUrl,
              domain,
              title: extracted.title
            })
            
            discoveryLogger.save(false, undefined, canonicalUrl, candidate.meta?.publishDate?.toString(), 'P2022', error.message)
            
            // Don't crash - continue to next item
            return { saved: false, reason: 'schema_mismatch' }
          }
          
          // Other errors
          const logObj = {
            step: 'save',
            result: 'error',
            err_code: error?.code || 'E_DB',
            job_id: this.options.patchId,
            run_id: this.options.runId,
            duration_ms: Date.now() - t,
            candidate_url: canonicalUrl?.slice(0, 200),
            message: error.message?.slice(0, 200),
          }
          slog('error', logObj)
          pushEvent(logObj)
          discoveryLogger.save(false, undefined, canonicalUrl, candidate.meta?.publishDate?.toString(), error?.code || 'E_DB', error.message)
          
          // Log the error with full context but don't crash the loop
          console.error('[Discovery Engine] Failed to save discovered content:', {
            error: error.message,
            code: error.code,
            patchId,
            canonicalUrl,
            domain,
            title: extracted.title,
            payload: {
              patchId,
              canonicalUrl,
              domain,
              title: extracted.title,
              sourceUrl: canonicalUrl,
              publishDate: candidate.meta?.publishDate ?? null,
              category: (candidate.meta?.category as string | undefined) || null
            }
          })
          
          // Don't re-throw - continue to next item
          return { saved: false, reason: 'save_failed' }
        }
      }

      await incrementSaveCounters(this.redisPatchId, {
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
        id: savedId,
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
        contestedClaim: this.resolveContestedClaim(synthesis.contested),
        hero: hero ? { url: hero.url, source: hero.source } : null,
        heroScore,
        relevanceScore: synthesis.relevanceScore,
        qualityScore: synthesis.qualityScore,
        importanceScore: importanceScore,
        viewSourceOk,
        isControversy,
        isHistory,
        savedAt: savedCreatedAt.toISOString()
      }

      this.acceptanceCards.push({
        id: savedId,
        canonicalUrl,
        angle,
        viewSourceOk,
        contested: Boolean(synthesis.contested)
      })

      await this.emitAudit('save', 'ok', {
        candidateUrl: canonicalUrl,
        meta: {
          id: savedId,
          whyItMatters: synthesis.whyItMatters,
          angle,
          heroSource: hero?.source,
          contested: synthesis.contested,
          contestedClaim: this.resolveContestedClaim(synthesis.contested)
        }
      })

      const countersAfter = await getSaveCounters(this.redisPatchId)
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
      this.eventStream.stage('saved', { id: savedId })
      await this.persistMetricsSnapshot('running', countersAfter, {
        lastSavedId: savedId,
        lastSavedUrl: canonicalUrl
      })
      if (angle) {
        await markAngleCovered(this.options.runId, angle).catch(() => undefined)
      }
      
      // Mark URL as seen in durable tracking (markUrlSeen already imported above)
      const { markUrlSeen: markSeen } = await import('./seenTracker')
      await markSeen(this.options.patchId, canonicalUrl, this.options.runId, domain || undefined).catch(() => undefined)
      
      // Mark in Redis seen cache AFTER successful save (for fast 24h dedupe)
      await markAsSeen(this.redisPatchId, canonicalUrl).catch(() => undefined)
      
      this.storeHeroEntry(heroKey, heroEntry)
      return { saved: true, angle, host, paywallBranch }
    } catch (error) {
      if (error instanceof RobotsBlockedError) {
        const diagnostics = {
          userAgent: error.meta.userAgent,
          rule: error.meta.rule,
          status: error.meta.status,
          url: error.meta.url
        }
        this.structuredLog('robots_blocked', {
          provider: candidate.provider,
          ...diagnostics
        })
        
        // Structured logging for skip (robots)
        try {
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            step: 'discovery',
            msg: 'skip',
            job_id: this.options.patchId,
            run_id: this.options.runId,
            url: error.meta.url?.slice(0, 200),
            reason: 'robots_blocked',
          }
          slog('info', logObj)
          pushEvent(logObj)
        } catch {
          // Non-fatal
        }
        
        await this.emitAudit('robots', 'fail', {
          candidateUrl: candidate.cursor,
          provider: candidate.provider,
          meta: diagnostics
        })
        await this.persistMetricsSnapshot('running', this.lastCounters, {
          lastError: diagnostics
        })
        return { saved: false, reason: 'robots_blocked', angle, host: hostHint }
      }

      if (error instanceof PaywallBlockedError) {
        if (this.discoveryTelemetry) {
          this.discoveryTelemetry.recordPaywallBlocked()
        }
        // Get domain for paywall logging
        let domain = 'unknown'
        try {
          if (candidate.cursor) {
            domain = new URL(candidate.cursor).hostname
          }
        } catch {}
        
        const { discoveryLogger } = await import('./structuredLogger')
        discoveryLogger.paywall(candidate.cursor || '', domain, '403', {
          patchId: this.options.patchId,
          runId: this.options.runId,
          provider: candidate.provider
        })
        
        this.structuredLog('paywall_blocked', {
          url: candidate.cursor,
          provider: candidate.provider,
          domain
        })
        
        // Structured logging for skip (paywall)
        try {
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            step: 'discovery',
            msg: 'skip',
            job_id: this.options.patchId,
            run_id: this.options.runId,
            url: candidate.cursor?.slice(0, 200),
            reason: 'paywall_blocked',
            domain
          }
          slog('info', logObj)
          pushEvent(logObj)
        } catch {
          // Non-fatal
        }
        
        await this.emitAudit('fetch', 'fail', {
          candidateUrl: candidate.cursor,
          provider: candidate.provider,
          error: { message: 'paywall_blocked' }
        })
        await this.persistMetricsSnapshot('running', this.lastCounters, {
          lastError: { message: 'paywall_blocked' }
        })
        return { saved: false, reason: 'paywall_blocked', angle, host: hostHint }
      }

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
      return { saved: false, reason: 'error', angle, host: hostHint }
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

  private async fetchAndExtractContent(args: {
    canonicalUrl: string
    candidate: FrontierItem
    host: string | null
  }): Promise<{ extracted: ExtractedContent; branch: string; finalUrl: string; renderUsed: boolean } | null> {
    const { canonicalUrl, candidate } = args
    const plan = buildPaywallPlan({
      canonicalUrl,
      meta: candidate.meta
    })

    let lastError: unknown = null

    for (const branch of plan) {
      this.structuredLog('paywall_branch_attempt', {
        branch: branch.branch,
        url: branch.url,
        canonical: canonicalUrl
      })
      await pushPaywallBranch(this.redisPatchId, `attempt:${branch.branch}`).catch(() => undefined)

      // Declare variables outside try block so they're available in catch
      let html: string | null = null
      let extracted: ExtractedContent | null = null
      const fetchStartTime = Date.now() // Declare at start of loop for use in error handling
      let renderUsed = false // Declare at start of loop for use in logging
      
      try {
        const response = await this.fetchWithRetry(
          branch.url,
          {
            headers: {
              'User-Agent': FETCH_USER_AGENT
            }
          },
          1,
          FETCH_TIMEOUT_MS
        )

        if (!response.ok) {
          const statusKind = this.detectPaywallStatus(response)
          // Classify 403/401 as PAYWALL_OR_BLOCK
          if (statusKind === 'paywall' || response.status === 403 || response.status === 401) {
            this.telemetry.paywall++
            const domain = this.getHostFromUrl(branch.url) || 'unknown'
            const { discoveryLogger } = await import('./structuredLogger')
            discoveryLogger.paywall(branch.url, domain, `http_${response.status}`, {
              patchId: this.options.patchId,
              runId: this.options.runId,
              branch: branch.branch
            })
            discoveryLogger.fetch(false, branch.url, 0, Date.now() - fetchStartTime, 'direct', {
              patchId: this.options.patchId,
              runId: this.options.runId,
              httpStatus: response.status,
              errorCode: 'PAYWALL_OR_BLOCK',
              fetch_class: 'PAYWALL_OR_BLOCK'
            })
            lastError = new PaywallBlockedError(`status:${response.status}`)
            await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
            continue
          }
          if (statusKind === 'robots') {
            this.telemetry.robotsBlock++
            const rule = response.headers.get('x-robots-tag')
            throw new RobotsBlockedError('robots_blocked', {
              userAgent: FETCH_USER_AGENT,
              rule,
              status: response.status,
              url: branch.url
            })
          }
          throw new Error(`fetch_failed_${response.status}`)
        }

        this.telemetry.directFetchOk++
        html = await response.text()
        const fetchDuration = Date.now() - fetchStartTime
        
        // Structured logging for fetch
        const { discoveryLogger } = await import('./structuredLogger')
        discoveryLogger.fetch(true, branch.url, html.length, fetchDuration, renderUsed ? 'playwright' : 'direct', {
          patchId: this.options.patchId,
          runId: this.options.runId,
          httpStatus: response.status,
          branch: branch.branch
        })
        
        if (this.isPaywallHtml(html)) {
          this.telemetry.paywall++
          const domain = this.getHostFromUrl(branch.url) || 'unknown'
          discoveryLogger.paywall(branch.url, domain, 'html_detected', {
            patchId: this.options.patchId,
            runId: this.options.runId
          })
          lastError = new PaywallBlockedError('paywall_html')
          await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
          continue
        }
        
        // Try initial extraction
        const extractStartTime = Date.now()
        extracted = this.extractHtmlContent(html)
        const extractDuration = Date.now() - extractStartTime
        const textLength = extracted.text.length
        const paraCount = extracted.text.split(/\n\n/).filter(p => p.trim().length > 0).length
        
        // Structured logging for extract
        discoveryLogger.extract(true, branch.url, textLength, paraCount, {
          patchId: this.options.patchId,
          runId: this.options.runId,
          extractDuration,
          title: extracted.title?.substring(0, 100)
        })
        const initialTextLength = extracted.text.length
        
        // Check if JS rendering is needed
        const domain = this.getHostFromUrl(branch.url)
        // Dynamic import with error handling for optional Playwright
        let isJsDomain: ((domain: string | null) => boolean) | null = null
        let needsJsRendering: ((html: string, textLength: number) => boolean) | null = null
        let renderWithPlaywright: ((url: string) => Promise<any>) | null = null
        
        try {
          const rendererModule = await import('./renderer')
          isJsDomain = rendererModule.isJsDomain
          needsJsRendering = rendererModule.needsJsRendering
          renderWithPlaywright = rendererModule.renderWithPlaywright
        } catch {
          // Playwright not available, skip rendering
        }
        
        if (isJsDomain && needsJsRendering && renderWithPlaywright && 
            (isJsDomain(domain) || needsJsRendering(html, initialTextLength)) && initialTextLength < 600) {
          // Try Playwright renderer
          this.structuredLog('render_attempt', {
            url: branch.url,
            domain,
            initial_text_len: initialTextLength,
            html_bytes: html.length
          })
          
          const renderResult = await renderWithPlaywright(branch.url)
          renderUsed = true
          
          if (renderResult.success && renderResult.html) {
            // Use rendered HTML even if text extraction was minimal
            html = renderResult.html
            if (html) {
              extracted = this.extractHtmlContent(html)
              // Override title if renderer found a better one
              if (renderResult.title && renderResult.title !== 'Untitled') {
                extracted.title = renderResult.title
              }
              // Use rendered text if it's longer OR if initial was empty
              if (renderResult.text.length > extracted.text.length || initialTextLength === 0) {
                extracted.text = renderResult.text
              }
            }
            
            // Check if we got meaningful content
            const finalTextLength = extracted?.text.length || 0
            if (finalTextLength > 100 || (initialTextLength === 0 && finalTextLength > 50)) {
              this.telemetry.htmlExtracted++
              this.structuredLog('render_success', {
                url: branch.url,
                text_len: finalTextLength,
                title: extracted.title.slice(0, 100),
                improvement: finalTextLength - initialTextLength
              })
            } else {
              // Renderer ran but didn't extract meaningful content
              this.structuredLog('render_failed', {
                url: branch.url,
                error: renderResult.error || 'no_content_extracted',
                initial_len: initialTextLength,
                rendered_len: renderResult.text.length,
                html_len: html?.length || 0
              })
              
              // If still empty after rendering, mark as extractor_empty
              if (extracted && extracted.text.length < 100) {
                throw new Error('extractor_empty')
              }
            }
          } else {
            // Renderer failed or didn't improve - use original extraction
            this.structuredLog('render_failed', {
              url: branch.url,
              error: renderResult.error || 'no_improvement',
              initial_len: initialTextLength,
              rendered_len: renderResult.text.length || 0
            })
            
            // If still empty, mark as extractor_empty
            if (extracted && extracted.text.length < 100) {
              throw new Error('extractor_empty')
            }
          }
        }
        
        // Ensure extracted is not null before proceeding
        if (!extracted) {
          throw new Error('extractor_empty')
        }
        
        this.telemetry.htmlExtracted++
        await pushPaywallBranch(this.redisPatchId, `success:${branch.branch}`).catch(() => undefined)
        
        // Additional structured logging (fetch/extract already logged above)
        try {
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            run_id: this.options.runId,
            step: 'fetch',
            url: branch.url?.slice(0, 200),
            source: candidate.provider,
            status: 'ok',
            http_status: response.status,
            paywall: false,
            robots: 'allowed',
            render_used: renderUsed,
            html_bytes: html ? html.length : 0,
            text_bytes: extracted.text ? extracted.text.length : 0,
            failure_reason: null
          }
          slog('info', logObj)
          pushEvent(logObj)
        } catch {
          // Non-fatal
        }
        
        return {
          extracted: { ...extracted, rawHtml: html || '' },
          branch: branch.branch,
          finalUrl: response.url ?? branch.url,
          renderUsed
        }
      } catch (error) {
        const errorStartTime = Date.now()
        let failureReason = 'unknown_error'
        let httpStatus: number | null = null
        let paywall = false
        let robots = 'allowed'
        let renderUsed = false
        
        if ((error as Error)?.name === 'AbortError') {
          this.telemetry.timeout++
          failureReason = 'render_timeout'
        }
        if (error instanceof PaywallBlockedError) {
          lastError = error
          paywall = true
          failureReason = 'paywall_blocked'
          await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
          continue
        }
        if (error instanceof RobotsBlockedError) {
          robots = 'disallow'
          failureReason = 'robots_disallow'
          await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
          throw error
        }
        // Handle extractor_empty error
        if (error instanceof Error && error.message === 'extractor_empty') {
          failureReason = 'extractor_empty'
          this.structuredLog('extractor_empty', {
            url: branch.url,
            domain: this.getHostFromUrl(branch.url),
            html_bytes: html ? html.length : 0
          })
          lastError = new Error('extractor_empty')
          await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
          continue
        }
        if (error instanceof Error && error.message.startsWith('fetch_failed_')) {
          httpStatus = parseInt(error.message.replace('fetch_failed_', '')) || null
          failureReason = 'http_error'
        }
        
        // Structured logging for every URL failure
        try {
          const { slog } = await import('@/lib/log')
          const { pushEvent } = await import('./eventRing')
          const logObj = {
            run_id: this.options.runId,
            step: 'fetch',
            url: branch.url?.slice(0, 200),
            source: candidate.provider,
            status: 'fail',
            http_status: httpStatus,
            paywall,
            robots,
            render_used: renderUsed,
            html_bytes: html ? html.length : 0,
            text_bytes: extracted?.text ? extracted.text.length : 0,
            failure_reason: failureReason,
            duration_ms: Date.now() - errorStartTime
          }
          slog('warn', logObj)
          pushEvent(logObj)
        } catch {
          // Non-fatal
        }
        
        lastError = error
        await pushPaywallBranch(this.redisPatchId, `fail:${branch.branch}`).catch(() => undefined)
      }
    }

    console.error('[EngineV21] Exhausted paywall branches', lastError)
    
    // If all branches failed with extractor_empty, return null instead of throwing
    // This allows the candidate to be skipped gracefully instead of causing a fatal error
    if (lastError instanceof Error && lastError.message === 'extractor_empty') {
      this.structuredLog('all_branches_extractor_empty', {
        url: candidate.cursor,
        domain: this.getHostFromUrl(candidate.cursor)
      })
      return null
    }
    
    throw lastError ?? new Error('paywall_branches_exhausted')
  }

  private detectPaywallStatus(response: Response): 'paywall' | 'robots' | 'none' {
    if (response.status === 401 || response.status === 402 || response.status === 423 || response.status === 451) {
      return 'paywall'
    }
    if (response.status === 403) {
      const robots = response.headers.get('x-robots-tag')
      if (robots && robots.length) {
        return 'robots'
      }
      return 'paywall'
    }
    if (response.status === 429) {
      return 'paywall'
    }
    return 'none'
  }

  private isPaywallHtml(html: string): boolean {
    const snippet = html.slice(0, 20000).toLowerCase()
    const indicators = [
      'subscribe now',
      'subscriber-only',
      'log in to continue',
      'this content is available to subscribers',
      'purchase a subscription',
      'digital subscription',
      'sign in to read',
      'unlock this story'
    ]
    return indicators.some((phrase) => snippet.includes(phrase))
  }

  private extractHtmlContent(html: string): ExtractedContent {
    // Enhanced title extraction: og:title → title tag → h1
    let title = 'Untitled'
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    if (ogTitleMatch) {
      title = ogTitleMatch[1].trim()
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
        // Remove site name suffixes (e.g., " - ESPN")
        title = title.replace(/\s*[-|]\s*[^-|]+$/, '').trim()
      } else {
        // Fallback to h1
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
        if (h1Match) {
          title = h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
      }
    }
    
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i)
    const lang = langMatch ? langMatch[1].toLowerCase() : undefined

    // Extract headings
    const headingRegex = /<(h1|h2)[^>]*>(.*?)<\/\1>/gi
    const headings: string[] = []
    let headingMatch: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((headingMatch = headingRegex.exec(html))) {
      const headingText = headingMatch[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (headingText && headingText.length > 3) {
        headings.push(headingText)
      }
    }

    // Enhanced content extraction: prioritize article/main, prune boilerplate
    // Remove scripts, styles, and common boilerplate
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Remove common boilerplate
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      // Remove social sharing widgets
      .replace(/<div[^>]*class=["'][^"']*share["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class=["'][^"']*social["'][^>]*>[\s\S]*?<\/div>/gi, '')

    // Try article tag first (highest priority)
    let contentHtml = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    if (!contentHtml) {
      // Try main tag
      contentHtml = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    }
    if (!contentHtml) {
      // Try body, but exclude common non-content sections
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
      if (bodyMatch) {
        // Remove common non-content sections from body
        contentHtml = bodyMatch
          .replace(/<div[^>]*class=["'][^"']*(?:header|footer|nav|sidebar|menu|ad|advertisement)["'][^>]*>[\s\S]*?<\/div>/gi, '')
          .replace(/<section[^>]*class=["'][^"']*(?:header|footer|nav|sidebar|menu|ad)["'][^>]*>[\s\S]*?<\/section>/gi, '')
      }
    }
    if (!contentHtml) {
      contentHtml = cleaned
    }

    // Extract paragraphs and headings from content
    const paraMatches = contentHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
    const divMatches = contentHtml.match(/<div[^>]*class=["'][^"']*content["'][^>]*>([\s\S]*?)<\/div>/gi) || []
    
    // Helper to clean and validate text
    const cleanText = (rawText: string): string => {
      return rawText
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    let textParts: string[] = []
    
    // Add paragraphs
    paraMatches.forEach(match => {
      const text = cleanText(match)
      if (text.length > 50) { // Filter short paragraphs (likely boilerplate)
        textParts.push(text)
      }
    })
    
    // Add content divs if paragraphs are sparse
    if (textParts.length < 3 && divMatches.length > 0) {
      divMatches.forEach(match => {
        const text = cleanText(match)
        if (text.length > 100) {
          textParts.push(text)
        }
      })
    }
    
    // Try common content class patterns for JS-heavy sites (NBA.com, etc.)
    if (textParts.length < 3) {
      const commonContentSelectors = [
        /<div[^>]*class=["'][^"']*article["'][^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class=["'][^"']*post["'][^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*class=["'][^"']*story["'][^>]*>([\s\S]*?)<\/div>/gi,
        /<section[^>]*class=["'][^"']*content["'][^>]*>([\s\S]*?)<\/section>/gi,
        /<div[^>]*id=["'][^"']*content["'][^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*id=["'][^"']*main["'][^>]*>([\s\S]*?)<\/div>/gi,
      ]
      
      for (const selector of commonContentSelectors) {
        const matches = contentHtml.match(selector) || []
        for (const match of matches) {
          const text = cleanText(match)
          if (text.length > 200) {
            textParts.push(text)
          }
        }
        if (textParts.length >= 3) break
      }
    }
    
    // Fallback: extract all text if still empty or very short
    if (textParts.length === 0 || textParts.join(' ').length < 200) {
      const allText = cleanText(contentHtml)
      if (allText.length > 200) {
        // Split into sentences and filter for better quality
        const sentences = allText.split(/[.!?]\s+/).filter(s => s.length > 50)
        if (sentences.length > 0) {
          textParts = sentences.slice(0, 30) // Limit to first 30 sentences
        } else if (allText.length > 100) {
          // If no sentence breaks, use the whole text if it's substantial
          textParts = [allText]
        }
      }
    }

    const textBody = textParts.join('\n\n')
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
    // Check more text (first 500 words instead of 200) for better entity detection
    const words = content.text?.split(/\s+/).slice(0, 500).join(' ').toLowerCase() ?? ''
    const body = content.text?.toLowerCase?.() ?? ''

    // Check title first (most reliable)
    for (const term of terms) {
      if (!term) continue
      if (title.includes(term)) return true
    }

    // Check first 500 words (improved from 200)
    for (const term of terms) {
      if (!term) continue
      if (words.includes(term)) return true
    }

    // Check full body as fallback (for longer articles where entity might be later)
    // Only check if we have substantial content (>500 chars) to avoid false positives
    if (body.length > 500) {
      for (const term of terms) {
        if (!term) continue
        if (body.includes(term)) return true
      }
    }

    // If content is substantial (>1000 chars) but no entity found, be more lenient
    // This helps with articles that mention the entity indirectly or in context
    if (body.length > 1000 && content.text && content.text.length > 1000) {
      // Check for partial matches (e.g., "Bulls" in "Chicago Bulls")
      for (const term of terms) {
        if (!term || term.length < 4) continue // Only check substantial terms
        // Split multi-word terms and check for any word match
        const termWords = term.split(/\s+/)
        for (const word of termWords) {
          if (word.length >= 4 && body.includes(word)) {
            return true
          }
        }
      }
    }

    return false
  }

  private normaliseAngleLabel(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase()
  }

  private getHostFromUrl(url: string | undefined): string | null {
    if (!url) return null
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return null
    }
  }

  private isWikipediaHost(host: string | null): boolean {
    return Boolean(host && host.endsWith('wikipedia.org'))
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
      const host = this.getHostFromUrl(seed.url)
      const isWiki = this.isWikipediaHost(host)
      if (isWiki) {
        score -= 90
      } else {
        score += 18
      }
      return { seed, score, host, isWiki }
    })

    const normalisedUncoveredAngles = uncoveredAngles.map((angle) => this.normaliseAngleLabel(angle.angle))

    let availableSeeds = uncoveredAngles.length
      ? candidateSeeds.filter(({ seed }) => normalisedUncoveredAngles.includes(this.normaliseAngleLabel(seed.angle)))
      : candidateSeeds

    if (!availableSeeds.length) {
      availableSeeds = candidateSeeds
    }

    const nonWikiSeeds = availableSeeds.filter(({ isWiki }) => !isWiki)
    if (nonWikiSeeds.length > 0) {
      availableSeeds = nonWikiSeeds
    }

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

  private buildContestedKeywords(plan: DiscoveryPlan | null): Set<string> {
    const keywords = new Set<string>()
    if (!plan) return keywords

    const add = (value?: string) => {
      if (!value) return
      value
        .split(/[\s,/]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 2)
        .forEach((token) => keywords.add(token))
    }

    plan.controversyAngles?.forEach((angle) => {
      add(angle.angle)
      angle.quoteTargets?.forEach(add)
      angle.signals?.forEach(add)
    })

    plan.contestedPlan?.forEach((entry) => {
      add(entry.claim)
      entry.supportingSources?.forEach(add)
      entry.counterSources?.forEach(add)
      entry.verificationFocus?.forEach(add)
    })

    plan.seedCandidates?.forEach((seed) => {
      if (seed.isControversy || seed.stance === 'contested') {
        add(seed.angle)
        add(seed.titleGuess)
        add(seed.url)
      }
    })

    return keywords
  }

  private structuredLog(event: string, data: Record<string, unknown>): void {
    try {
      // Determine phase from event name
      let phase: string = 'unknown'
      if (event.includes('seed') || event.includes('planner')) {
        phase = 'seed'
      } else if (event.includes('fetch') || event.includes('paywall') || event.includes('render')) {
        phase = 'fetch'
      } else if (event.includes('extract') || event.includes('vet') || event.includes('relevance')) {
        phase = 'extract'
      } else if (event.includes('save') || event.includes('persist')) {
        phase = 'save'
      } else if (event.includes('hero') || event.includes('enrich')) {
        phase = 'hero'
      } else if (event.includes('error') || event.includes('fail')) {
        phase = 'error'
      }
      
      const payload = {
        source: 'discovery_engine_v21',
        runId: this.options.runId,
        patchId: this.options.patchId,
        patchHandle: this.options.patchHandle,
        phase,
        event,
        timestamp: new Date().toISOString(),
        counts: {
          processed: this.metrics.candidatesProcessed,
          saved: this.metrics.itemsSaved,
          duplicates: this.metrics.duplicates,
          failures: this.metrics.failures
        },
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
        countersSnapshot = await getSaveCounters(this.redisPatchId).catch(() => this.lastCounters)
      }
      if (countersSnapshot) {
        this.lastCounters = countersSnapshot
      }
      const trackerMetrics = this.metricsTracker.getMetrics()
      const snapshot: RunMetricsSnapshot = {
        runId: this.options.runId,
        patchId: this.redisPatchId,
        status,
        timestamp: new Date().toISOString(),
        metrics: {
          ...this.metrics,
          tracker: trackerMetrics,
          counters: this.lastCounters,
          acceptance: this.metrics.acceptance,
          telemetry: { ...this.telemetry },
          wikiGuard: this.wikiGuardState,
          controversyWindow: this.controversyWindow,
          successRates: this.scheduler.getSuccessRatesSnapshot(),
          zeroSave: {
            warning: this.zeroSaveWarningIssued,
            paused: this.zeroSaveAutoPaused,
            attempts: this.metrics.candidatesProcessed
          },
          actualPatchId: this.options.patchId,
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

  private resolveHeroKey(candidate: FrontierItem): string {
    if (typeof candidate.meta?.hookId === 'string' && candidate.meta.hookId.length) {
      return candidate.meta.hookId
    }
    if (typeof candidate.meta?.angleCategory === 'string' && candidate.meta.angleCategory.length) {
      return candidate.meta.angleCategory
    }
    if (typeof candidate.meta?.angle === 'string' && candidate.meta.angle.length) {
      return candidate.meta.angle
    }
    return 'global'
  }

  private classifyViewpoint(viewpoint?: string | null): HeroViewpointClass {
    if (!viewpoint) return 'neutral'
    const normalised = viewpoint.toLowerCase()
    if (/counter|oppose|critic|anti|minority|dissent|contested/.test(normalised)) {
      return 'counter'
    }
    if (/support|pro|establish|majority|government|official/.test(normalised)) {
      return 'support'
    }
    return 'neutral'
  }

  private isWithinMonths(dateInput: string | null | undefined, months: number): boolean {
    if (!dateInput) return false
    const parsed = new Date(dateInput)
    if (Number.isNaN(parsed.getTime())) return false
    const threshold = new Date()
    threshold.setMonth(threshold.getMonth() - months)
    return parsed >= threshold
  }

  private isHeroEntryEligible(entry: HeroGateEntry): boolean {
    return entry.isSfw && this.isWithinMonths(entry.publishDate ?? null, 24)
  }

  private computeRecencyScore(dateInput: string | null): number {
    if (!dateInput) return 0.5
    const parsed = new Date(dateInput)
    if (Number.isNaN(parsed.getTime())) return 0.5
    const diffDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays <= 30) return 1
    if (diffDays <= 180) return 0.85
    if (diffDays <= 365) return 0.7
    if (diffDays <= 730) return 0.5
    return 0.3
  }

  private evaluateHeroEligibility(
    key: string,
    candidateEntry: HeroGateEntry
  ): { eligible: boolean; supportDomain?: string | null; counterDomain?: string | null } {
    const existing = this.heroGateMap.get(key) ?? []
    const combined = [...existing, candidateEntry]
    const supportEntries = combined.filter((entry) => entry.viewpointClass === 'support')
    const counterEntries = combined.filter((entry) => entry.viewpointClass === 'counter')

    for (const support of supportEntries) {
      if (!this.isHeroEntryEligible(support) || !support.domain) continue
      for (const counter of counterEntries) {
        if (!this.isHeroEntryEligible(counter) || !counter.domain) continue
        if (support.domain !== counter.domain) {
          return { eligible: true, supportDomain: support.domain, counterDomain: counter.domain }
        }
      }
    }

    return { eligible: false }
  }

  private storeHeroEntry(key: string, entry: HeroGateEntry): void {
    const entries = this.heroGateMap.get(key) ?? []
    entries.push(entry)
    if (entries.length > 10) {
      entries.shift()
    }
    this.heroGateMap.set(key, entries)
  }

  private computeHeroScore(args: {
    isControversy: boolean
    publishDate?: string | null
    credibilityTier?: number
    noveltySignals?: unknown
    host: string | null
    viewpointClass: HeroViewpointClass
    viewpointEligible: boolean
  }): number {
    const controversyScore = args.isControversy ? 1 : 0.4
    const recencyScore = this.computeRecencyScore(args.publishDate ?? null)
    const authorityScore = this.computeAuthorityScore(args.credibilityTier)
    const noveltyScore = Array.isArray(args.noveltySignals) && args.noveltySignals.length > 0 ? 1 : 0.5
    const successScore = this.getHostSuccessEma(args.host)
    const viewpointScore = args.viewpointEligible
      ? 1
      : args.viewpointClass !== 'neutral'
        ? 0.7
        : 0.4

    const score =
      0.3 * controversyScore +
      0.2 * recencyScore +
      0.2 * authorityScore +
      0.1 * noveltyScore +
      0.1 * successScore +
      0.1 * viewpointScore

    return Number(score.toFixed(3))
  }

  private computeAuthorityScore(tier?: number): number {
    if (tier === 1) return 1
    if (tier === 2) return 0.75
    if (tier === 3) return 0.5
    return 0.4
  }

  private getHostSuccessEma(host: string | null): number {
    if (!host) return 0.5
    const snapshot = this.scheduler.getSuccessRatesSnapshot()
    const record = snapshot[host] ?? snapshot[host.toLowerCase()]
    if (record && typeof record.ema === 'number') {
      return Math.max(0, Math.min(1, record.ema))
    }
    return 0.5
  }
}
