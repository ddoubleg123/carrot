import { canonicalizeUrlFast } from './canonicalize'
import type { FrontierItem } from '@/lib/redis/discovery'

const MAX_RESULTS_PER_QUERY = 8
const MAX_RESULTS_PER_HOST = 2
const GENERAL_UNLOCK_ATTEMPTS = 15
const FIVE_MINUTES = 5 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000

export type QueryProvider =
  | 'query:wikipedia'
  | 'query:news'
  | 'query:official'
  | 'query:longform'
  | 'query:data'

export interface QueryExpansionSuggestion {
  url: string
  sourceType: string
  host: string | null
  keywords: string[]
  priorityOffset: number
  metadata: Record<string, unknown>
}

export interface QueryExpansionResult {
  suggestions: QueryExpansionSuggestion[]
  deferredGeneral: boolean
}

export interface CooldownRecord {
  lastSeen: number
  cooldownUntil: number
}

export interface FilteredSuggestion {
  suggestion: QueryExpansionSuggestion
  canonicalUrl: string
}

export interface SuggestionSkip {
  url?: string
  reason: string
  detail?: string
}

export interface SuggestionFilterContext {
  patchId: string
  seeds: Set<string>
  cooldowns: Map<string, CooldownRecord>
  now?: number
  isSeen: (patchId: string, canonicalUrl: string) => Promise<boolean>
}

export interface SuggestionFilterResult {
  accepted: FilteredSuggestion[]
  skipped: SuggestionSkip[]
}

function flattenKeywords(input: unknown): string[] {
  if (!input) return []
  if (Array.isArray(input)) {
    const flat: string[] = []
    input.forEach((value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.length > 0) flat.push(trimmed)
      } else if (Array.isArray(value)) {
        flattenKeywords(value).forEach((entry) => flat.push(entry))
      }
    })
    return flat
  }
  if (typeof input === 'string') {
    return [input.trim()].filter(Boolean)
  }
  return []
}

function normaliseHost(host: string | null | undefined): string | null {
  if (!host) return null
  try {
    const withoutProtocol = host.replace(/^https?:\/\//i, '')
    return new URL(`https://${withoutProtocol}`).hostname.toLowerCase()
  } catch {
    try {
      return new URL(`https://${host}`).hostname.toLowerCase()
    } catch {
      return host.toLowerCase()
    }
  }
}

function slugifyWikipediaTitle(title: string): string {
  return encodeURIComponent(title.trim().replace(/\s+/g, '_'))
}

function formatDateForQuery(date: string | undefined): string | undefined {
  if (!date) return undefined
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return undefined
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getUTCDate()}`.padStart(2, '0')
  const year = parsed.getUTCFullYear()
  return `${month}/${day}/${year}`
}

function resolveMinPubDate(candidate: FrontierItem): string | undefined {
  if (typeof candidate.meta?.minPubDate === 'string') {
    return candidate.meta.minPubDate
  }

  const recencyWeeks = Number(candidate.meta?.recencyBiasWeeks)
  if (!Number.isFinite(recencyWeeks) || recencyWeeks <= 0) {
    return undefined
  }

  const now = new Date()
  const days = Math.floor(recencyWeeks * 7)
  now.setUTCDate(now.getUTCDate() - days)
  return now.toISOString().slice(0, 10)
}

function buildNewsUrls(
  keywords: string[],
  host: string | null,
  minPubDate?: string
): QueryExpansionSuggestion[] {
  if (!keywords.length) return []
  const primary = keywords.slice(0, 3).join(' ')
  const baseTerms = host ? `${primary} site:${host}` : primary
  const suggestions: QueryExpansionSuggestion[] = []

  const googleNewsUrl = new URL('https://news.google.com/rss/search')
  googleNewsUrl.searchParams.set('q', host ? `${baseTerms}` : primary)
  googleNewsUrl.searchParams.set('hl', 'en-US')
  googleNewsUrl.searchParams.set('gl', 'US')
  googleNewsUrl.searchParams.set('ceid', 'US:en')
  if (minPubDate) {
    googleNewsUrl.searchParams.set('when', `after:${minPubDate}`)
  }
  let googleNewsUrlString = googleNewsUrl.toString()
  if (minPubDate) {
    const encodedDate = encodeURIComponent(minPubDate)
    googleNewsUrlString = googleNewsUrlString.replace(
      `after%3A${encodedDate}`,
      `after:${minPubDate}`
    )
  }
  suggestions.push({
    url: googleNewsUrlString,
    sourceType: 'news',
    host,
    keywords: [primary],
    priorityOffset: 30,
    metadata: { feed: 'google-news-rss' }
  })

  const googleSearch = new URL('https://www.google.com/search')
  googleSearch.searchParams.set('q', baseTerms)
  googleSearch.searchParams.set('tbm', 'nws')
  const cdMin = formatDateForQuery(minPubDate)
  if (cdMin) {
    googleSearch.searchParams.set('tbs', `cdr:1,cd_min:${cdMin}`)
    googleSearch.searchParams.set('cd_min', cdMin)
  }
  suggestions.push({
    url: googleSearch.toString(),
    sourceType: 'news',
    host,
    keywords: [primary],
    priorityOffset: 20,
    metadata: { feed: 'google-news-search' }
  })

  if (host) {
    const siteSearch = new URL(`https://${host}/search`)
    siteSearch.searchParams.set('q', primary)
    suggestions.push({
      url: siteSearch.toString(),
      sourceType: 'news',
      host,
      keywords: [primary],
      priorityOffset: 10,
      metadata: { feed: 'site-search' }
    })
  }

  return suggestions
}

