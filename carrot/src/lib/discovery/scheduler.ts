import type { FrontierItem } from '@/lib/redis/discovery'
import {
  getSuccessRates as loadSuccessRates,
  setSuccessRate,
  getZeroSaveDiagnostics,
  setZeroSaveDiagnostics,
  clearZeroSaveDiagnostics,
  setRunState
} from '@/lib/redis/discovery'

const WIKI_WINDOW_MS = Number(process.env.DISCOVERY_V2_WIKI_WINDOW_MS ?? 30_000)
const WIKI_GUARD_DURATION_MS = Number(process.env.DISCOVERY_V2_WIKI_GUARD_PAUSE_MS ?? 120_000)
const CONTROVERSY_WINDOW_SIZE = 40
const SUCCESS_DECAY_MS = Number(process.env.DISCOVERY_V2_SUCCESS_DECAY_MS ?? 14 * 24 * 60 * 60 * 1000)
const DEFAULT_WIKI_SHARE_MAX = Number(process.env.DISCOVERY_V2_WIKI_SHARE_MAX ?? 0.3)
const QPS_PER_HOST_DEFAULT = Number(process.env.DISCOVERY_V2_QPS_PER_HOST ?? 0.5)
const CANONICAL_COOLDOWN_MS = Number(process.env.DISCOVERY_V2_CANONICAL_COOLDOWN_MS ?? 30 * 60 * 1000)
const CANONICAL_HIT_THRESHOLD_MS = Number(process.env.DISCOVERY_V2_CANONICAL_HIT_THRESHOLD_MS ?? 5 * 60 * 1000)

export interface WikiGuardState {
  active: boolean
  share: number
  window: number
  cooldownExpiresAt?: number
}

export interface ControversyWindow {
  attemptRatio: number
  saveRatio: number
  size: number
}

export interface SuccessRateStats {
  ema: number
  updatedAt: number
}

export interface CandidateEvaluation {
  action: 'accept' | 'requeue'
  candidate: FrontierItem
  reason?: string
}

interface AttemptSample {
  timestamp: number
  host: string | null
  isContested: boolean
  isWikipedia: boolean
}

interface SaveSample {
  timestamp: number
  isContested: boolean
}

export class SchedulerGuards {
  private attempts: AttemptSample[] = []
  private saves: SaveSample[] = []
  private wikiGuardActiveUntil = 0
  private hostHistory: Array<{ timestamp: number; host: string | null }> = []
  private successRates = new Map<string, SuccessRateStats>()
  private lastSuccessPersist = 0
  private wikiShareMax = DEFAULT_WIKI_SHARE_MAX
  private patchId: string
  private canonicalHits = new Map<string, { firstSeen: number; attempts: number; cooldownUntil?: number }>()
  private hostThrottle: Map<string, number> = new Map()
  private qpsPerHost = QPS_PER_HOST_DEFAULT

  constructor(
    options: {
      patchId: string
      now?: () => number
      wikiShareMax?: number
      qpsPerHost?: number
    }
  ) {
    this.opts = { now: options.now }
    this.patchId = options.patchId
    if (typeof options.wikiShareMax === 'number') {
      this.wikiShareMax = options.wikiShareMax
    }
    if (typeof options.qpsPerHost === 'number' && options.qpsPerHost > 0) {
      this.qpsPerHost = options.qpsPerHost
    }
  }

  private readonly opts: {
    now?: () => number
  }

  now(): number {
    return this.opts.now ? this.opts.now() : Date.now()
  }

  hydrateSuccessRates(entries: Record<string, SuccessRateStats> | undefined): void {
    if (!entries) return
    Object.entries(entries).forEach(([host, stats]) => {
      if (!host) return
      if (typeof stats?.ema !== 'number' || Number.isNaN(stats.ema)) return
      this.successRates.set(host, stats)
    })
  }

  recordAttempt(sample: AttemptSample): void {
    const timestamp = sample.timestamp ?? this.now()
    const windowStart = timestamp - WIKI_WINDOW_MS
    this.attempts.push({ ...sample, timestamp })
    this.attempts = this.attempts.filter((entry) => entry.timestamp >= windowStart)

    this.hostHistory.push({ timestamp, host: sample.host })
    this.hostHistory = this.hostHistory.filter((entry) => entry.timestamp >= timestamp - WIKI_WINDOW_MS)

    const wikiAttempts = this.attempts.filter((entry) => entry.isWikipedia)
    const share = this.attempts.length ? wikiAttempts.length / this.attempts.length : 0
    if (share > this.wikiShareMax) {
      this.wikiGuardActiveUntil = Math.max(this.wikiGuardActiveUntil, timestamp + WIKI_GUARD_DURATION_MS)
    }
  }

