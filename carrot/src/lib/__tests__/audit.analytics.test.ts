import {
  buildAnalytics,
  buildWhyRejected,
  computeSeedsVsQueries,
  buildRobotsDecisions
} from '../discovery/auditAnalytics'

describe('audit analytics helpers', () => {
  const items = [
    {
      step: 'save',
      status: 'ok',
      candidateUrl: 'https://news.example.com/story-a',
      meta: { stance: 'contested', reason: 'planner_query' },
      decisions: {}
    },
    {
      step: 'skipped:duplicate',
      status: 'fail',
      candidateUrl: 'https://en.wikipedia.org/wiki/Test',
      decisions: { reason: 'redis_seen' }
    },
    {
      step: 'save',
      status: 'ok',
      candidateUrl: 'https://contested.example.com/story-b',
      meta: { stance: 'contested' },
      decisions: {}
    }
  ]

  it('computes why rejected counts', () => {
    const rejected = buildWhyRejected(items)
    expect(rejected.find((entry) => entry.reason === 'redis_seen')?.count).toBe(1)
  })

  it('computes seeds vs queries', () => {
    const result = computeSeedsVsQueries(items)
    expect(result.queries).toBe(1)
    expect(result.seeds).toBe(0)
  })

  it('builds robots decisions list', () => {
    const logs = buildRobotsDecisions([
      {
        step: 'fetch',
        decisions: { reason: 'robots_forbidden', rule: 'no-archive' },
        candidateUrl: 'https://robots.example.com'
      }
    ])
    expect(logs).toHaveLength(1)
    expect(logs[0].rule).toBe('no-archive')
  })

  it('produces analytics summary with zero-save data', () => {
    const analytics = buildAnalytics(
      items,
      {
        metrics: {
          timeToFirstMs: 5000,
          tracker: { frontierDepth: 42 },
          controversyWindow: { attemptRatio: 0.5, saveRatio: 0.4, size: 40 }
        }
      },
      {
        paywallBranches: ['amp:https://news.example.com/story-a'],
        zeroSaveDiagnostics: { status: 'warning', attempts: 26 },
        seedsVsQueries: { seeds: 0, queries: 1 },
        whyRejected: [],
        robotsDecisions: [],
        topCandidates: []
      }
    )

    expect(analytics.ttfSeconds).toBe(5)
    expect(analytics.zeroSave).toMatchObject({ status: 'warning', attempts: 26 })
    expect(analytics.paywallBranches.raw).toHaveLength(1)
    expect(Object.keys(analytics.paywallBranches.summary)).toHaveLength(1)
  })
})

