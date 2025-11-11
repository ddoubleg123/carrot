import type { FrontierItem } from '@/lib/redis/discovery'

const WIKI_WINDOW_MS = 30 * 1000
const WIKI_GUARD_DURATION_MS = 2 * 60 * 1000
const HOST_DIVERSITY_WINDOW_MS = 30 * 1000
const CONTROVERSY_WINDOW_SIZE = 40
const SUCCESS_DECAY_MS = 14 * 24 * 60 * 60 * 1000

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

  constructor(
    private readonly opts: {
      now?: () => number
    } = {}
  ) {}

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
    this.hostHistory = this.hostHistory.filter((entry) => entry.timestamp >= timestamp - HOST_DIVERSITY_WINDOW_MS)

    const wikiAttempts = this.attempts.filter((entry) => entry.isWikipedia)
    const share = this.attempts.length ? wikiAttempts.length / this.attempts.length : 0
    if (share > 0.3) {
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
    const successFactor = this.resolveSuccessFactor(host)

    const isWikipedia = Boolean(host && host.endsWith('wikipedia.org'))
    const wikiGuardActive = this.wikiGuardActiveUntil > now

    if (wikiGuardActive && isWikipedia) {
      const adjusted: FrontierItem = {
        ...candidate,
        id: `wiki_guard:${Date.now()}:${Math.random()}`,
        priority: Math.floor(candidate.priority * 0.2)
      }
      return { action: 'requeue', candidate: adjusted, reason: 'wiki_guard' }
    }

    if (this.needsContestedBias() && !isContested) {
      const adjusted: FrontierItem = {
        ...candidate,
        id: `bias_contested:${Date.now()}:${Math.random()}`,
        priority: candidate.priority - 15
      }
      return { action: 'requeue', candidate: adjusted, reason: 'contested_bias' }
    }

    if (successFactor !== 1) {
      const adjusted: FrontierItem = {
        ...candidate,
        id: `success_weight:${Date.now()}:${Math.random()}`,
        priority: Math.floor(candidate.priority * successFactor)
      }
      return { action: 'requeue', candidate: adjusted, reason: 'success_bias' }
    }

    return { action: 'accept', candidate }
  }

  resolveSuccessFactor(host: string | null): number {
    if (!host) return 1
    const stats = this.successRates.get(host)
    if (!stats) return 1
    const ema = Math.max(0, Math.min(1, stats.ema))
    const neutral = 0.5
    if (Math.abs(ema - neutral) < 0.05) {
      return 1
    }
    if (ema >= neutral) {
      return 1 + (ema - neutral) * 0.2
    }
    return 1 - (neutral - ema) * 0.3
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
}


