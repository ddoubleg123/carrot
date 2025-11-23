import { chatStream } from '@/lib/llm/providers/DeepSeekClient'
import { addToFrontier, FrontierItem, storeDiscoveryPlan } from '@/lib/redis/discovery'
import { createHash } from 'node:crypto'
import { URL } from 'node:url'

const DATA_HOST_PATH_EXCEPTIONS = new Set([
  'www.basketball-reference.com',
  'basketball-reference.com',
  'statmuse.com',
  'www.statmuse.com'
])

function getHost(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    return new URL(input).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isWikiHost(host: string | null | undefined): boolean {
  return Boolean(host && host.endsWith('wikipedia.org'))
}

function pathDepth(url: string): number {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return segments.length
  } catch {
    return 0
  }
}

function isDeepLink(url: string): boolean {
  const host = getHost(url)
  const depth = pathDepth(url)
  if (!host) return false
  if (DATA_HOST_PATH_EXCEPTIONS.has(host)) {
    return depth >= 1
  }
  return depth >= 2
}

export interface PlannerQueryAngle {
  angle: string
  whyItMatters: string
  quoteTargets: string[]
  signals?: string[]
  timeframe?: string
}

export type PlannerSeedCategory =
  | 'official'
  | 'intergovernmental'
  | 'watchdog'
  | 'academic'
  | 'media'
  | 'data'
  | 'wikipedia'
  | 'longform'
  | 'court'
  | 'UN'

export interface PlannerSeedVerification {
  numbers?: string[]
  dates?: string[]
  law?: string[]
  namesOrEntities?: string[]
}

export interface PlannerSeedCandidate {
  url: string
  titleGuess?: string
  category: PlannerSeedCategory
  angle: string
  expectedInsights?: string[]
  credibilityTier?: 1 | 2 | 3
  noveltySignals?: string[]
  isControversy?: boolean
  isHistory?: boolean
  notes?: string
  sourceType?: 'court' | 'UN' | 'official' | 'watchdog' | 'academic' | 'media' | 'data'
  stance?: 'establishment' | 'contested'
  whyItMatters?: string
  verification?: PlannerSeedVerification
  quotePullHints?: string[]
  priority?: 1 | 2 | 3
  alt?: string | null
  publishDateHint?: string
  isPrimaryOrOfficial?: boolean
}

export interface PlannerCoverageTargets {
  controversyRatio: number
  controversyWindow?: number
  historyInFirst?: number
  minNonMediaPerContested?: number
  maxPerDomain?: number
  minFreshnessDays?: number
  preferFreshWithinDays?: number
}

export interface PlannerQueries {
  wikipedia?: {
    sections?: string[]
    refsKeywords?: string[]
  }
  news?: {
    keywords?: string[][]
    siteFilters?: string[]
    recencyWeeks?: number
  }
  official?: {
    urls?: string[]
    siteFilters?: string[]
    recencyWeeks?: number
  }
  data?: {
    keywords?: string[][]
    siteFilters?: string[]
    recencyWeeks?: number
  }
  longform?: {
    keywords?: string[][]
    siteFilters?: string[]
    recencyWeeks?: number
  }
}

export interface DiscoveryPlan {
  topic: string
  aliases: string[]
  generatedAt: string
  mustTerms: string[]
  shouldTerms: string[]
  disallowTerms: string[]
  queryAngles: PlannerQueryAngle[]
  controversyAngles: PlannerQueryAngle[]
  historyAngles: PlannerQueryAngle[]
  coverageTargets: PlannerCoverageTargets
  queries?: PlannerQueries
  contentQueries: {
    wikipedia: Array<{ query: string; intent: 'sections' | 'refs'; notes?: string }>
    news: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    official: Array<{ url: string; notes?: string }>
    longform: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    data: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
  }
  seedCandidates: PlannerSeedCandidate[]
  contestedPlan?: Array<{
    claim: string
    supportingSources: string[]
    counterSources: string[]
    verificationFocus: string[]
  }>
  domainWhitelists?: {
    authority?: string[]
    referenceHubs?: string[]
    diversity?: string[]
  }
  fetchRules?: {
    maxPerDomain?: number
    preferSections?: boolean
    requireEntityMention?: string
    dedupe?: string[]
    timeoutMs?: number
    credibilityMix?: { tier1Min?: number; tier2Min?: number; tier3Max?: number }
    alternateIfPaywalled?: boolean
    respectRobotsTxt?: boolean
    maxWikiSeeds?: number
    minDistinctDomains?: number
  }
}

interface PlannerOptions {
  topic: string
  aliases: string[]
  description?: string
  patchId: string
  runId: string
}

const SYSTEM_PROMPT = `You are adjusting inputs for our existing discovery engine. Return STRICT JSON ONLY. Provide ≥10 directly fetchable seeds with an exact 5 establishment / 5 contested split. HARD REQUIREMENTS:
- At most ONE en.wikipedia.org seed; the remaining seeds must span ≥6 distinct non-wikipedia hosts.
- Seeds must be deep links (URL path depth ≥ 2 and not a homepage/section hub). Reject /news, /world, /section landing pages. Allow data-domain exceptions explicitly noted in the brief.
- Prefer recent sources (publish date ≤ 24 months) unless the seed is a primary/official historical document; include recency hints in metadata.
- Add 1–3 quotePullHints per seed (exact phrases visible on-page).
- Populate queries.news / queries.official / queries.data / queries.longform with non-wikipedia site filters and recency windows we can translate into site:… searches.
- For every contested claim, include at least one non-media authority (court, UN, official, NGO, academic) either as a seed or in contestedPlan.
Keep the output compact, precise, and ready to fetch immediately.`

