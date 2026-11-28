/** Hours and slate limits for the home feed. Admin can replace the numbers. */

export type FeedRankConfig = {
  group: number
  follow: number
  share: number
  save: number
  post: number
  comment: number
  search: number
  carrot: number
  open: number
  stick: number
  dwell: number
  skip: number
  mediaRun: number
  bucketRun: number
  /** 0 keeps Pol Watch off Home. 20 means one card every 20 posts. */
  polEvery: number
  extraTerms: Record<string, string[]>
}

export const FEED_RANK_DEFAULTS: FeedRankConfig = {
  group: 36,
  follow: 12,
  share: 24,
  save: 24,
  post: 18,
  comment: 12,
  search: 8,
  carrot: 6,
  open: 2,
  stick: -8,
  dwell: 4,
  skip: -2,
  mediaRun: 2,
  bucketRun: 2,
  polEvery: 0,
  extraTerms: {}
}

const HOUR_KEYS = ['group', 'follow', 'share', 'save', 'post', 'comment', 'search', 'carrot', 'open', 'stick', 'dwell', 'skip'] as const

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function normalizeFeedRank(raw: unknown): FeedRankConfig {
  const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const next = { ...FEED_RANK_DEFAULTS }
  for (const key of HOUR_KEYS) next[key] = num(row[key], FEED_RANK_DEFAULTS[key], -72, 72)
  next.mediaRun = num(row.mediaRun, 2, 1, 6)
  next.bucketRun = num(row.bucketRun, 2, 1, 6)
  next.polEvery = num(row.polEvery, 0, 0, 50)
  const extra: Record<string, string[]> = {}
  if (row.extraTerms && typeof row.extraTerms === 'object' && !Array.isArray(row.extraTerms)) {
    for (const [desk, words] of Object.entries(row.extraTerms as Record<string, unknown>)) {
      if (!/^[a-z0-9-]{2,40}$/.test(desk) || !Array.isArray(words)) continue
      const clean = words.map((word) => String(word || '').trim().toLowerCase()).filter((word) => word.length > 2 && word.length < 40)
      if (clean.length) extra[desk] = [...new Set(clean)].slice(0, 20)
    }
  }
  next.extraTerms = extra
  return next
}

/** 8–90 seconds scales up to the dwell cap. Under 1.5 seconds is a skip. */
export function dwellHours(ms: number, config: FeedRankConfig): { kind: 'dwell' | 'skip' | 'none'; hours: number } {
  const seconds = ms / 1000
  if (!Number.isFinite(seconds) || seconds < 0) return { kind: 'none', hours: 0 }
  if (seconds < 1.5) return { kind: 'skip', hours: config.skip }
  if (seconds < 8) return { kind: 'none', hours: 0 }
  const span = Math.min(90, seconds)
  const fraction = (span - 8) / (90 - 8)
  return { kind: 'dwell', hours: Math.round(config.dwell * fraction * 10) / 10 }
}

const WEEK = 7 * 24 * 60 * 60 * 1000

export function searchHours(events: { bucket: string; at: number }[], bucket: string, weight: number, now = Date.now()): number {
  let total = 0
  for (const event of events) {
    if (event.bucket !== bucket) continue
    const age = now - event.at
    if (age < 0 || age >= WEEK) continue
    total += weight * (1 - age / WEEK)
  }
  return Math.round(total * 10) / 10
}
