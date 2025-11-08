import { chatStream } from '@/lib/llm/providers/DeepSeekClient'
import { addToFrontier, FrontierItem, storeDiscoveryPlan } from '@/lib/redis/discovery'
import { URL } from 'node:url'

export interface PlannerQueryAngle {
  angle: string
  whyItMatters: string
  quoteTargets: string[]
}

export interface PlannerSeedCandidate {
  url: string
  titleGuess?: string
  sourceType: 'official' | 'news' | 'longform' | 'data' | 'wikipedia'
  angle: string
  expectedInsights?: string[]
  requiresQuoteHunt?: boolean
  credibilityTier: 1 | 2 | 3
  noveltySignals?: string[]
  reason?: string
}

export interface DiscoveryPlan {
  topic: string
  mustTerms: string[]
  shouldTerms: string[]
  disallowTerms: string[]
  queryAngles: PlannerQueryAngle[]
  contentQueries: {
    wikipedia: Array<{ query: string; intent: 'sections' | 'refs'; notes?: string }>
    news: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    official: Array<{ url: string; notes?: string }>
    longform: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
    data: Array<{ keywords: string[]; siteFilters?: string[]; notes?: string }>
  }
  seedCandidates: PlannerSeedCandidate[]
  contestedPlan?: {
    claims: Array<{
      claim: string
      supportingSources: Array<{ url: string; type: string; reason?: string }>
      counterSources: Array<{ url: string; type: string; reason?: string }>
      factTargets?: string[]
      flags?: string[]
    }>
  }
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
Return STRICT JSON only (no prose, no markdown). Include majority and minority/controversial viewpoints with sources. Prefer recent, citable, non-paywalled items. Deduplicate domains. Include at least 18–22 \"seedCandidates\".`

function buildUserPrompt(topic: string, aliases: string[]): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  return `Topic: "${topic}"
Aliases: ${aliasesCSV}

Return JSON with:
{
  "topic": "...",
  "mustTerms": ["..."],
  "shouldTerms": ["..."],
  "disallowTerms": ["travel","recipe","tourism","fiction"],
  "queryAngles": [
    {"angle":"...", "whyItMatters":"...","quoteTargets":[">=1 named doc or speaker"] }
  ],
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
      "sourceType":"official|news|longform|data|wikipedia",
      "angle":"(must map to queryAngles)",
      "expectedInsights":["numbers/dates/records"],
      "requiresQuoteHunt": true,
      "credibilityTier": 1,
      "noveltySignals":["2024+","dataset","original doc"],
      "reason":"why this seed matters"
    }
  ],
  "contestedPlan": {
    "claims": [
      {
        "claim":"...",
        "supportingSources":[{"url":"...","type":"legal|report|news|official","reason":"..."}],
        "counterSources":[{"url":"...","type":"legal|report|news|official","reason":"..."}],
        "factTargets":["numbers","dates","legal cites"],
        "flags":["numbers","dates","legal citations"]
      }
    ]
  },
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

function ensurePlanDefaults(plan: Partial<DiscoveryPlan>, fallback: DiscoveryPlan): DiscoveryPlan {
  return {
    topic: plan.topic || fallback.topic,
    mustTerms: Array.isArray(plan.mustTerms) && plan.mustTerms.length ? plan.mustTerms : fallback.mustTerms,
    shouldTerms: Array.isArray(plan.shouldTerms) ? plan.shouldTerms : fallback.shouldTerms,
    disallowTerms: Array.isArray(plan.disallowTerms) && plan.disallowTerms.length ? plan.disallowTerms : fallback.disallowTerms,
    queryAngles: Array.isArray(plan.queryAngles) && plan.queryAngles.length ? plan.queryAngles as PlannerQueryAngle[] : fallback.queryAngles,
    contentQueries: {
      wikipedia: plan.contentQueries?.wikipedia || fallback.contentQueries.wikipedia,
      news: plan.contentQueries?.news || fallback.contentQueries.news,
      official: plan.contentQueries?.official || fallback.contentQueries.official,
      longform: plan.contentQueries?.longform || fallback.contentQueries.longform,
      data: plan.contentQueries?.data || fallback.contentQueries.data
    },
    seedCandidates: Array.isArray(plan.seedCandidates) && plan.seedCandidates.length ? plan.seedCandidates as PlannerSeedCandidate[] : fallback.seedCandidates,
    contestedPlan: plan.contestedPlan,
    domainWhitelists: plan.domainWhitelists,
    fetchRules: plan.fetchRules
  }
}

function buildFallbackPlan(topic: string, aliases: string[]): DiscoveryPlan {
  const mustTerms = [topic, ...aliases].filter(Boolean)
  const mainWiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`
  const seeds: PlannerSeedCandidate[] = [
    {
      url: mainWiki,
      titleGuess: `${topic} — overview`,
      sourceType: 'wikipedia',
      angle: 'foundational history',
      expectedInsights: ['key facts', 'timeline'],
      requiresQuoteHunt: false,
      credibilityTier: 2,
      noveltySignals: ['reference'],
      reason: 'Baseline article with references and history'
    }
  ]
  return {
    topic,
    mustTerms,
    shouldTerms: aliases,
    disallowTerms: ['travel', 'recipe', 'tourism', 'fiction'],
    queryAngles: [
      {
        angle: 'foundational history',
        whyItMatters: 'Provides baseline facts and official record',
        quoteTargets: ['official statements', 'primary documents']
      }
    ],
    contentQueries: {
      wikipedia: [{ query: topic, intent: 'sections', notes: 'lead sections and history' }],
      news: [],
      official: [],
      longform: [],
      data: []
    },
    seedCandidates: seeds
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

  if (seed.requiresQuoteHunt) {
    priority += 2
  }

  return priority
}

export async function generateDiscoveryPlan(options: PlannerOptions): Promise<DiscoveryPlan> {
  const { topic, aliases, description, patchId, runId } = options
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
    const plan = ensurePlanDefaults(parsed, fallback)

    await storeDiscoveryPlan(runId, plan)
    await seedFrontierFromPlan(patchId, plan)

    return plan
  } catch (error) {
    console.error('[DiscoveryPlanner] DeepSeek planner failed, using fallback plan', error)
    await storeDiscoveryPlan(runId, fallback)
    await seedFrontierFromPlan(patchId, fallback)
    return fallback
  }
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
        sourceType: seed.sourceType,
        expectedInsights: seed.expectedInsights,
        requiresQuoteHunt: seed.requiresQuoteHunt,
        credibilityTier: seed.credibilityTier,
        noveltySignals: seed.noveltySignals,
        reason: seed.reason,
        titleGuess: seed.titleGuess
      }
    }

    items.push(addToFrontier(patchId, item))
  })

  await Promise.all(items)
}


