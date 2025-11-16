import { getPathDepth, isLikelyDeepLink, passesDeepLinkFilters } from '@/lib/discovery/filters'

describe('deep link filters', () => {
  it('path depth', () => {
    expect(getPathDepth('https://example.com/')).toBe(0)
    expect(getPathDepth('https://example.com/a/')).toBe(1)
    expect(getPathDepth('https://example.com/a/b')).toBe(2)
  })

  it('likely deep link detection', () => {
    expect(isLikelyDeepLink('https://example.com/')).toBe(false)
    expect(isLikelyDeepLink('https://example.com/sports/')).toBe(true)
    expect(isLikelyDeepLink('https://example.com/news/story-123')).toBe(true)
    expect(isLikelyDeepLink('https://example.com/files/report.pdf')).toBe(true)
  })

  it('passes deep link filters with recency', () => {
    const fresh = new Date()
    const old = new Date()
    old.setFullYear(old.getFullYear() - 3)
    expect(passesDeepLinkFilters('https://espn.com/nba/story', 'espn.com', fresh)).toBe(true)
    expect(passesDeepLinkFilters('https://espn.com/nba/story', 'espn.com', old)).toBe(false)
    // Official exempt
    expect(passesDeepLinkFilters('https://sec.gov/files/report.pdf', 'sec.gov', old)).toBe(true)
    // Reject wiki hosts
    expect(passesDeepLinkFilters('https://en.wikipedia.org/wiki/Chicago_Bulls', 'en.wikipedia.org', fresh)).toBe(false)
  })
})