  recordSave(sample: SaveSample): void {
    const timestamp = sample.timestamp ?? this.now()
    this.saves.push({ ...sample, timestamp })
    if (this.saves.length > CONTROVERSY_WINDOW_SIZE) {
      this.saves.splice(0, this.saves.length - CONTROVERSY_WINDOW_SIZE)
    }
  }

  updateSuccessRate(host: string | null | undefined, outcome: 'success' | 'failure'): SuccessRateStats | null {
    if (!host) return null
    const timestamp = this.now()
    const existing = this.successRates.get(host) ?? { ema: 0.5, updatedAt: timestamp }
    const delta = outcome === 'success' ? 1 : 0
    const alpha = 2 / (1 + 7) // smoothing factor for approx weekly lookback
    const decayFactor = this.computeDecay(existing.updatedAt, timestamp)
    const ema = alpha * delta + (1 - alpha) * (existing.ema * decayFactor)
    const next = { ema, updatedAt: timestamp }
    this.successRates.set(host, next)
    return next
  }

  private computeDecay(lastUpdated: number, now: number): number {
    if (!lastUpdated) return 1
    const elapsed = Math.max(0, now - lastUpdated)
    if (elapsed === 0) return 1
    const halfLife = SUCCESS_DECAY_MS
    const decay = Math.pow(0.5, elapsed / halfLife)
    return decay
  }

  evaluateCandidate(args: {
    candidate: FrontierItem
    host: string | null
    isContested: boolean
  }): CandidateEvaluation {
    const { candidate, host, isContested } = args
    const now = this.now()
    const wikiState = this.getWikiGuardState()

    if (wikiState.active && host && host.endsWith('wikipedia.org')) {
      return {
        action: 'requeue',
        candidate: {
          ...candidate,
          priority: Math.floor(candidate.priority * 0.2)
        },
        reason: 'wiki_guard'
      }
    }

    const hostEvaluation = this.applyHostSuccessBias(candidate, host)
    if (hostEvaluation) {
      return hostEvaluation
    }

    if (this.needsContestedBias() && !isContested) {
      return {
        action: 'requeue',
        candidate: {
          ...candidate,
          priority: candidate.priority - 15
        },
        reason: 'contested_bias'
      }
    }

    if (host && this.isHostThrottled(host, now)) {
      return {
        action: 'requeue',
        candidate: {
          ...candidate,
          priority: candidate.priority - 10
        },
        reason: 'qps_throttle'
      }
    }

    return { action: 'accept', candidate }
  }

  private applyHostSuccessBias(candidate: FrontierItem, host: string | null): CandidateEvaluation | null {
    if (!host) return null
    const stats = this.successRates.get(host)
    if (!stats) return null
    const ema = Math.max(0, Math.min(1, stats.ema))
    const neutral = 0.5
    if (Math.abs(ema - neutral) < 0.05) {
      return null
    }

    if (ema >= neutral) {
      return {
        action: 'accept',
        candidate: {
          ...candidate,
          priority: Math.floor(candidate.priority * (1 + (ema - neutral) * 0.2))
        },
        reason: undefined
      }
    }

    return {
      action: 'requeue',
      candidate: {
        ...candidate,
        priority: Math.floor(candidate.priority * (1 - (neutral - ema) * 0.3))
      },
      reason: 'success_bias'
    }
  }

  getWikiGuardState(): WikiGuardState {
    const now = this.now()
    const active = this.wikiGuardActiveUntil > now
    const wikiAttempts = this.attempts.filter((entry) => entry.isWikipedia)
    const share = this.attempts.length ? wikiAttempts.length / this.attempts.length : 0
    return {
      active,
      share,
      window: this.attempts.length,
      cooldownExpiresAt: active ? this.wikiGuardActiveUntil : undefined
    }
  }