function buildUserPrompt(topic: string, aliases: string[]): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  return `Topic: "${topic}"
 Aliases: ${aliasesCSV}
 
 We are not starting over. We need a precise, small plan that our current engine can fetch NOW. Enforce:
- coverageTargets.controversyRatio = 0.5 (exactly 5 'contested' + 5 'establishment'),
- minNonMediaPerContested = 1,
- maxPerDomain = 2,
- prefer recent (≤24 months) unless a primary/official record is stronger,
- seeds must be directly fetchable deep links (path depth ≥2, no homepages/section hubs); allow only declared data-domain exceptions,
- provide ≥10 seeds with ≥6 distinct non-wikipedia hosts and at most one wikipedia seed,
- populate queries.news / queries.official / queries.data / queries.longform with non-wikipedia site filters and recency windows,
- disallow travel/recipe/tourism/fiction.
 
 Return JSON with:
 {
   "topic": string,
   "aliases": string[] | null,
   "mustTerms": string[],                // canonical entity + aliases
   "shouldTerms": string[],              // adjacent entities/eras/keywords
   "disallowTerms": string[],
   "coverageTargets": {
     "controversyRatio": 0.5,
     "minNonMediaPerContested": 1,
     "maxPerDomain": 2,
     "minFreshnessDays": 0,
     "preferFreshWithinDays": 730
   },
   "queries": {
     "wikipedia": { "sections": string[], "refsKeywords": string[] },
     "news": { "keywords": string[][], "siteFilters": string[], "recencyWeeks": number },
     "official": { "urls": string[], "siteFilters": string[], "recencyWeeks": number },
     "data": { "keywords": string[][], "siteFilters": string[], "recencyWeeks": number },
     "longform": { "keywords": string[][], "siteFilters": string[], "recencyWeeks": number }
   },
   "seedCandidates": [
     {
       "url": string,
       "alt": string | null,
       "titleGuess": string,
       "sourceType": "court"|"UN"|"official"|"watchdog"|"academic"|"media"|"data",
       "angle": string,
       "stance": "establishment"|"contested",
       "whyItMatters": string,
       "expectedInsights": string[],
       "verification": {
         "numbers": string[],
         "dates": string[],
         "law": string[],
         "namesOrEntities": string[]
       },
       "quotePullHints": string[],
       "credibilityTier": 1|2|3,
       "noveltySignals": string[],
       "priority": 1|2|3,
       "publishDateHint": string,
       "isPrimaryOrOfficial": boolean
     }
   ],
   "contestedPlan": [
     {
       "claim": string,
       "supportingSources": string[],
       "counterSources": string[],
       "verificationFocus": string[]
     }
   ],
   "fetchRules": {
     "requireEntityMention": "title_or_body",
     "timeoutMs": 8000,
     "dedupe": ["canonicalUrl","simhash"],
     "preferSections": true,
     "alternateIfPaywalled": true,
     "respectRobotsTxt": true,
     "maxWikiSeeds": 1,
     "minDistinctDomains": 6
   }
 }`
}

async function collectStreamResponse(params: Parameters<typeof chatStream>[0]): Promise<string> {
  let response = ''
  for await (const chunk of chatStream(params)) {
    if (chunk.type === 'error') {
      throw new Error(chunk.error || 'DeepSeek planner error')
    }
    if (chunk.type === 'token' && chunk.token) {
      response += chunk.token
    }
  }
  return response
}

