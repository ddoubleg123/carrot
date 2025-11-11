import { buildPaywallPlan } from '../discovery/paywall'

describe('buildPaywallPlan', () => {
  it('builds canonical-first plan with default alternates', () => {
    const plan = buildPaywallPlan({ canonicalUrl: 'https://example.com/news/story' })
    const branches = plan.map((entry) => entry.branch)

    expect(plan[0]).toEqual({
      branch: 'canonical',
      url: 'https://example.com/news/story'
    })
    expect(branches).toContain('amp')
    expect(branches).toContain('mobile')
    expect(branches).toContain('print')
    expect(plan.length).toBeGreaterThanOrEqual(4)
  })

  it('includes primary and mirror urls from metadata without duplicates', () => {
    const plan = buildPaywallPlan({
      canonicalUrl: 'https://site.com/article',
      meta: {
        primaryUrls: ['https://official.gov/doc'],
        mirrorUrls: ['https://mirror.example.com/doc', 'https://mirror.example.com/doc']
      }
    })

    const branches = plan.map((entry) => entry.branch)
    expect(branches).toContain('primary')
    expect(branches.filter((branch) => branch.startsWith('mirror')).length).toBe(1)
    const urls = new Set(plan.map((entry) => entry.url))
    expect(urls.size).toEqual(plan.length)
  })
})

