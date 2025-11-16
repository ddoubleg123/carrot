import { __validatePlannerPlan } from '../discovery/planner'
import type { DiscoveryPlan, PlannerSeedCandidate } from '../discovery/planner'

const buildSeed = (host: string, path: string, overrides: Partial<PlannerSeedCandidate> = {}): PlannerSeedCandidate => ({
  url: `https://${host}/${path}`,
  titleGuess: `${host} article`,
  sourceType: 'media',
  angle: 'coverage',
  stance: 'establishment',
  whyItMatters: 'sample seed',
  expectedInsights: ['insight'],
  credibilityTier: 2,
  quotePullHints: ['quote'],
  priority: 2,
  verification: { namesOrEntities: ['entity'] },
  ...overrides
})

const buildValidPlan = (): DiscoveryPlan => {
  const nonWikiHosts = [
    'host-one.com',
    'host-two.org',
    'host-three.net',
    'host-four.io',
    'host-five.news',
    'host-six.data',
    'host-seven.watch',
    'host-eight.academy',
    'host-nine.media'
  ]

  const seeds: PlannerSeedCandidate[] = [
    buildSeed('en.wikipedia.org', 'wiki/Sample_Topic', {
      sourceType: 'wikipedia',
      priority: 1
    }),
    ...nonWikiHosts.slice(0, 9).map((host, index) =>
      buildSeed(host, `articles/depth-${index + 2}/insight`, {
        stance: index % 2 === 0 ? 'contested' : 'establishment',
        sourceType: index % 3 === 0 ? 'data' : 'media'
      })
    )
  ]

  return {
    topic: 'Sample Topic',
    aliases: ['Alias'],
    generatedAt: new Date().toISOString(),
    mustTerms: ['Sample Topic'],
    shouldTerms: ['Alias'],
    disallowTerms: [],
    queryAngles: [],
    controversyAngles: [],
    historyAngles: [],
    coverageTargets: {
      controversyRatio: 0.5,
      controversyWindow: 4,
      historyInFirst: 2,
      minNonMediaPerContested: 1,
      maxPerDomain: 2,
      minFreshnessDays: 0,
      preferFreshWithinDays: 730
    },
    queries: {
      wikipedia: { sections: [], refsKeywords: [] },
      news: { keywords: [['sample']], siteFilters: ['host-one.com', 'host-two.org'], recencyWeeks: 24 },
      official: { urls: [], siteFilters: ['host-three.net'], recencyWeeks: 24 },
      data: { keywords: [['metrics']], siteFilters: ['host-six.data'], recencyWeeks: 24 },
      longform: { keywords: [['analysis']], siteFilters: ['host-four.io'], recencyWeeks: 24 }
    },
    contentQueries: {
      wikipedia: [],
      news: [],
      official: [],
      longform: [],
      data: []
    },
    seedCandidates: seeds,
    domainWhitelists: {},
    fetchRules: {
      maxPerDomain: 2,
      minDistinctDomains: 6,
      maxWikiSeeds: 1
    }
  }
}

describe('planner plan validation', () => {
  test('rejects plan with excess wikipedia seeds', () => {
    const invalidPlan = buildValidPlan()
    invalidPlan.seedCandidates = new Array(5).fill(null).map((_, index) =>
      buildSeed('en.wikipedia.org', `wiki/Page_${index}`)
    )

    const result = __validatePlannerPlan(invalidPlan)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('excess_wiki_seeds')
  })

  test('rejects plan with shallow seeds', () => {
    const invalidPlan = buildValidPlan()
    invalidPlan.seedCandidates = invalidPlan.seedCandidates.map((seed, index) =>
      index === 1
        ? {
            ...seed,
            url: 'https://host-one.com/news'
          }
        : seed
    )

    const result = __validatePlannerPlan(invalidPlan)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('shallow_seed_detected')
  })

  test('accepts plan with ≥6 distinct non-wiki hosts and populated query blocks', () => {
    const validPlan = buildValidPlan()
    const result = __validatePlannerPlan(validPlan)
    expect(result.valid).toBe(true)
  })
})