function sanitiseJsonPayload(payload: string): string {
  return payload
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

export function normaliseSeedCandidate(seed: PlannerSeedCandidate): PlannerSeedCandidate {
  if (!seed || typeof seed.url !== 'string' || !seed.url.trim()) {
    throw new Error('Invalid seed candidate: missing URL')
  }

  const url = seed.url.trim()
  const angle = typeof seed.angle === 'string' ? seed.angle.trim() : ''
  const stance: 'establishment' | 'contested' =
    seed.stance === 'contested' || seed.isControversy ? 'contested' : 'establishment'

  const mapSourceTypeToCategory = (sourceType?: PlannerSeedCandidate['sourceType']): PlannerSeedCategory => {
    switch (sourceType) {
      case 'court':
        return 'official'
      case 'UN':
        return 'intergovernmental'
      case 'official':
        return 'official'
      case 'watchdog':
        return 'watchdog'
      case 'academic':
        return 'academic'
      case 'data':
        return 'data'
      default:
        return seed.category || 'media'
    }
  }

  const category = mapSourceTypeToCategory(seed.sourceType)
  const credibilityTier =
    seed.credibilityTier === 1 || seed.credibilityTier === 2 || seed.credibilityTier === 3 ? seed.credibilityTier : undefined

  const normalisedVerification: PlannerSeedVerification | undefined = seed.verification
    ? {
        numbers: Array.isArray(seed.verification.numbers)
          ? seed.verification.numbers.map((value) => String(value).trim()).filter(Boolean)
          : undefined,
        dates: Array.isArray(seed.verification.dates)
          ? seed.verification.dates.map((value) => String(value).trim()).filter(Boolean)
          : undefined,
        law: Array.isArray(seed.verification.law)
          ? seed.verification.law.map((value) => String(value).trim()).filter(Boolean)
          : undefined,
        namesOrEntities: Array.isArray(seed.verification.namesOrEntities)
          ? seed.verification.namesOrEntities.map((value) => String(value).trim()).filter(Boolean)
          : undefined
      }
    : undefined

  const quotePullHints = Array.isArray(seed.quotePullHints)
    ? seed.quotePullHints
        .map((value) => String(value).trim())
        .filter(Boolean)
        .slice(0, 3)
    : undefined

  const expectedInsights = Array.isArray(seed.expectedInsights)
    ? seed.expectedInsights.map((value) => String(value).trim()).filter(Boolean)
    : undefined

  const noveltySignals = Array.isArray(seed.noveltySignals)
    ? seed.noveltySignals.map((value) => String(value).trim()).filter(Boolean)
    : undefined

  const notes = typeof seed.notes === 'string' && seed.notes.trim().length > 0 ? seed.notes.trim() : undefined
  const whyItMatters =
    typeof seed.whyItMatters === 'string' && seed.whyItMatters.trim().length > 0 ? seed.whyItMatters.trim() : notes

  const normalisedSeed: PlannerSeedCandidate = {
    url,
    titleGuess: typeof seed.titleGuess === 'string' ? seed.titleGuess.trim() : undefined,
    category,
    angle,
    expectedInsights,
    credibilityTier,
    noveltySignals,
    isControversy: stance === 'contested',
    isHistory:
      seed.isHistory ||
      /\bhistory\b|\btimeline\b|\bfounding\b/i.test(angle) ||
      Boolean(seed.noveltySignals?.some((signal) => /archival|history|timeline/i.test(String(signal)))),
    notes,
    sourceType: seed.sourceType,
    stance,
    whyItMatters,
    verification: normalisedVerification,
    quotePullHints,
    priority: seed.priority === 1 || seed.priority === 2 || seed.priority === 3 ? seed.priority : undefined,
    alt: typeof seed.alt === 'string' && seed.alt.trim().length > 0 ? seed.alt.trim() : null,
    publishDateHint:
      typeof seed.publishDateHint === 'string' && seed.publishDateHint.trim().length > 0
        ? seed.publishDateHint.trim()
        : undefined,
    isPrimaryOrOfficial: seed.isPrimaryOrOfficial === true
  }

  return normalisedSeed
}

interface PlanValidationResult {
  valid: boolean
  reason?: string
}

function distinctNonWikiHosts(seeds: PlannerSeedCandidate[]): Set<string> {
  const hosts = new Set<string>()
  seeds.forEach((seed) => {
    const host = getHost(seed.url)
    if (host && !isWikiHost(host)) {
      hosts.add(host)
    }
  })
  return hosts
}

function hasShallowSeeds(seeds: PlannerSeedCandidate[]): boolean {
  return seeds.some((seed) => !isDeepLink(seed.url))
}

function isDirectoryOrListingPage(url: string): boolean {
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
      /\/news\/?$/,  // /news or /news/ without article slug
      /\/articles\/?$/,  // /articles or /articles/ without article slug
      /\/blog\/?$/,  // /blog or /blog/ without article slug
      /\/sites\/[^\/]+\/?$/,  // /sites/section/ without article
      /\/sports\/[^\/]+\/?$/,  // /sports/category/ (single category level)
      /\/sports\/[^\/]+\/[^\/]+\/?$/,  // /sports/category/team/ (team directory)
      /\/nba\/[^\/]+\/?$/,  // /nba/category/ (single category level)
    ]
    
    if (directoryPatterns.some(pattern => pattern.test(pathname))) {
      return true
    }
    
    // Check if path looks like a listing (ends with category but no article slug)
    // e.g., /sports/nba/chicago-bulls/ (no article after)
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
      // Article slugs typically have dates, numbers, or specific identifiers
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

function hasDirectoryPages(seeds: PlannerSeedCandidate[]): boolean {
  return seeds.some((seed) => isDirectoryOrListingPage(seed.url))
}

function blockPopulated(block: { siteFilters?: unknown; urls?: unknown }): boolean {
  const siteFilters = Array.isArray(block?.siteFilters)
    ? block.siteFilters.map((value) => String(value).trim()).filter(Boolean)
    : []
  const urls = Array.isArray(block?.urls)
    ? block.urls.map((value) => String(value).trim()).filter(Boolean)
    : []
  const combined = [...siteFilters, ...urls]
  if (!combined.length) return false
  return combined.every((entry) => !/wikipedia\.org/i.test(entry))
}

function validatePlan(plan: DiscoveryPlan): PlanValidationResult {
  const seeds = Array.isArray(plan.seedCandidates) ? plan.seedCandidates : []
  if (seeds.length < 10) {
    return { valid: false, reason: 'min_seed_count' }
  }

  const wikiSeedCount = seeds.filter((seed) => isWikiHost(getHost(seed.url))).length
  if (wikiSeedCount > 1) {
    return { valid: false, reason: 'excess_wiki_seeds' }
  }

  const nonWikiHosts = distinctNonWikiHosts(seeds)
  if (nonWikiHosts.size < 6) {
    return { valid: false, reason: 'insufficient_non_wiki_hosts' }
  }

  if (hasShallowSeeds(seeds)) {
    return { valid: false, reason: 'shallow_seed_detected' }
  }

  if (hasDirectoryPages(seeds)) {
    return { valid: false, reason: 'directory_page_detected' }
  }

  const queries = plan.queries ?? {}
  if (!blockPopulated(queries.news ?? {})) {
    return { valid: false, reason: 'news_queries_unpopulated' }
  }
  if (!blockPopulated(queries.official ?? {})) {
    return { valid: false, reason: 'official_queries_unpopulated' }
  }
  if (!blockPopulated(queries.data ?? {})) {
    return { valid: false, reason: 'data_queries_unpopulated' }
  }
  if (!blockPopulated(queries.longform ?? {})) {
    return { valid: false, reason: 'longform_queries_unpopulated' }
  }

  return { valid: true }
}

export const __validatePlannerPlan = validatePlan

export function ensurePlanDefaults(plan: Partial<DiscoveryPlan>, fallback: DiscoveryPlan): DiscoveryPlan {
  const generatedAt = typeof plan.generatedAt === 'string' ? plan.generatedAt : new Date().toISOString()
  const aliases =
    Array.isArray(plan.aliases) && plan.aliases.length
      ? plan.aliases.filter((value): value is string => typeof value === 'string')
      : fallback.aliases

  const controversyAngles =
    Array.isArray(plan.controversyAngles) && plan.controversyAngles.length
      ? (plan.controversyAngles as PlannerQueryAngle[])
      : fallback.controversyAngles

  const historyAngles =
    Array.isArray(plan.historyAngles) && plan.historyAngles.length
      ? (plan.historyAngles as PlannerQueryAngle[])
      : fallback.historyAngles

  const coverageTargets: PlannerCoverageTargets = (() => {
    const baseline: PlannerCoverageTargets = fallback.coverageTargets || {
      controversyRatio: 0.5,
      controversyWindow: 4,
      historyInFirst: 3,
      minNonMediaPerContested: 1,
      maxPerDomain: 2,
      minFreshnessDays: 0,
      preferFreshWithinDays: 1095
    }
    const source = typeof plan.coverageTargets === 'object' && plan.coverageTargets ? plan.coverageTargets : undefined
    return {
      controversyRatio: Number((source as any)?.controversyRatio ?? baseline.controversyRatio ?? 0.5),
      controversyWindow: Number((source as any)?.controversyWindow ?? baseline.controversyWindow ?? 4),
      historyInFirst: Number((source as any)?.historyInFirst ?? baseline.historyInFirst ?? 3),
      minNonMediaPerContested: Number((source as any)?.minNonMediaPerContested ?? baseline.minNonMediaPerContested ?? 1),
      maxPerDomain: Number((source as any)?.maxPerDomain ?? baseline.maxPerDomain ?? 2),
      minFreshnessDays: Number((source as any)?.minFreshnessDays ?? baseline.minFreshnessDays ?? 0),
      preferFreshWithinDays: Number((source as any)?.preferFreshWithinDays ?? baseline.preferFreshWithinDays ?? 1095)
    }
  })()

  const normaliseList = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined
    const items = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : typeof entry === 'number' ? String(entry).trim() : undefined))
      .filter((entry): entry is string => Boolean(entry && entry.length > 0))
    return items.length ? items : undefined
  }

  const normaliseMatrix = (value: unknown): string[][] | undefined => {
    if (!Array.isArray(value)) return undefined
    const matrix = value
      .map((row) => {
        if (Array.isArray(row)) {
          return row.map((entry) => String(entry).trim()).filter(Boolean)
        }
        if (typeof row === 'string') {
          return [row.trim()].filter(Boolean)
        }
        return []
      })
      .filter((row) => row.length > 0)
    return matrix.length ? matrix : undefined
  }

  const extractSiteFilters = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined
    const collected: unknown[] = []
    for (const entry of value) {
      if (entry && typeof entry === 'object') {
        const siteFilters = (entry as { siteFilters?: unknown }).siteFilters
        if (Array.isArray(siteFilters)) {
          collected.push(...siteFilters)
        }
      }
    }
    return normaliseList(collected)
  }

  const queries: PlannerQueries = {
    wikipedia: {
      sections:
        normaliseList(plan.queries?.wikipedia?.sections) ??
        plan.contentQueries?.wikipedia?.map((item) => item.query).filter(Boolean) ??
        fallback.queries?.wikipedia?.sections ??
        [],
      refsKeywords:
        normaliseList(plan.queries?.wikipedia?.refsKeywords) ?? fallback.queries?.wikipedia?.refsKeywords ?? []
    },
    news: {
      keywords:
        normaliseMatrix(plan.queries?.news?.keywords) ??
        fallback.queries?.news?.keywords ??
        normaliseMatrix(
          plan.contentQueries?.news?.map((item) => item.keywords).filter(Boolean) as unknown as string[][]
        ) ??
        [],
      siteFilters:
        normaliseList(plan.queries?.news?.siteFilters) ??
        extractSiteFilters(plan.contentQueries?.news) ??
        fallback.queries?.news?.siteFilters ??
        []
    },
    official: {
      urls:
        normaliseList(plan.queries?.official?.urls) ??
        plan.contentQueries?.official?.map((item) => item.url).filter(Boolean) ??
        fallback.queries?.official?.urls ??
        [],
      siteFilters:
        normaliseList(plan.queries?.official?.siteFilters) ??
        extractSiteFilters(plan.contentQueries?.official) ??
        fallback.queries?.official?.siteFilters ??
        [],
      recencyWeeks:
        typeof plan.queries?.official?.recencyWeeks === 'number'
          ? plan.queries.official.recencyWeeks
          : typeof fallback.queries?.official?.recencyWeeks === 'number'
          ? fallback.queries.official.recencyWeeks
          : undefined
    },
    data: {
      keywords:
        normaliseMatrix(plan.queries?.data?.keywords) ??
        fallback.queries?.data?.keywords ??
        normaliseMatrix(
          plan.contentQueries?.data?.map((item) => item.keywords).filter(Boolean) as unknown as string[][]
        ) ??
        [],
      siteFilters:
        normaliseList(plan.queries?.data?.siteFilters) ??
        extractSiteFilters(plan.contentQueries?.data) ??
        fallback.queries?.data?.siteFilters ??
        [],
      recencyWeeks:
        typeof plan.queries?.data?.recencyWeeks === 'number'
          ? plan.queries.data.recencyWeeks
          : typeof fallback.queries?.data?.recencyWeeks === 'number'
          ? fallback.queries.data.recencyWeeks
          : undefined
    },
    longform: {
      keywords:
        normaliseMatrix(plan.queries?.longform?.keywords) ??
        fallback.queries?.longform?.keywords ??
        normaliseMatrix(
          plan.contentQueries?.longform?.map((item) => item.keywords).filter(Boolean) as unknown as string[][]
        ) ??
        [],
      siteFilters:
        normaliseList(plan.queries?.longform?.siteFilters) ??
        extractSiteFilters(plan.contentQueries?.longform) ??
        fallback.queries?.longform?.siteFilters ??
        [],
      recencyWeeks:
        typeof plan.queries?.longform?.recencyWeeks === 'number'
          ? plan.queries.longform.recencyWeeks
          : typeof fallback.queries?.longform?.recencyWeeks === 'number'
          ? fallback.queries.longform.recencyWeeks
          : undefined
    }
  }

  const seedCandidates: PlannerSeedCandidate[] =
    Array.isArray(plan.seedCandidates) && plan.seedCandidates.length
      ? (plan.seedCandidates as PlannerSeedCandidate[]).map((seed) => {
          try {
            return normaliseSeedCandidate(seed)
          } catch (error) {
            console.warn('[Planner] Dropping invalid seed candidate', seed, error)
            return null
          }
        }).filter((seed): seed is PlannerSeedCandidate => Boolean(seed))
      : fallback.seedCandidates

  const result: DiscoveryPlan = {
    topic: plan.topic ?? fallback.topic,
    aliases,
    generatedAt,
    mustTerms:
      Array.isArray(plan.mustTerms) && plan.mustTerms.length ? plan.mustTerms.map((term) => term.trim()) : fallback.mustTerms,
    shouldTerms:
      Array.isArray(plan.shouldTerms) && plan.shouldTerms.length
        ? plan.shouldTerms.map((term) => term.trim())
        : fallback.shouldTerms,
    disallowTerms:
      Array.isArray(plan.disallowTerms) && plan.disallowTerms.length
        ? plan.disallowTerms.map((term) => term.trim())
        : fallback.disallowTerms,
    queryAngles: plan.queryAngles?.length ? (plan.queryAngles as PlannerQueryAngle[]) : fallback.queryAngles,
    controversyAngles,
    historyAngles,
    coverageTargets,
    queries,
    contentQueries: {
      wikipedia: plan.contentQueries?.wikipedia || fallback.contentQueries.wikipedia,
      news: plan.contentQueries?.news || fallback.contentQueries.news,
      official: plan.contentQueries?.official || fallback.contentQueries.official,
      longform: plan.contentQueries?.longform || fallback.contentQueries.longform,
      data: plan.contentQueries?.data || fallback.contentQueries.data
    },
    seedCandidates,
    domainWhitelists: plan.domainWhitelists || fallback.domainWhitelists,
    fetchRules: {
      ...fallback.fetchRules,
      ...plan.fetchRules
    }
  }

  const validation = validatePlan(result)
  if (!validation.valid) {
    console.warn(
      `[DiscoveryPlanner] plan validation failed (${validation.reason ?? 'unknown'}) – using fallback plan`
    )
    return fallback
  }

  return result
}

