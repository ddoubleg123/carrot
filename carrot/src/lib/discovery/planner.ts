import { chatStream } from '@/lib/llm/providers/DeepSeekClient'
import { addToFrontier, FrontierItem, storeDiscoveryPlan } from '@/lib/redis/discovery'
import { URL } from 'node:url'

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
  }
  official?: {
    urls?: string[]
  }
  data?: {
    keywords?: string[][]
    siteFilters?: string[]
  }
  longform?: {
    keywords?: string[][]
    siteFilters?: string[]
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
  }
}

interface PlannerOptions {
  topic: string
  aliases: string[]
  description?: string
  patchId: string
  runId: string
}

const SYSTEM_PROMPT = `You are adjusting inputs for our existing discovery engine. Return STRICT JSON ONLY. Provide 10 directly fetchable seeds (≤2 per domain, ≥6 distinct domains) with an exact 5 establishment / 5 contested split. Mark exactly 3 seeds as priority:1. Add 1–3 quotePullHints per seed (exact phrases visible on-page). Prefer recent sources (≤3 years) unless a historical primary document is stronger. For every contested claim, include at least one non-media authority (court, UN, official, NGO, academic) either as a seed or in contestedPlan. Keep the output compact, precise, and ready to fetch immediately.`

function buildUserPrompt(topic: string, aliases: string[]): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  return `Topic: "${topic}"
Aliases: ${aliasesCSV}

We are not starting over. We need a precise, small plan that our current engine can fetch NOW. Enforce:
- coverageTargets.controversyRatio = 0.5 (exactly 5 'contested' + 5 'establishment'),
- minNonMediaPerContested = 1,
- maxPerDomain = 2,
- prefer recent (≤3 years) unless a historical primary is stronger,
- seeds must be directly fetchable URLs (no search/result placeholders),
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
    "preferFreshWithinDays": 1095
  },
  "queries": {
    "wikipedia": { "sections": string[], "refsKeywords": string[] },
    "news": { "keywords": string[][], "siteFilters": string[] },
    "official": { "urls": string[] },
    "data": { "keywords": string[][], "siteFilters": string[] },
    "longform": { "keywords": string[][], "siteFilters": string[] }
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
      "priority": 1|2|3
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
    "respectRobotsTxt": true
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
    alt: typeof seed.alt === 'string' && seed.alt.trim().length > 0 ? seed.alt.trim() : null
  }

  return normalisedSeed
}

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
        []
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
        []
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
        []
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

  return {
    topic: plan.topic || fallback.topic,
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
    queryAngles:
      Array.isArray(plan.queryAngles) && plan.queryAngles.length
        ? (plan.queryAngles as PlannerQueryAngle[])
        : fallback.queryAngles,
    controversyAngles,
    historyAngles,
    coverageTargets,
    contestedPlan:
      Array.isArray(plan.contestedPlan) && plan.contestedPlan.length
        ? (plan.contestedPlan as any[]).map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const claim = typeof entry.claim === 'string' ? entry.claim.trim() : ''
            const supporting = Array.isArray(entry.supportingSources)
              ? entry.supportingSources.map((value: unknown) => String(value).trim()).filter(Boolean)
              : []
            const counter = Array.isArray(entry.counterSources)
              ? entry.counterSources.map((value: unknown) => String(value).trim()).filter(Boolean)
              : []
            const verificationFocus = Array.isArray(entry.verificationFocus)
              ? entry.verificationFocus.map((value: unknown) => String(value).trim()).filter(Boolean)
              : []
            if (!claim || !supporting.length || !counter.length) {
              return null
            }
            return {
              claim,
              supportingSources: supporting,
              counterSources: counter,
              verificationFocus
            }
          }).filter(Boolean) as DiscoveryPlan['contestedPlan']
        : fallback.contestedPlan,
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
}

function buildFallbackPlan(topic: string, aliases: string[]): DiscoveryPlan {
  const generatedAt = new Date().toISOString()
  const mustTerms = [topic, ...aliases].filter(Boolean)
  const mainWiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`
  const seeds: PlannerSeedCandidate[] = [
    normaliseSeedCandidate({
      url: mainWiki,
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
      notes: 'Baseline article with references and history',
      quotePullHints: ['Chicago Bulls are an American professional basketball team'],
      verification: {
        namesOrEntities: ['Chicago Bulls', 'NBA'],
        dates: ['1966']
      }
    })
  ]

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
      }
    ],
    controversyAngles: [
      {
        angle: 'Current controversies',
        whyItMatters: 'Captures present-day debates and conflicts impacting stakeholders',
        quoteTargets: ['civil society reports', 'legal filings'],
        signals: ['human rights', 'sanctions'],
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
      preferFreshWithinDays: 1095
    },
    queries: {
      wikipedia: {
        sections: ['History', 'Ownership'],
        refsKeywords: ['Chicago Bulls primary sources']
      },
      news: {
        keywords: [['Chicago Bulls', 'season'], ['Chicago Bulls', 'trade']],
        siteFilters: []
      },
      official: { urls: [] },
      data: { keywords: [['NBA statistics', 'Chicago Bulls']], siteFilters: [] },
      longform: { keywords: [['Chicago Bulls analysis']], siteFilters: [] }
    },
    contentQueries: {
      wikipedia: [{ query: topic, intent: 'sections', notes: 'lead sections and history details' }],
      news: [],
      official: [],
      longform: [],
      data: []
    },
    seedCandidates: seeds,
    contestedPlan: [
      {
        claim: 'Recent Chicago Bulls roster decisions are controversial among analysts',
        supportingSources: ['https://www.nba.com/bulls'],
        counterSources: ['https://www.espn.com/espn/rss/nba/team/_/name/chi/chicago-bulls'],
        verificationFocus: ['dates of trades', 'player statistics']
      }
    ],
    domainWhitelists: {
      authority: ['.gov', '.int'],
      referenceHubs: ['wikipedia.org', 'wikidata.org']
    },
    fetchRules: {
      maxPerDomain: 3,
      preferSections: true,
      requireEntityMention: 'title_or_h1',
      dedupe: ['canonicalUrl', 'simhash'],
      timeoutMs: 3000,
      credibilityMix: { tier1Min: 0.4, tier2Min: 0.4, tier3Max: 0.2 },
      alternateIfPaywalled: true
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
    const response = await collectStreamResponse({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(topic, aliases) }
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

export async function seedFrontierFromPlan(patchId: string, plan: DiscoveryPlan): Promise<void> {
  if (!Array.isArray(plan.seedCandidates) || plan.seedCandidates.length === 0) {
    return
  }

  const seedsSorted = [...plan.seedCandidates].sort((a, b) => {
    const priorityA = a.priority ?? 999
    const priorityB = b.priority ?? 999
    if (priorityA !== priorityB) return priorityA - priorityB
    return 0
  })

  const domainCounts = new Map<string, number>()
  const selectedSeeds: PlannerSeedCandidate[] = []
  let contestedCount = 0
  let establishmentCount = 0

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
    }

    const currentCount = domainCounts.get(domain) ?? 0
    const domainLimit = 2
    if (currentCount >= domainLimit) {
      continue
    }

    domainCounts.set(domain, currentCount + 1)
    selectedSeeds.push(seed as PlannerSeedCandidate)
    if (isContested) contestedCount++
    else establishmentCount++

    if (selectedSeeds.length >= 10) {
      break
    }
  }

  if (!selectedSeeds.length) {
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
        whyItMatters: seed.whyItMatters
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