  getHostDiversityCount(): number {
    const hosts = new Set(
      this.hostHistory
        .map((entry) => entry.host)
        .filter((value): value is string => Boolean(value))
    )
    return hosts.size
  }

  needsReseed(): boolean {
    const wikiState = this.getWikiGuardState()
    if (wikiState.active) return true
    if (this.getHostDiversityCount() < 3 && this.hostHistory.length >= 6) {
      return true
    }
    return this.needsContestedBias()
  }

  getControversyWindow(): ControversyWindow {
    const attempts = this.attempts.slice(-CONTROVERSY_WINDOW_SIZE)
    const contestedAttempts = attempts.filter((entry) => entry.isContested)
    const savesWindow = this.saves.slice(-CONTROVERSY_WINDOW_SIZE)
    const contestedSaves = savesWindow.filter((entry) => entry.isContested)
    return {
      attemptRatio: attempts.length ? contestedAttempts.length / attempts.length : 0,
      saveRatio: savesWindow.length ? contestedSaves.length / savesWindow.length : 0,
      size: attempts.length
    }
  }

  needsContestedBias(): boolean {
    const window = this.getControversyWindow()
    if (window.size < 5) return false
    return window.attemptRatio < 0.5 || window.saveRatio < 0.4
  }

  async hydrateFromRedis(): Promise<void> {
    const successRates = await loadSuccessRates(this.patchId)
    this.hydrateSuccessRates(successRates)
  }

  async persistSuccessRate(host: string, outcome: 'success' | 'failure'): Promise<void> {
    if (!host) return
    const now = this.now()
    const stats = this.updateSuccessRate(host, outcome)
    if (!stats) return
    if (now - this.lastSuccessPersist < 5_000) return
    this.lastSuccessPersist = now
    await setSuccessRate(this.patchId, host, stats)
  }

  private isHostThrottled(host: string, now: number): boolean {
    const prev = this.hostThrottle.get(host) ?? 0
    const minInterval = 1000 / Math.max(this.qpsPerHost, 0.01)
    if (now - prev < minInterval) {
      this.hostThrottle.set(host, now)
      return true
    }
    this.hostThrottle.set(host, now)
    return false
  }

  recordCanonicalHit(canonicalUrl: string): 'ok' | 'cooldown' {
    const now = this.now()
    const record = this.canonicalHits.get(canonicalUrl)
    if (!record) {
      this.canonicalHits.set(canonicalUrl, { firstSeen: now, attempts: 1 })
      return 'ok'
    }

    if (record.cooldownUntil && now < record.cooldownUntil) {
      return 'cooldown'
    }

    if (now - record.firstSeen <= CANONICAL_HIT_THRESHOLD_MS) {
      record.attempts += 1
      if (record.attempts >= 2) {
        record.cooldownUntil = now + CANONICAL_COOLDOWN_MS
        return 'cooldown'
      }
    } else {
      record.firstSeen = now
      record.attempts = 1
      record.cooldownUntil = undefined
    }

    this.canonicalHits.set(canonicalUrl, record)
    return 'ok'
  }

  clearCanonicalCooldown(canonicalUrl: string): void {
    this.canonicalHits.delete(canonicalUrl)
  }

  async handleZeroSave(attempts: number): Promise<'ok' | 'warning' | 'paused'> {
    const zeroSave = await getZeroSaveDiagnostics(this.patchId)
    if (attempts >= 40) {
      if (!zeroSave || zeroSave.status !== 'paused') {
        await setZeroSaveDiagnostics(this.patchId, {
          status: 'paused',
          attempts,
          issuedAt: new Date().toISOString(),
          reason: 'zero_save_autopause'
        })
        await setRunState(this.patchId, 'paused')
      }
      return 'paused'
    } else if (attempts >= 25) {
      if (!zeroSave || zeroSave.status === 'ok') {
        await setZeroSaveDiagnostics(this.patchId, {
          status: 'warning',
          attempts,
          issuedAt: new Date().toISOString(),
          reason: 'zero_save_warning'
        })
      }
      return 'warning'
    } else if (zeroSave && zeroSave.status !== 'ok') {
      await clearZeroSaveDiagnostics(this.patchId)
    }
    return 'ok'
  }

  getSuccessRatesSnapshot(): Record<string, SuccessRateStats> {
    return Object.fromEntries(this.successRates.entries())
  }
}