type SeedBlueprint = Omit<PlannerSeedCandidate, 'url'> & { url: string }

function buildChicagoBullsFallbackSeeds(topic: string): PlannerSeedCandidate[] {
  const blueprints: SeedBlueprint[] = [
    {
      url: 'https://www.espn.com/nba/team/_/name/chi/chicago-bulls',
      category: 'media',
      sourceType: 'media',
      angle: 'Season outlook and roster health',
      stance: 'establishment',
      whyItMatters: 'Tracks current roster moves, injuries, and coaching adjustments',
      expectedInsights: ['injury status', 'roster depth'],
      quotePullHints: ['Chicago Bulls depth chart'],
      credibilityTier: 2,
      noveltySignals: ['2024 season'],
      priority: 1,
      verification: { namesOrEntities: ['Chicago Bulls roster'], dates: ['2024'] }
    },
    {
      url: 'https://www.basketball-reference.com/teams/CHI/',
      category: 'data',
      sourceType: 'data',
      angle: 'Historical performance and advanced metrics',
      stance: 'establishment',
      whyItMatters: 'Provides authoritative historical and statistical context',
      expectedInsights: ['season-by-season results', 'advanced metrics'],
      quotePullHints: ['franchise history'],
      credibilityTier: 1,
      noveltySignals: ['historical record'],
      isHistory: true,
      priority: 1,
      verification: { namesOrEntities: ['Chicago Bulls'], numbers: ['1610612741'] }
    },
    {
      url: 'https://theathletic.com/nba/team/bulls/',
      category: 'watchdog',
      sourceType: 'watchdog',
      angle: 'Investigative coverage and locker-room dynamics',
      stance: 'contested',
      whyItMatters: 'Highlights debates around management decisions and player roles',
      expectedInsights: ['front office scrutiny', 'player concerns'],
      quotePullHints: ['inside the Bulls'],
      credibilityTier: 2,
      noveltySignals: ['2024'],
      isControversy: true,
      priority: 2,
      verification: { namesOrEntities: ['Artūras Karnišovas', 'Billy Donovan'] }
    },
    {
      url: 'https://www.chicagotribune.com/sports/bulls/',
      category: 'media',
      sourceType: 'media',
      angle: 'Local reporting and community impact',
      stance: 'contested',
      whyItMatters: 'Captures local criticism and fan sentiment impacting ownership decisions',
      expectedInsights: ['community impact', 'ownership pressure'],
      quotePullHints: ['Bulls fans'],
      credibilityTier: 2,
      noveltySignals: ['local coverage'],
      isControversy: true,
      priority: 2,
      verification: { namesOrEntities: ['Chicago Bulls fans'] }
    },
    {
      url: 'https://apnews.com/hub/chicago-bulls',
      category: 'media',
      sourceType: 'media',
      angle: 'Wire coverage and breaking news',
      stance: 'establishment',
      whyItMatters: 'Delivers impartial updates on transactions and league decisions',
      expectedInsights: ['transactions', 'league rulings'],
      quotePullHints: ['according to AP'],
      credibilityTier: 1,
      noveltySignals: ['breaking news'],
      priority: 2,
      verification: { namesOrEntities: ['NBA'], dates: ['2024'] }
    },
    {
      url: 'https://www.nba.com/bulls/news',
      category: 'official',
      sourceType: 'official',
      angle: 'Official announcements and press releases',
      stance: 'establishment',
      whyItMatters: 'Provides official statements and policy changes directly from the franchise',
      expectedInsights: ['official announcements'],
      quotePullHints: ['according to the Bulls'],
      credibilityTier: 1,
      noveltySignals: ['official release'],
      isPrimaryOrOfficial: true,
      priority: 1,
      verification: { namesOrEntities: ['Chicago Bulls'], dates: ['2024'] }
    },
    {
      url: 'https://www.nba.com/stats/team/1610612741',
      category: 'official',
      sourceType: 'official',
      angle: 'Official advanced stats and tracking',
      stance: 'establishment',
      whyItMatters: 'Tracks league-certified advanced metrics for the Bulls',
      expectedInsights: ['advanced metrics', 'lineup efficiencies'],
      quotePullHints: ['NBA tracking data'],
      credibilityTier: 1,
      noveltySignals: ['tracking data'],
      isPrimaryOrOfficial: true,
      priority: 2,
      verification: { namesOrEntities: ['1610612741'], numbers: ['1610612741'] }
    },
    {
      url: 'https://www.forbes.com/sites/sportsmoney/',
      category: 'media',
      sourceType: 'media',
      angle: 'Business and valuation scrutiny',
      stance: 'contested',
      whyItMatters: 'Analyses ownership decisions, revenue, and market pressures',
      expectedInsights: ['franchise valuation', 'revenue trends'],
      quotePullHints: ['valuation'],
      credibilityTier: 2,
      noveltySignals: ['financial analysis'],
      isControversy: true,
      priority: 3,
      verification: { namesOrEntities: ['Jerry Reinsdorf'], numbers: ['2024 valuation'] }
    },
    {
      url: 'https://www.nbcchicago.com/tag/chicago-bulls/',
      category: 'media',
      sourceType: 'media',
      angle: 'Local broadcast investigations',
      stance: 'contested',
      whyItMatters: 'Documents local criticism, community impact, and player reactions',
      expectedInsights: ['player sentiment', 'community impact'],
      quotePullHints: ['NBC Chicago reports'],
      credibilityTier: 2,
      noveltySignals: ['local tv'],
      isControversy: true,
      priority: 3,
      verification: { namesOrEntities: ['NBC Chicago'] }
    },
    {
      url: 'https://www.statmuse.com/nba/team/chicago-bulls',
      category: 'data',
      sourceType: 'data',
      angle: 'On-demand stats queries',
      stance: 'contested',
      whyItMatters: 'Enables contested narratives backed by granular numbers and comparisons',
      expectedInsights: ['custom stats queries'],
      quotePullHints: ['StatMuse answers'],
      credibilityTier: 2,
      noveltySignals: ['interactive data'],
      isControversy: true,
      priority: 3,
      verification: { namesOrEntities: ['StatMuse'], numbers: ['2024'] }
    }
  ]

  const wikiSeed = normaliseSeedCandidate({
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
    titleGuess: `${topic} — overview`,
    category: 'wikipedia',
    angle: 'foundational history',
    expectedInsights: ['key facts', 'timeline'],
    credibilityTier: 2,
    noveltySignals: ['reference'],
    isControversy: false,
    isHistory: true,
    stance: 'establishment',
    priority: 1,
    whyItMatters: 'Baseline article with references and history',
    notes: 'planner_seed',
    quotePullHints: ['professional basketball team'],
    verification: {
      namesOrEntities: ['Chicago Bulls', 'NBA'],
      dates: ['1966']
    }
  })

  const nonWikiSeeds = blueprints.map((seed) =>
    normaliseSeedCandidate({
      ...seed,
      notes: seed.notes ?? 'planner_seed'
    })
  )

  return [wikiSeed, ...nonWikiSeeds]
}

