import { ensurePlanDefaults, seedFrontierFromPlan, type DiscoveryPlan, type PlannerSeedCandidate } from '../discovery/planner'
import { addToFrontier } from '@/lib/redis/discovery'

jest.mock('@/lib/redis/discovery', () => {
  const actual = jest.requireActual('@/lib/redis/discovery')
  return {
    ...actual,
    addToFrontier: jest.fn(() => Promise.resolve())
  }
})

describe('Discovery planner helpers', () => {
  const buildFallbackPlan = (): DiscoveryPlan => ({
    topic: 'Test Topic',
    aliases: ['Alias One'],
    generatedAt: '2025-01-01T00:00:00.000Z',
    mustTerms: ['test'],
    shouldTerms: [],
    disallowTerms: ['recipe'],
    queryAngles: [
      {
        angle: 'Angle A',
        whyItMatters: 'Reason A',
        quoteTargets: ['Target A']
      }
    ],
    controversyAngles: [
      {
        angle: 'Controversy Angle',
        whyItMatters: 'Reason C',
        quoteTargets: ['Target C']
      }
    ],
    historyAngles: [
      {
        angle: 'History Angle',
        whyItMatters: 'Reason H',
        quoteTargets: ['Target H']
      }
    ],
    coverageTargets: {
      controversyRatio: 0.5,
      controversyWindow: 4,
      historyInFirst: 3
    },
    contentQueries: {
      wikipedia: [{ query: 'Test topic', intent: 'sections' }],
      news: [{ keywords: ['Test topic'], notes: 'News' }],
      official: [{ url: 'https://example.com/official' }],
      longform: [{ keywords: ['Test topic report'] }],
      data: [{ keywords: ['Test data'] }]
    },
    seedCandidates: [
      {
        url: 'https://example.com/seed-1',
        category: 'media',
        angle: 'Angle A',
        expectedInsights: ['Insight'],
        isControversy: true,
        isHistory: false
      },
      {
        url: 'https://example.com/seed-2',
        category: 'media',
        angle: 'Angle A',
        expectedInsights: ['Insight'],
        isControversy: false,
        isHistory: true
      }
    ],
    domainWhitelists: {
      authority: ['example.com']
    },
    fetchRules: {
      maxPerDomain: 3
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('ensurePlanDefaults fills missing arrays and normalises seeds', () => {
    const fallback = buildFallbackPlan()
    const partialPlan: Partial<DiscoveryPlan> = {
      topic: 'Test Topic',
      aliases: [],
      generatedAt: undefined,
      seedCandidates: [
        {
          url: 'https://example.com/seed-raw',
          category: 'media',
          angle: 'Angle A',
          expectedInsights: [],
          isControversy: undefined,
          isHistory: undefined
        } as PlannerSeedCandidate
      ]
    }

    const result = ensurePlanDefaults(partialPlan, fallback)

    expect(result.generatedAt).toEqual(expect.any(String))
    expect(result.aliases).toEqual(fallback.aliases)
    expect(result.controversyAngles).toEqual(fallback.controversyAngles)
    expect(result.historyAngles).toEqual(fallback.historyAngles)
    expect(result.coverageTargets).toEqual(fallback.coverageTargets)
    expect(result.seedCandidates).toHaveLength(1)
    expect(result.seedCandidates[0].isControversy).toBe(false)
    expect(result.seedCandidates[0].isHistory).toBe(false)
  })

  test('seedFrontierFromPlan forwards controversy and history metadata', async () => {
    const fallback = buildFallbackPlan()

    await seedFrontierFromPlan('patch-123', fallback)

    expect(addToFrontier).toHaveBeenCalledTimes(fallback.seedCandidates.length)
    const seededMeta = (addToFrontier as jest.Mock).mock.calls.map(([, item]) => item.meta)
    expect(seededMeta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isControversy: true, isHistory: false }),
        expect.objectContaining({ isControversy: false, isHistory: true })
      ])
    )
  })
})
