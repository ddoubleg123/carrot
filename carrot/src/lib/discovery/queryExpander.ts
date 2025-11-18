import { canonicalizeUrlFast } from './canonicalize'
import type { FrontierItem } from '@/lib/redis/discovery'
import { extractOutgoingLinks, extractWikipediaReferences } from './wikiUtils'

const MAX_RESULTS_PER_QUERY = 10
const MIN_RESULTS_PER_QUERY = 5
const MAX_RESULTS_PER_HOST = 2
const GENERAL_UNLOCK_ATTEMPTS = 15
const FIVE_MINUTES = 5 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000
const SEARCH_HOST_ALLOWLIST = new Set(['news.google.com', 'www.google.com'])
const HOMEPAGE_SEGMENTS = new Set(['news', 'world', 'latest', 'section', 'topics', 'index'])

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

export interface QueryExpansionOptions {
  candidate: FrontierItem
  attempt: number
  totalDequeues?: number
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

async function harvestWikipediaCitations(title: string): Promise<QueryExpansionSuggestion[]> {
  if (!title || typeof fetch !== 'function') return []
  const slug = slugifyWikipediaTitle(title)
  const sourceUrl = `https://en.wikipedia.org/wiki/${slug}`
  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/html/${slug}`

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'text/html'
      }
    })
    if (!response.ok) {
      return []
    }
    const html = await response.text()
    const references = extractWikipediaReferences(html, sourceUrl, 20)
    const referenceSet = new Set(references)
    if (references.length < MAX_RESULTS_PER_QUERY) {
      const outgoing = extractOutgoingLinks(html, sourceUrl, 40)
      const supplemental = outgoing.offHost
        .filter((url) => !referenceSet.has(url))
        .slice(0, MAX_RESULTS_PER_QUERY - references.length)
      supplemental.forEach((url) => referenceSet.add(url))
    }
    const combined = Array.from(referenceSet).slice(0, MAX_RESULTS_PER_QUERY)
    return combined.map((url, index) => ({
      url,
      sourceType: 'wiki_citation',
      host: normaliseHost(url),
      keywords: [title],
      priorityOffset: 80 - index * 4,
      metadata: {
        reason: 'wiki_citation',
        parent: sourceUrl
      }
    }))
  } catch {
    return []
  }
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

function deriveMinPubDate(
  candidate: FrontierItem,
  overrides?: { recencyWeeks?: number; minPubDate?: string }
): string | undefined {
  if (overrides?.minPubDate && typeof overrides.minPubDate === 'string') {
    return overrides.minPubDate
  }
  if (overrides?.recencyWeeks && Number.isFinite(overrides.recencyWeeks) && overrides.recencyWeeks > 0) {
    const now = new Date()
    const days = Math.floor(overrides.recencyWeeks * 7)
    now.setUTCDate(now.getUTCDate() - days)
    return now.toISOString().slice(0, 10)
  }
  return resolveMinPubDate(candidate)
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

function buildOfficialUrls(
  keywords: string[],
  siteFilters: string[],
  urls: string[] | undefined,
  minPubDate?: string
): QueryExpansionSuggestion[] {
  const suggestions: QueryExpansionSuggestion[] = []
  if (Array.isArray(urls)) {
    urls.forEach((directUrl) => {
      if (typeof directUrl !== 'string' || !directUrl.trim()) return
      suggestions.push({
        url: directUrl.trim(),
        sourceType: 'official',
        host: normaliseHost(directUrl),
        keywords,
        priorityOffset: 40,
        metadata: { origin: 'planner-official-direct' }
      })
    })
  }

  if (!keywords.length || !siteFilters.length) {
    return suggestions
  }

  const primary = keywords.slice(0, 3).join(' ')
  siteFilters.forEach((filterHost) => {
    const host = normaliseHost(filterHost)
    if (!host) return
    const googleSearch = new URL('https://www.google.com/search')
    googleSearch.searchParams.set('q', `${primary} site:${host}`)
    const cdMin = formatDateForQuery(minPubDate)
    if (cdMin) {
      googleSearch.searchParams.set('tbs', `cdr:1,cd_min:${cdMin}`)
      googleSearch.searchParams.set('cd_min', cdMin)
    }
    suggestions.push({
      url: googleSearch.toString(),
      sourceType: 'official',
      host,
      keywords: [primary],
      priorityOffset: 35,
      metadata: { feed: 'google-official-search' }
    })
  })

  return suggestions
}

function isDeepLinkUrl(urlString: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return false
  }

  const host = parsed.hostname.toLowerCase()
  if (SEARCH_HOST_ALLOWLIST.has(host)) {
    return true
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return false
  }

  const normalized = segments.map((segment) => segment.toLowerCase())
  if (normalized.every((segment) => HOMEPAGE_SEGMENTS.has(segment))) {
    return false
  }

  if (segments.length >= 2) {
    return true
  }

  const [first] = normalized
  if (first.includes('.')) {
    return true
  }
  if (/\d/.test(first) || first.length > 12 || first.includes('-')) {
    return true
  }

  return false
}

function shouldKeepSuggestion(suggestion: QueryExpansionSuggestion): boolean {
  return isDeepLinkUrl(suggestion.url)
}

export async function expandPlannerQuery({
  candidate,
  attempt,
  totalDequeues
}: QueryExpansionOptions): Promise<QueryExpansionResult> {
  const provider = candidate.provider as QueryProvider
  let suggestions: QueryExpansionSuggestion[] = []
  const hostCounts = new Map<string | null, number>()
  let deferredGeneral = false

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
      suggestions = await harvestWikipediaCitations(title)
      break
    }
    case 'query:official': {
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
      const urls = Array.isArray(parsed?.urls) ? parsed.urls : undefined
      const minPubDate = deriveMinPubDate(candidate, {
        recencyWeeks: Number(parsed?.recencyWeeks),
        minPubDate: typeof parsed?.minPubDate === 'string' ? parsed.minPubDate : undefined
      })
      buildOfficialUrls(keywords, siteFilters, urls, minPubDate).forEach(addSuggestion)
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
      const minPubDate = deriveMinPubDate(candidate, {
        recencyWeeks: Number(parsed?.recencyWeeks),
        minPubDate: typeof parsed?.minPubDate === 'string' ? parsed.minPubDate : undefined
      })

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

  suggestions = suggestions.filter(shouldKeepSuggestion)

  if (typeof totalDequeues === 'number' && totalDequeues < 30) {
    suggestions = suggestions.filter((suggestion) => !suggestion.host?.endsWith('wikipedia.org'))
  }

  if (provider !== 'query:wikipedia') {
    const nonWikiHosts = new Set(
      suggestions
        .map((suggestion) => suggestion.host)
        .filter((host): host is string => Boolean(host && !host.endsWith('wikipedia.org')))
    )

    if (suggestions.length > MAX_RESULTS_PER_QUERY) {
      suggestions = suggestions.slice(0, MAX_RESULTS_PER_QUERY)
    }

    if (suggestions.length < MIN_RESULTS_PER_QUERY || nonWikiHosts.size < 3) {
      deferredGeneral = true
      suggestions = []
    }
  } else {
    suggestions = suggestions.slice(0, MAX_RESULTS_PER_QUERY)
  }

  // Fallback: If no suggestions or fewer than 10, generate guaranteed fallback queries
  const MIN_SEEDS_PER_CYCLE = Number(process.env.CRAWL_MIN_SEEDS_PER_CYCLE || 10)
  const keywords = flattenKeywords(candidate.meta?.keywords ?? [])
  const topic = keywords[0] || (typeof candidate.cursor === 'string' ? candidate.cursor : '') || 'breaking news'
  
  if (topic && topic.trim() && (suggestions.length === 0 || suggestions.length < MIN_SEEDS_PER_CYCLE)) {
    const normalizedTopic = topic.trim()
    
    // Structured logging for fallback
    try {
      const { slog } = await import('@/lib/log')
      const { pushEvent } = await import('./eventRing')
      const logObj = {
        step: 'query_expand',
        result: 'fallback',
        job_id: candidate.meta?.patchId as string | undefined,
        run_id: candidate.meta?.runId as string | undefined,
        attempt,
        topic: normalizedTopic.slice(0, 100),
        existing_count: suggestions.length,
        target_count: MIN_SEEDS_PER_CYCLE,
      }
      slog('warn', logObj)
      pushEvent(logObj)
    } catch {
      // Non-fatal if logging fails
    }
    
    // Generate fallback queries using templated patterns (always emit ≥10)
    const fallbackTemplates = [
      `site:espn.com ${normalizedTopic}`,
      `site:nba.com ${normalizedTopic}`,
      `site:theathletic.com ${normalizedTopic}`,
      `site:basketball-reference.com ${normalizedTopic}`,
      `site:chicagotribune.com ${normalizedTopic}`,
      `${normalizedTopic} controversy`,
      `${normalizedTopic} history`,
      `${normalizedTopic} scandal`,
      `${normalizedTopic} trade rumor`,
      `${normalizedTopic} coach interview`,
    ]
    
    // Add site-specific queries first
    const siteQueries = [
      { site: 'espn.com', query: `site:espn.com ${normalizedTopic}` },
      { site: 'nba.com', query: `site:nba.com ${normalizedTopic}` },
      { site: 'theathletic.com', query: `site:theathletic.com ${normalizedTopic}` },
      { site: 'basketball-reference.com', query: `site:basketball-reference.com ${normalizedTopic}` },
      { site: 'chicagotribune.com', query: `site:chicagotribune.com ${normalizedTopic}` },
    ]
    
    for (const { site, query } of siteQueries) {
      if (suggestions.length >= MIN_SEEDS_PER_CYCLE) break
      const googleSearch = new URL('https://www.google.com/search')
      googleSearch.searchParams.set('q', query)
      googleSearch.searchParams.set('tbm', 'nws')
      suggestions.push({
        url: googleSearch.toString(),
        sourceType: 'fallback',
        host: normaliseHost(site),
        keywords: [normalizedTopic],
        priorityOffset: 5,
        metadata: { reason: 'fallback_seed', domain: site }
      })
    }
    
    // Add topic-variant queries
    const topicVariants = [
      `${normalizedTopic} controversy`,
      `${normalizedTopic} history`,
      `${normalizedTopic} scandal`,
      `${normalizedTopic} trade rumor`,
      `${normalizedTopic} coach interview`,
    ]
    
    for (const variant of topicVariants) {
      if (suggestions.length >= MIN_SEEDS_PER_CYCLE) break
      const googleSearch = new URL('https://www.google.com/search')
      googleSearch.searchParams.set('q', variant)
      googleSearch.searchParams.set('tbm', 'nws')
      suggestions.push({
        url: googleSearch.toString(),
        sourceType: 'fallback',
        host: null,
        keywords: [normalizedTopic],
        priorityOffset: 3,
        metadata: { reason: 'fallback_variant', variant }
      })
    }
    
    // Ensure we have at least MIN_SEEDS_PER_CYCLE
    if (suggestions.length < MIN_SEEDS_PER_CYCLE) {
      // Add generic topic queries to reach minimum
      const remaining = MIN_SEEDS_PER_CYCLE - suggestions.length
      for (let i = 0; i < remaining; i++) {
        const googleSearch = new URL('https://www.google.com/search')
        googleSearch.searchParams.set('q', normalizedTopic)
        googleSearch.searchParams.set('tbm', 'nws')
        if (i > 0) {
          googleSearch.searchParams.set('start', String(i * 10)) // Pagination
        }
        suggestions.push({
          url: googleSearch.toString(),
          sourceType: 'fallback',
          host: null,
          keywords: [normalizedTopic],
          priorityOffset: 0,
          metadata: { reason: 'fallback_generic', page: i + 1 }
        })
      }
    }
    
    // Log fallback success
    try {
      const { slog } = await import('@/lib/log')
      const { pushEvent } = await import('./eventRing')
      const logObj = {
        step: 'query_expand',
        result: 'fallback',
        job_id: candidate.meta?.patchId as string | undefined,
        run_id: candidate.meta?.runId as string | undefined,
        attempt,
        count: suggestions.length,
        topic: normalizedTopic.slice(0, 100),
      }
      slog('info', logObj)
      pushEvent(logObj)
    } catch {
      // Non-fatal
    }
  }

  // Log inputs safely (redact PII) - structured logging
  const keywords = flattenKeywords(candidate.meta?.keywords ?? [])
  const redactedKeywords = keywords.slice(0, 5).map(k => k.length > 20 ? k.substring(0, 20) + '...' : k)
  
  try {
    const { slog } = await import('@/lib/log')
    const { pushEvent } = await import('./eventRing')
    const logObj = {
      step: 'query_expand',
      result: suggestions.length > 0 ? 'ok' : 'empty',
      job_id: candidate.meta?.patchId as string | undefined,
      run_id: candidate.meta?.runId as string | undefined,
      provider,
      attempt,
      topic: redactedKeywords[0] || 'none',
      keywordCount: keywords.length,
      generated: suggestions.length,
    }
    slog('info', logObj)
    pushEvent(logObj)
  } catch {
    // Non-fatal if logging fails
    console.info('[queryExpander] Input summary:', {
      provider,
      topic: redactedKeywords[0] || 'none',
      keywordCount: keywords.length,
      hints: redactedKeywords.slice(0, 3),
      generated: suggestions.length
    })
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
  MIN_RESULTS_PER_QUERY,
  FIVE_MINUTES,
  THIRTY_MINUTES
}