function buildGenericFallbackSeeds(topic: string): PlannerSeedCandidate[] {
  const wikiSeed = normaliseSeedCandidate({
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
    titleGuess: `${topic} — overview`,
    category: 'wikipedia',
    angle: 'foundational history',
    expectedInsights: ['key facts', 'timeline'],
    credibilityTier: 2,
    noveltySignals: ['reference'],
    isControversy: false,
    isHistory: true,
    stance: 'establishment',
    priority: 1,
    whyItMatters: 'Baseline article with references and history',
    notes: 'planner_seed',
    quotePullHints: ['baseline history'],
    verification: {
      namesOrEntities: [topic]
    }
  })

  return [wikiSeed]
}

function buildFallbackPlan(topic: string, aliases: string[]): DiscoveryPlan {
  const generatedAt = new Date().toISOString()
  const mustTerms = [topic, ...aliases].filter(Boolean)
  const isChicagoBulls = /chicago\s+bulls/i.test(topic)
  const seeds = isChicagoBulls ? buildChicagoBullsFallbackSeeds(topic) : buildGenericFallbackSeeds(topic)

  return {
    topic,
    aliases,
    generatedAt,
    mustTerms,
    shouldTerms: aliases,
    disallowTerms: ['travel', 'recipe', 'tourism', 'fiction'],
    queryAngles: [
      {
        angle: 'foundational history',
        whyItMatters: 'Provides baseline facts and official record',
        quoteTargets: ['official statements', 'primary documents'],
        signals: ['timeline', 'founding documents'],
        timeframe: 'founding'
      },
      {
        angle: 'modern performance and strategy',
        whyItMatters: 'Captures present-day data-driven narratives',
        quoteTargets: ['advanced metrics dashboards', 'press conferences'],
        signals: ['advanced stats', 'strategy'],
        timeframe: 'recent'
      }
    ],
    controversyAngles: [
      {
        angle: 'Front office debates and ownership pressure',
        whyItMatters: 'Captures contested viewpoints around leadership decisions',
        quoteTargets: ['investigative features', 'financial analysis'],
        signals: ['management scrutiny', 'roster criticism'],
        timeframe: 'recent'
      }
    ],
    historyAngles: [
      {
        angle: 'Formative milestones',
        whyItMatters: 'Identify moments that shaped the topic historically',
        quoteTargets: ['archived coverage', 'primary documents'],
        signals: ['legacy', 'founding'],
        timeframe: 'pre-2000'
      }
    ],
    coverageTargets: {
      controversyRatio: 0.5,
      controversyWindow: 4,
      historyInFirst: 3,
      minNonMediaPerContested: 1,
      maxPerDomain: 2,
      minFreshnessDays: 0,
      preferFreshWithinDays: 730
    },
    queries: {
      wikipedia: {
        sections: ['History', 'Season-by-season performance'],
        refsKeywords: ['Chicago Bulls external links']
      },
      news: {
        keywords: [[topic, 'season'], [topic, 'trade']],
        siteFilters: ['espn.com', 'chicagotribune.com', 'nbcchicago.com', 'apnews.com'],
        recencyWeeks: 24
      },
      official: {
        urls: ['https://www.nba.com/bulls/news'],
        siteFilters: ['nba.com'],
        recencyWeeks: 24
      },
      data: {
        keywords: [[topic, 'advanced stats'], [topic, 'historical metrics']],
        siteFilters: ['basketball-reference.com', 'statmuse.com', 'nba.com/stats'],
        recencyWeeks: 24
      },
      longform: {
        keywords: [[topic, 'analysis'], [topic, 'ownership']],
        siteFilters: ['theathletic.com', 'forbes.com'],
        recencyWeeks: 52
      }
    },
    contentQueries: {
      wikipedia: [
        { query: 'History', intent: 'sections' },
        { query: 'References', intent: 'refs' }
      ],
      news: [{ keywords: [topic, 'season outlook'], notes: 'headlines' }],
      official: [{ url: 'https://www.nba.com/bulls/news', notes: 'press' }],
      longform: [{ keywords: [topic, 'deep analysis'], notes: 'features' }],
      data: [{ keywords: [topic, 'statistics'], notes: 'metrics' }]
    },
    seedCandidates: seeds,
    domainWhitelists: {
      authority: ['nba.com'],
      referenceHubs: ['basketball-reference.com', 'statmuse.com']
    },
    fetchRules: {
      maxPerDomain: 2,
      preferSections: true,
      requireEntityMention: 'title_or_body',
      dedupe: ['canonicalUrl', 'simhash'],
      timeoutMs: 8000,
      credibilityMix: { tier1Min: 2, tier2Min: 4, tier3Max: 4 },
      alternateIfPaywalled: true,
      respectRobotsTxt: true,
      maxWikiSeeds: 1,
      minDistinctDomains: 6
    }
  }
}