function buildDataUrls(
  keywords: string[],
  host: string | null,
  minPubDate?: string
): QueryExpansionSuggestion[] {
  if (!keywords.length) return []
  const primary = keywords.slice(0, 3).join(' ')
  const baseTerms = host ? `${primary} dataset site:${host}` : `${primary} dataset`
  const googleSearch = new URL('https://www.google.com/search')
  googleSearch.searchParams.set('q', baseTerms)
  const cdMin = formatDateForQuery(minPubDate)
  if (cdMin) {
    googleSearch.searchParams.set('tbs', `cdr:1,cd_min:${cdMin}`)
    googleSearch.searchParams.set('cd_min', cdMin)
  }
  return [
    {
      url: googleSearch.toString(),
      sourceType: 'data',
      host,
      keywords: [primary],
      priorityOffset: 25,
      metadata: { feed: 'google-web' }
    }
  ]
}

function buildLongformUrls(
  keywords: string[],
  host: string | null,
  minPubDate?: string
): QueryExpansionSuggestion[] {
  if (!keywords.length) return []
  const primary = keywords.slice(0, 3).join(' ')
  const baseTerms = host ? `${primary} longform site:${host}` : `${primary} longform`
  const googleSearch = new URL('https://www.google.com/search')
  googleSearch.searchParams.set('q', baseTerms)
  const cdMin = formatDateForQuery(minPubDate)
  if (cdMin) {
    googleSearch.searchParams.set('tbs', `cdr:1,cd_min:${cdMin}`)
    googleSearch.searchParams.set('cd_min', cdMin)
  }
  return [
    {
      url: googleSearch.toString(),
      sourceType: 'longform',
      host,
      keywords: [primary],
      priorityOffset: 15,
      metadata: { feed: 'google-web' }
    }
  ]
}

export function expandPlannerQuery(options: {
  candidate: FrontierItem
  attempt: number
}): QueryExpansionResult {
  const { candidate, attempt } = options
  const provider = candidate.provider as QueryProvider
  const suggestions: QueryExpansionSuggestion[] = []
  const hostCounts = new Map<string | null, number>()
  let deferredGeneral = false
  const minPubDate = resolveMinPubDate(candidate)

  const addSuggestion = (suggestion: QueryExpansionSuggestion) => {
    if (suggestions.length >= MAX_RESULTS_PER_QUERY) return
    const hostKey = suggestion.host
    const current = hostCounts.get(hostKey) ?? 0
    if (current >= MAX_RESULTS_PER_HOST) return
    hostCounts.set(hostKey, current + 1)
    suggestions.push(suggestion)
  }

  switch (provider) {
    case 'query:wikipedia': {
      const title = typeof candidate.cursor === 'string' ? candidate.cursor : ''
      if (!title) break
      const slug = slugifyWikipediaTitle(title)
      addSuggestion({
        url: `https://en.wikipedia.org/wiki/${slug}`,
        sourceType: 'wikipedia',
        host: 'wikipedia.org',
        keywords: [title],
        priorityOffset: 40,
        metadata: {}
      })
      break
    }
    case 'query:official': {
      const url = typeof candidate.cursor === 'string' ? candidate.cursor : ''
      if (!url) break
      const host = normaliseHost(candidate.cursor)
      addSuggestion({
        url,
        sourceType: 'official',
        host,
        keywords: [],
        priorityOffset: 35,
        metadata: {}
      })
      break
    }
    case 'query:news':
    case 'query:data':
    case 'query:longform': {
      let parsed: any = null
      if (typeof candidate.cursor === 'string') {
        try {
          parsed = JSON.parse(candidate.cursor)
        } catch {
          parsed = null
        }
      }
      const keywords = flattenKeywords(parsed?.keywords ?? candidate.meta?.keywords ?? [])
      const siteFilters = flattenKeywords(parsed?.siteFilters ?? candidate.meta?.siteFilters ?? [])

      if (siteFilters.length === 0 && attempt < GENERAL_UNLOCK_ATTEMPTS) {
        deferredGeneral = true
        break
      }

      const hosts = siteFilters.length ? siteFilters : [null]
      for (const rawHost of hosts) {
        const host = normaliseHost(rawHost)
        switch (provider) {
          case 'query:news':
            buildNewsUrls(keywords, host, minPubDate).forEach(addSuggestion)
            break
          case 'query:data':
            buildDataUrls(keywords, host, minPubDate).forEach(addSuggestion)
            break
          case 'query:longform':
            buildLongformUrls(keywords, host, minPubDate).forEach(addSuggestion)
            break
        }
      }
      break
    }
    default:
      break
  }

  return {
    suggestions,
    deferredGeneral
  }
}

