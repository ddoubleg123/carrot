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

const SYSTEM_PROMPT = `You are the Planner for our existing discovery engine. You are ADJUSTING its inputs — not replacing any component. Output a compact, HIGH-SIGNAL plan that our CURRENT crawler can use immediately:
• 10 fetchable seed items (non-paywalled preferred) with a hard 50/50 split between 'establishment' and 'contested'.
• At least 6 distinct domains; max 2 per domain.
• For every contested seed, include ≥1 non-media authority (court/UN/official/NGO/academic) either as the seed itself or explicitly in contestedPlan.
• Mark 3 seeds 'priority':1 for fastest first wins.
• Provide quotePullHints (1–3 exact phrases on-page) to help the vetter pull up to TWO paragraphs total (≤150 words combined) under fair use with attribution.
• Include verification targets (numbers, dates, law, named entities) for each seed to keep the vetter honest.
Return STRICT JSON ONLY. If unknown, return null (do not invent). You are adjusting inputs for an existing pipeline; keep output small and precise.`

function buildUserPrompt(topic: string, aliases: string[]): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  return `Topic: "${topic}"
Aliases: ${aliasesCSV}

We are not starting over. We need a precise, small plan that our current engine can fetch NOW. Enforce:
- coverageTargets.controversyRatio = 0.5 (exactly 5 'contested' + 5 'establishment'),
- minNonMediaPerContested = 1,
- maxPerDomain = 2,
- prefer recent (≤3 years) unless historical primary is stronger,
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
    "requireEntityMention": "title_or_h1",
    "timeoutMs": 4000,
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
    const items = value.map((entry) => String(entry).trim()).filter(Boolean)
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
        plan.contentQueries?.news?.map((item) => item.siteFilters).flat().filter(Boolean) ??
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
        plan.contentQueries?.data?.map((item) => item.siteFilters).flat().filter(Boolean) ??
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
        plan.contentQueries?.longform?.map((item) => item.siteFilters).flat().filter(Boolean) ??
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
      priority += 25
      break
    case 2:
      priority += 15
      break
    case 3:
      priority += 5
      break
    default:
      break
  }

  if (seed.noveltySignals?.some(signal => /202[3-9]/.test(signal))) {
    priority += 10
  }

  if (seed.stance === 'contested' || seed.isControversy) {
    priority += 8
  }

  if (seed.isHistory) {
    priority += 4
  }

  try {
    const domain = new URL(seed.url).hostname.toLowerCase()
    if (domainWhitelists?.authority?.some(w => domain.endsWith(w.replace(/^[*.]+/, '')))) {
      priority += 10
    } else if (domainWhitelists?.referenceHubs?.some(w => domain.endsWith(w.replace(/^[*.]+/, '')))) {
      priority += 6
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

  const contestedSeeds = plan.seedCandidates.filter(
    (seed) => seed.stance === 'contested' || seed.isControversy === true
  )
  const establishmentSeeds = plan.seedCandidates.filter(
    (seed) => seed.stance !== 'contested' && seed.isControversy !== true
  )

  const sortByPlannerPriority = (a: PlannerSeedCandidate, b: PlannerSeedCandidate) => {
    const priorityA = a.priority ?? 999
    const priorityB = b.priority ?? 999
    if (priorityA !== priorityB) return priorityA - priorityB
    return 0
  }

  contestedSeeds.sort(sortByPlannerPriority)
  establishmentSeeds.sort(sortByPlannerPriority)

  const domainCounts = new Map<string, number>()
  const selectSeeds = (sourceSeeds: PlannerSeedCandidate[], limit: number): PlannerSeedCandidate[] => {
    const selected: PlannerSeedCandidate[] = []
    for (const seed of sourceSeeds) {
      if (!seed.url) continue
      let domain = 'unknown'
      try {
        domain = new URL(seed.url).hostname.toLowerCase()
      } catch {
        // ignore
      }
      const currentCount = domainCounts.get(domain) ?? 0
      if (currentCount >= 2) continue
      domainCounts.set(domain, currentCount + 1)
      selected.push(seed)
      if (selected.length >= limit) break
    }
    return selected
  }

  const selectedSeeds = [...selectSeeds(contestedSeeds, 5), ...selectSeeds(establishmentSeeds, 5)]

  const tasks: Array<Promise<void>> = []

  selectedSeeds.forEach((seed, index) => {
    if (!seed.url) return

    const item: FrontierItem = {
      id: `seed:${Date.now()}:${index}:${seed.url}`,
      provider: 'planner',
      cursor: seed.url,
      priority: computeSeedPriority(seed, index, plan.domainWhitelists),
      angle: seed.angle,
      meta: {
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
}