function computeSeedPriority(seed: PlannerSeedCandidate, index: number, domainWhitelists?: DiscoveryPlan['domainWhitelists']): number {
  let priority = 100 - index * 2

  switch (seed.priority) {
    case 1:
      priority += 320
      break
    case 2:
      priority += 220
      break
    case 3:
      priority += 140
      break
    default:
      break
  }

  switch (seed.credibilityTier) {
    case 1:
      priority += 40
      break
    case 2:
      priority += 20
      break
    case 3:
      priority += 8
      break
    default:
      break
  }

  const sourceType = seed.sourceType || seed.category
  if (sourceType) {
    switch (sourceType) {
      case 'court':
      case 'official':
        priority += 45
        break
      case 'UN':
      case 'intergovernmental':
        priority += 40
        break
      case 'watchdog':
      case 'academic':
        priority += 30
        break
      case 'data':
        priority += 25
        break
      case 'longform':
      case 'media':
      default:
        priority += 10
        break
    }
  }

  if (seed.noveltySignals?.some((signal) => /202[3-9]/.test(signal))) {
    priority += 12
  }

  if (seed.stance === 'contested' || seed.isControversy) {
    priority += 18
  }

  if (seed.isHistory) {
    priority += 6
  }

  try {
    const domain = new URL(seed.url).hostname.toLowerCase()
    if (domainWhitelists?.authority?.some((w) => domain.endsWith(w.replace(/^[*.]+/, '')))) {
      priority += 14
    } else if (domainWhitelists?.referenceHubs?.some((w) => domain.endsWith(w.replace(/^[*.]+/, '')))) {
      priority += 8
    }
  } catch {
    // ignore malformed URLs
  }

  return priority
}