async function passesCooldown(
  canonicalUrl: string,
  cooldowns: Map<string, CooldownRecord>,
  now: number
): Promise<{ allowed: boolean; reason?: string }> {
  const record = cooldowns.get(canonicalUrl)
  if (!record) {
    cooldowns.set(canonicalUrl, { lastSeen: now, cooldownUntil: now + FIVE_MINUTES })
    return { allowed: true }
  }

  if (now < record.cooldownUntil) {
    return { allowed: false, reason: 'cooldown_active' }
  }

  if (now - record.lastSeen < FIVE_MINUTES) {
    cooldowns.set(canonicalUrl, { lastSeen: record.lastSeen, cooldownUntil: now + THIRTY_MINUTES })
    return { allowed: false, reason: 'cooldown_penalty' }
  }

  cooldowns.set(canonicalUrl, { lastSeen: now, cooldownUntil: now + FIVE_MINUTES })
  return { allowed: true }
}

export async function filterQuerySuggestions(
  suggestions: QueryExpansionSuggestion[],
  context: SuggestionFilterContext
): Promise<SuggestionFilterResult> {
  const now = context.now ?? Date.now()
  const localCanonicals = new Set<string>()
  const accepted: FilteredSuggestion[] = []
  const skipped: SuggestionSkip[] = []
  const canonicalUrl = (raw: string) => {
    try {
      return new URL(raw)
    } catch {
      return null
    }
  }

  const isSeedDuplicate = (canonical: string) => {
    if (context.seeds.has(canonical)) return true
    for (const seed of context.seeds) {
      if (canonical.startsWith(seed)) return true
      const seedUrl = canonicalUrl(seed)
      const candidateUrl = canonicalUrl(canonical)
      if (!seedUrl || !candidateUrl) continue
      if (seedUrl.origin !== candidateUrl.origin || seedUrl.pathname !== candidateUrl.pathname) continue

      const seedQuery = seedUrl.searchParams.get('q')
      const candidateQuery = candidateUrl.searchParams.get('q')
      if (!seedQuery) {
        return true
      }
      if (candidateQuery && candidateQuery.startsWith(seedQuery)) {
        return true
      }
    }
    return false
  }

  for (const suggestion of suggestions) {
    const canonical = canonicalizeUrlFast(suggestion.url)
    if (!canonical) {
      skipped.push({ url: suggestion.url, reason: 'invalid_url' })
      continue
    }
    if (isSeedDuplicate(canonical)) {
      skipped.push({ url: suggestion.url, reason: 'seed_duplicate' })
      continue
    }
    if (localCanonicals.has(canonical)) {
      skipped.push({ url: suggestion.url, reason: 'query_duplicate' })
      continue
    }
    const cooldownResult = await passesCooldown(canonical, context.cooldowns, now)
    if (!cooldownResult.allowed) {
      skipped.push({ url: suggestion.url, reason: cooldownResult.reason ?? 'cooldown' })
      continue
    }
    if (await context.isSeen(context.patchId, canonical)) {
      skipped.push({ url: suggestion.url, reason: 'redis_seen' })
      continue
    }

    localCanonicals.add(canonical)
    accepted.push({ suggestion, canonicalUrl: canonical })
  }

  return { accepted, skipped }
}

export const QueryExpanderConstants = {
  GENERAL_UNLOCK_ATTEMPTS,
  MAX_RESULTS_PER_HOST,
  MAX_RESULTS_PER_QUERY,
  FIVE_MINUTES,
  THIRTY_MINUTES
}


