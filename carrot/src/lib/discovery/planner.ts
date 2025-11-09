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
}

export interface PlannerCoverageTargets {
  controversyRatio: number
  controversyWindow: number
  historyInFirst: number
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
  contentQueries: {
    wikipedia: Array<{ query: string; intent: 'sections' | 'refs'; notes?: string }>
    news: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    official: Array<{ url: string; notes?: string }>
    longform: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    data: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
  }
  seedCandidates: PlannerSeedCandidate[]
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
  }
}

interface PlannerOptions {
  topic: string
  aliases: string[]
  description?: string
  patchId: string
  runId: string
}

const SYSTEM_PROMPT = `You are a research coordinator that plans high-signal evidence gathering.
Return STRICT JSON only (no prose, no markdown). Your plan must surface majority viewpoints, minority/controversial perspectives, and formative history.
Deduplicate domains. Prefer primary sources (legal filings, watchdog reports, intergovernmental documents) and recent, citable, non-paywalled material. Include at least 18–22 seedCandidates.`

function buildUserPrompt(topic: string, aliases: string[]): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  return `Topic: "${topic}"
Aliases: ${aliasesCSV}

Return JSON with:
{
  "topic": "...",
  "aliases": ["..."],
  "generatedAt": "ISO timestamp",
  "mustTerms": ["..."],
  "shouldTerms": ["..."],
  "disallowTerms": ["travel","recipe","tourism","fiction"],
  "queryAngles": [
    {"angle":"...", "whyItMatters":"...","quoteTargets":[">=1 named doc or speaker"], "signals":["economic data","labor contracts"], "timeframe":"2020s" }
  ],
  "controversyAngles": [
    {"angle":"...", "whyItMatters":"...","quoteTargets":["civil liberties org","legal filings"], "signals":["sanctions","protests"], "timeframe":"recent"}
  ],
  "historyAngles": [
    {"angle":"...", "whyItMatters":"...","quoteTargets":["archived news","oral history"], "signals":["dynasty","founding"], "timeframe":"pre-2000"}
  ],
  "coverageTargets": {"controversyRatio":0.5,"controversyWindow":4,"historyInFirst":3},
  "contentQueries": {
    "wikipedia": [
      {"query":"...", "intent":"sections|refs", "notes":"exact sections/anchors"}
    ],
    "news": [
      {"keywords":["..."], "siteFilters":["..."], "notes":"recent metrics"}
    ],
    "official": [{"url":"...", "notes":"dataset/report"}],
    "longform": [{"keywords":["..."], "siteFilters":["..."], "notes":"pdf/report"}],
    "data": [{"keywords":["..."], "siteFilters":["wipo.int","oecd.org","..."]}]
  },
  "seedCandidates": [
    {
      "url":"...",
      "titleGuess":"...",
      "category":"official|intergovernmental|watchdog|academic|media|data|wikipedia|longform",
      "angle":"(must map to queryAngles)",
      "expectedInsights":["numbers/dates/records"],
      "credibilityTier": 1,
      "noveltySignals":["2024+","dataset","original doc"],
      "isControversy": true,
      "isHistory": false,
      "notes":"why this seed matters"
    }
  ],
  "domainWhitelists": {
    "authority":["...gov","...int","court domains"],
    "referenceHubs":["wikipedia.org","wikidata.org"],
    "diversity":["orgs across viewpoints"]
  },
  "fetchRules": {
    "maxPerDomain": 3,
    "preferSections": true,
    "requireEntityMention": "title_or_h1",
    "dedupe": ["canonicalUrl","simhash"],
    "timeoutMs": 3000,
    "credibilityMix": {"tier1Min":0.4, "tier2Min":0.4, "tier3Max":0.2},
    "alternateIfPaywalled": true
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
  return {
    url: seed.url,
    titleGuess: seed.titleGuess,
    category: seed.category || 'media',
    angle: seed.angle,
    expectedInsights: seed.expectedInsights,
    credibilityTier: seed.credibilityTier,
    noveltySignals: seed.noveltySignals,
    isControversy: Boolean(seed.isControversy),
    isHistory: Boolean(seed.isHistory),
    notes: seed.notes
  }
}

export function ensurePlanDefaults(plan: Partial<DiscoveryPlan>, fallback: DiscoveryPlan): DiscoveryPlan {
  const generatedAt = typeof plan.generatedAt === 'string' ? plan.generatedAt : new Date().toISOString()
  const aliases = Array.isArray(plan.aliases) && plan.aliases.length
    ? plan.aliases.filter((value): value is string => typeof value === 'string')
    : fallback.aliases

  const controversyAngles = Array.isArray(plan.controversyAngles) && plan.controversyAngles.length
    ? (plan.controversyAngles as PlannerQueryAngle[])
    : fallback.controversyAngles

  const historyAngles = Array.isArray(plan.historyAngles) && plan.historyAngles.length
    ? (plan.historyAngles as PlannerQueryAngle[])
    : fallback.historyAngles

  const coverageTargets: PlannerCoverageTargets = typeof plan.coverageTargets === 'object' && plan.coverageTargets
    ? {
        controversyRatio: Number(plan.coverageTargets.controversyRatio ?? fallback.coverageTargets.controversyRatio),
        controversyWindow: Number(plan.coverageTargets.controversyWindow ?? fallback.coverageTargets.controversyWindow),
        historyInFirst: Number(plan.coverageTargets.historyInFirst ?? fallback.coverageTargets.historyInFirst)
      }
    : fallback.coverageTargets

  return {
    topic: plan.topic || fallback.topic,
    aliases,
    generatedAt,
    mustTerms: Array.isArray(plan.mustTerms) && plan.mustTerms.length ? plan.mustTerms : fallback.mustTerms,
    shouldTerms: Array.isArray(plan.shouldTerms) ? plan.shouldTerms : fallback.shouldTerms,
    disallowTerms: Array.isArray(plan.disallowTerms) && plan.disallowTerms.length ? plan.disallowTerms : fallback.disallowTerms,
    queryAngles: Array.isArray(plan.queryAngles) && plan.queryAngles.length ? (plan.queryAngles as PlannerQueryAngle[]) : fallback.queryAngles,
    controversyAngles,
    historyAngles,
    coverageTargets,
    contentQueries: {
      wikipedia: plan.contentQueries?.wikipedia || fallback.contentQueries.wikipedia,
      news: plan.contentQueries?.news || fallback.contentQueries.news,
      official: plan.contentQueries?.official || fallback.contentQueries.official,
      longform: plan.contentQueries?.longform || fallback.contentQueries.longform,
      data: plan.contentQueries?.data || fallback.contentQueries.data
    },
    seedCandidates: Array.isArray(plan.seedCandidates) && plan.seedCandidates.length
      ? (plan.seedCandidates as PlannerSeedCandidate[]).map(normaliseSeedCandidate)
      : fallback.seedCandidates,
    domainWhitelists: plan.domainWhitelists || fallback.domainWhitelists,
    fetchRules: plan.fetchRules || fallback.fetchRules
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
      notes: 'Baseline article with references and history'
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
      historyInFirst: 3
    },
    contentQueries: {
      wikipedia: [{ query: topic, intent: 'sections', notes: 'lead sections and history details' }],
      news: [],
      official: [],
      longform: [],
      data: []
    },
    seedCandidates: seeds,
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

  if (seed.isControversy) {
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
  const items: Array<Promise<void>> = []

  plan.seedCandidates.forEach((seed, index) => {
    if (!seed.url) {
      return
    }

    const item: FrontierItem = {
      id: `seed:${index}:${seed.url}`,
      provider: 'planner',
      cursor: seed.url,
      priority: computeSeedPriority(seed, index, plan.domainWhitelists),
      angle: seed.angle,
      meta: {
        category: seed.category,
        expectedInsights: seed.expectedInsights,
        credibilityTier: seed.credibilityTier,
        noveltySignals: seed.noveltySignals,
        isControversy: seed.isControversy,
        isHistory: seed.isHistory,
        notes: seed.notes,
        titleGuess: seed.titleGuess
      }
    }

    items.push(addToFrontier(patchId, item))
  })

  await Promise.all(items)
}