async function buildGuideSnapshot(topic: string, aliases: string[]): Promise<DiscoveryPlan> {
  const fallback = buildFallbackPlan(topic, aliases)
  try {
    const userPrompt = buildUserPrompt(topic, aliases)
    const patchIdForLog = (() => {
      const candidate = (globalThis as { patchId?: unknown })?.patchId
      return typeof candidate === 'string' ? candidate : '(n/a)'
    })()
    console.info(
      `[DISCOVERY_V2][PLANNER_PROMPT] patch=${patchIdForLog} sysHash=${createHash('sha256')
        .update(SYSTEM_PROMPT)
        .digest('hex')} userHash=${createHash('sha256').update(userPrompt).digest('hex')} sysHead="${SYSTEM_PROMPT.slice(0, 120).replace(/\s+/g, ' ')}" userHead="${userPrompt
        .slice(0, 120)
        .replace(/\s+/g, ' ')}"`
    )
    const response = await collectStreamResponse({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2800
    })

    const cleaned = sanitiseJsonPayload(response)
    const parsed = JSON.parse(cleaned) as Partial<DiscoveryPlan>
    return ensurePlanDefaults(parsed, fallback)
  } catch (error) {
    console.error('[DiscoveryPlanner] DeepSeek planner failed, using fallback plan', error)
    return fallback
  }
}

export async function generateGuideSnapshot(topic: string, aliases: string[]): Promise<DiscoveryPlan> {
  return buildGuideSnapshot(topic, aliases)
}

export async function generateDiscoveryPlan(options: PlannerOptions): Promise<DiscoveryPlan> {
  const { topic, aliases, patchId, runId } = options
  const plan = await buildGuideSnapshot(topic, aliases)

  await storeDiscoveryPlan(runId, plan)
  await seedFrontierFromPlan(patchId, plan)

  return plan
}

export const __plannerPrompts = {
  SYSTEM_PROMPT,
  buildUserPrompt
}

/**
 * Generate fallback domain pack for sports/basketball topics
 */
function generateFallbackDomainPack(topic: string, aliases: string[]): PlannerSeedCandidate[] {
  const topicLower = topic.toLowerCase()
  const isBasketball = topicLower.includes('bulls') || topicLower.includes('basketball') || topicLower.includes('nba')
  
  if (!isBasketball) {
    // Generic fallback for other topics
    return [
      { url: `https://www.wikipedia.org/wiki/${encodeURIComponent(topic)}`, category: 'wikipedia', angle: 'Overview', priority: 1 },
      { url: `https://www.reuters.com/search?q=${encodeURIComponent(topic)}`, category: 'media', angle: 'News', priority: 2 },
      { url: `https://apnews.com/search?q=${encodeURIComponent(topic)}`, category: 'media', angle: 'News', priority: 2 },
    ] as PlannerSeedCandidate[]
  }
  
  // Basketball-specific domain pack
  const fallbackSeeds: PlannerSeedCandidate[] = [
    { url: 'https://www.nba.com/bulls/news', category: 'official', angle: 'Official news', priority: 1, sourceType: 'official' },
    { url: 'https://www.espn.com/nba/team/_/name/chi/chicago-bulls', category: 'media', angle: 'Team coverage', priority: 1 },
    { url: 'https://www.nbcsports.com/chicago/bulls', category: 'media', angle: 'Local coverage', priority: 2 },
    { url: 'https://chicago.suntimes.com/bulls', category: 'media', angle: 'Local news', priority: 2 },
    { url: 'https://www.chicagotribune.com/sports/bulls', category: 'media', angle: 'Local news', priority: 2 },
    { url: 'https://www.theathletic.com/nba/team/chicago-bulls', category: 'longform', angle: 'Analysis', priority: 2 },
    { url: 'https://bleacherreport.com/chicago-bulls', category: 'media', angle: 'Fan coverage', priority: 3 },
    { url: 'https://www.sbnation.com/chicago-bulls', category: 'media', angle: 'Fan coverage', priority: 3 },
    { url: 'https://www.cbssports.com/nba/teams/CHI/chicago-bulls', category: 'media', angle: 'News', priority: 3 },
    { url: 'https://sports.yahoo.com/nba/teams/chicago-bulls', category: 'media', angle: 'News', priority: 3 },
  ]
  
  return fallbackSeeds
}

