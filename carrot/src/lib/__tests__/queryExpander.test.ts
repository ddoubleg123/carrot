import { expandPlannerQuery, filterQuerySuggestions, QueryExpanderConstants } from '../discovery/queryExpander'
import type { FrontierItem } from '@/lib/redis/discovery'

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof fetch | undefined
}

const patchId = 'patch-1'

const buildCandidate = (overrides: Partial<FrontierItem> = {}): FrontierItem => ({
  id: 'candidate-1',
  provider: 'query:news',
  cursor: JSON.stringify({
    keywords: ['climate change', 'emissions'],
    siteFilters: ['example.com', 'example.org']
  }),
  priority: 100,
  angle: 'coverage',
  meta: {},
  ...overrides
})

describe('QueryExpander.expandPlannerQuery', () => {
  test('limits suggestions per host and total', async () => {
    const candidate = buildCandidate()
    const result = await expandPlannerQuery({ candidate, attempt: 0, totalDequeues: 40 })
    expect(result.deferredGeneral).toBe(false)
    expect(result.suggestions.length).toBeLessThanOrEqual(QueryExpanderConstants.MAX_RESULTS_PER_QUERY)

    const counts = result.suggestions.reduce<Record<string, number>>((acc, suggestion) => {
      const host = suggestion.host ?? 'general'
      acc[host] = (acc[host] ?? 0) + 1
      return acc
    }, {})

    Object.values(counts).forEach((count) => {
      expect(count).toBeLessThanOrEqual(QueryExpanderConstants.MAX_RESULTS_PER_HOST)
    })
  })

  test('defers general expansion until threshold', async () => {
    const candidate = buildCandidate({
      cursor: JSON.stringify({ keywords: ['budget hearing'] })
    })

    const attemptZero = await expandPlannerQuery({ candidate, attempt: 0, totalDequeues: 5 })
    expect(attemptZero.deferredGeneral).toBe(true)
    expect(attemptZero.suggestions).toHaveLength(0)

    const unlocked = await expandPlannerQuery({
      candidate,
      attempt: QueryExpanderConstants.GENERAL_UNLOCK_ATTEMPTS,
      totalDequeues: 35
    })
    expect(unlocked.deferredGeneral).toBe(false)
    expect(unlocked.suggestions.length).toBeGreaterThanOrEqual(QueryExpanderConstants.MIN_RESULTS_PER_QUERY)
  })

  test('includes minPubDate hint in generated URLs', async () => {
    const candidate = buildCandidate({
      cursor: JSON.stringify({ keywords: ['economic outlook'] }),
      meta: { minPubDate: '2024-01-01' }
    })
    const result = await expandPlannerQuery({
      candidate,
      attempt: QueryExpanderConstants.GENERAL_UNLOCK_ATTEMPTS,
      totalDequeues: 40
    })

    const hasDateHint = result.suggestions.some((suggestion) =>
      suggestion.url.includes('cd_min=01/01/2024') || suggestion.url.includes('after:2024-01-01')
    )
    expect(hasDateHint).toBe(true)
  })

  test('harvests non-wiki citations from wikipedia provider', async () => {
    const html = `
      <html>
        <body>
          <ol class="references">
            <li><a href="https://example.com/article/abc">Example A</a></li>
            <li><a href="https://another.org/report/123">Example B</a></li>
          </ol>
        </body>
      </html>
    `
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => html }) as unknown as typeof fetch

    const candidate: FrontierItem = {
      id: 'wiki-candidate',
      provider: 'query:wikipedia',
      cursor: 'Chicago Bulls',
      priority: 100,
      angle: 'history',
      meta: {}
    }

    const result = await expandPlannerQuery({ candidate, attempt: 0, totalDequeues: 0 })

    expect(result.deferredGeneral).toBe(false)
    expect(result.suggestions).toHaveLength(2)
    result.suggestions.forEach((suggestion) => {
      expect(suggestion.host).not.toContain('wikipedia.org')
    })

    global.fetch = originalFetch
  })
})

describe('filterQuerySuggestions', () => {
  test('skips seed duplicates and respects cooldown', async () => {
    const candidate = buildCandidate()
    const { suggestions } = await expandPlannerQuery({ candidate, attempt: 0, totalDequeues: 40 })
    expect(suggestions.length).toBeGreaterThan(0)
    const first = suggestions[0]

    const seeds = new Set<string>(['https://news.google.com/rss/search?q=climate%20change'])
    const cooldowns = new Map<string, { lastSeen: number; cooldownUntil: number }>()
    const context = {
      patchId,
      seeds,
      cooldowns,
      now: Date.now(),
      isSeen: async () => false
    }

    const filtered = await filterQuerySuggestions([first], context)
    expect(filtered.accepted).toHaveLength(0)
    expect(filtered.skipped[0]?.reason).toBe('seed_duplicate')

    // Accept once (remove from seeds) and then ensure cooldown stops immediate re-add
    seeds.clear()
    const acceptedFirst = await filterQuerySuggestions([first], context)
    expect(acceptedFirst.accepted).toHaveLength(1)

    const immediateRetry = await filterQuerySuggestions([first], {
      ...context,
      now: context.now! + 1000
    })
    expect(immediateRetry.accepted).toHaveLength(0)
    expect(immediateRetry.skipped[0]?.reason).toContain('cooldown')

    const afterCooldown = await filterQuerySuggestions([first], {
      ...context,
      now: context.now! + QueryExpanderConstants.FIVE_MINUTES + 1000
    })
    expect(afterCooldown.accepted).toHaveLength(1)
  })
})