export async function seedFrontierFromPlan(patchId: string, plan: DiscoveryPlan): Promise<void> {
  const MIN_SEEDS = 10
  const MIN_UNIQUE_DOMAINS = 5
  
  let seedsSorted: PlannerSeedCandidate[] = []
  if (Array.isArray(plan.seedCandidates) && plan.seedCandidates.length > 0) {
    seedsSorted = [...plan.seedCandidates].sort((a, b) => {
      const priorityA = a.priority ?? 999
      const priorityB = b.priority ?? 999
      if (priorityA !== priorityB) return priorityA - priorityB
      return 0
    })
  }
  
  // If planner returned insufficient seeds, add fallback domain pack
  if (seedsSorted.length < MIN_SEEDS) {
    const fallbackSeeds = generateFallbackDomainPack(plan.topic, plan.aliases || [])
    console.warn(`[Seed Planner] Only ${seedsSorted.length} seeds from planner, adding ${fallbackSeeds.length} fallback seeds`)
    seedsSorted = [...seedsSorted, ...fallbackSeeds]
  }

  const domainCounts = new Map<string, number>()
  const selectedSeeds: PlannerSeedCandidate[] = []
  let contestedCount = 0
  let establishmentCount = 0

  // First pass: prioritize diversity (up to 3 per domain until we have 5+ unique domains)
  for (const seed of seedsSorted) {
    if (!seed || !seed.url) continue
    const isContested = seed.stance === 'contested' || seed.isControversy === true
    if (isContested) {
      if (contestedCount >= 5) continue
    } else if (establishmentCount >= 5) {
      continue
    }

    let domain = 'unknown'
    try {
      domain = new URL(seed.url).hostname.toLowerCase()
    } catch {
      // ignore malformed hostnames
      continue
    }

    const currentCount = domainCounts.get(domain) ?? 0
    const uniqueDomainCount = domainCounts.size
    
    // Dynamic domain limit: allow more per domain until we reach MIN_UNIQUE_DOMAINS
    const domainLimit = uniqueDomainCount < MIN_UNIQUE_DOMAINS ? 3 : 2
    if (currentCount >= domainLimit) {
      continue
    }

    domainCounts.set(domain, currentCount + 1)
    selectedSeeds.push(seed as PlannerSeedCandidate)
    if (isContested) contestedCount++
    else establishmentCount++

    // Continue until we have MIN_SEEDS AND MIN_UNIQUE_DOMAINS
    if (selectedSeeds.length >= MIN_SEEDS && uniqueDomainCount + 1 >= MIN_UNIQUE_DOMAINS) {
      break
    }
  }

  const finalUniqueDomainCount = domainCounts.size
  
  // Log warning if diversity is low, but don't fail
  if (finalUniqueDomainCount < MIN_UNIQUE_DOMAINS) {
    console.warn(`[Seed Planner] seed_frontier_warn: Only ${finalUniqueDomainCount} unique domains (target: ${MIN_UNIQUE_DOMAINS}), but proceeding with ${selectedSeeds.length} seeds`)
  } else {
    console.log(`[Seed Planner] ✅ Generated ${selectedSeeds.length} seeds from ${finalUniqueDomainCount} unique domains`)
  }

  if (!selectedSeeds.length) {
    console.warn('[Seed Planner] No seeds selected, discovery may stall')
    return
  }

  const tasks: Array<Promise<void>> = []

  selectedSeeds.forEach((seed, index) => {
    if (!seed.url) return

    const item: FrontierItem = {
      id: `direct_seed:${Date.now()}:${index}:${seed.url}`,
      provider: 'direct',
      cursor: seed.url,
      priority: computeSeedPriority(seed, index, plan.domainWhitelists),
      angle: seed.angle,
      meta: {
        directSeed: true,
        planPriority: seed.priority,
        category: seed.category,
        expectedInsights: seed.expectedInsights,
        credibilityTier: seed.credibilityTier,
        noveltySignals: seed.noveltySignals,
        isControversy: seed.isControversy ?? seed.stance === 'contested',
        isHistory: seed.isHistory,
        notes: seed.notes,
        titleGuess: seed.titleGuess,
        stance: seed.stance ?? (seed.isControversy ? 'contested' : 'establishment'),
        verification: seed.verification,
        quotePullHints: seed.quotePullHints,
        sourceType: seed.sourceType,
        whyItMatters: seed.whyItMatters,
        publishDateHint: seed.publishDateHint,
        isPrimaryOrOfficial: seed.isPrimaryOrOfficial
      }
    }

    tasks.push(addToFrontier(patchId, item))
  })

  await Promise.all(tasks)
  await enqueueQueriesFromPlan(patchId, plan)
}

function scoreQuery(type: 'wikipedia' | 'news' | 'official' | 'longform' | 'data', index: number): number {
  const base = {
    wikipedia: 240,
    news: 210,
    official: 260,
    longform: 200,
    data: 220
  }[type]

  return base - index * 5
}

async function enqueueQueriesFromPlan(patchId: string, plan: DiscoveryPlan): Promise<void> {
  const tasks: Array<Promise<void>> = []

  if (Array.isArray(plan.contentQueries?.wikipedia)) {
    plan.contentQueries.wikipedia.forEach((query, index) => {
      tasks.push(
        addToFrontier(patchId, {
          id: `query:wikipedia:${index}:${query.query}`,
          provider: 'query:wikipedia',
          cursor: query.query,
          priority: scoreQuery('wikipedia', index),
          angle: query.notes,
          meta: {
            intent: query.intent,
            notes: query.notes,
            sourceType: 'wikipedia',
            reason: 'planner_seed',
            planIndex: index
          }
        })
      )
    })
  }

  if (Array.isArray(plan.contentQueries?.news)) {
    plan.contentQueries.news.forEach((query, index) => {
      tasks.push(
        addToFrontier(patchId, {
          id: `query:news:${index}:${query.keywords.join('+')}`,
          provider: 'query:news',
          cursor: JSON.stringify(query),
          priority: scoreQuery('news', index),
          angle: query.notes,
          meta: {
            keywords: query.keywords,
            siteFilters: query.siteFilters,
            notes: query.notes,
            sourceType: 'news',
            reason: 'planner_seed',
            planIndex: index
          }
        })
      )
    })
  }

  if (Array.isArray(plan.contentQueries?.official)) {
    plan.contentQueries.official.forEach((query, index) => {
      tasks.push(
        addToFrontier(patchId, {
          id: `query:official:${index}:${query.url}`,
          provider: 'query:official',
          cursor: query.url,
          priority: scoreQuery('official', index),
          angle: query.notes,
          meta: {
            notes: query.notes,
            sourceType: 'official',
            reason: 'planner_seed',
            planIndex: index
          }
        })
      )
    })
  }

  if (Array.isArray(plan.contentQueries?.longform)) {
    plan.contentQueries.longform.forEach((query, index) => {
      tasks.push(
        addToFrontier(patchId, {
          id: `query:longform:${index}:${query.keywords.join('+')}`,
          provider: 'query:longform',
          cursor: JSON.stringify(query),
          priority: scoreQuery('longform', index),
          angle: query.notes,
          meta: {
            keywords: query.keywords,
            siteFilters: query.siteFilters,
            notes: query.notes,
            sourceType: 'longform',
            reason: 'planner_seed',
            planIndex: index
          }
        })
      )
    })
  }

  if (Array.isArray(plan.contentQueries?.data)) {
    plan.contentQueries.data.forEach((query, index) => {
      tasks.push(
        addToFrontier(patchId, {
          id: `query:data:${index}:${query.keywords.join('+')}`,
          provider: 'query:data',
          cursor: JSON.stringify(query),
          priority: scoreQuery('data', index),
          angle: query.notes,
          meta: {
            keywords: query.keywords,
            siteFilters: query.siteFilters,
            notes: query.notes,
            sourceType: 'data',
            reason: 'planner_seed',
            planIndex: index
          }
        })
      )
    })
  }

  if (tasks.length) {
    await Promise.all(tasks)
  }
}

