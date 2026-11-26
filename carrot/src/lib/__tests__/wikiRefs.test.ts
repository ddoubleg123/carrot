import { rankCitations } from '../curator/wikiRefs'

describe('wikipedia citations', () => {
  it('keeps the documents a page cites and drops the encyclopedia itself', () => {
    const ranked = rankCitations([
      'https://en.wikipedia.org/wiki/Example',
      'https://www.jpost.com/israel-news/story',
      'https://www.congress.gov/bill/118th-congress/house-bill/1',
      'https://www.haaretz.com/israel-news/story',
      'https://www.congress.gov/bill/other',
      'https://www.un.org/press/en/story'
    ])
    expect(ranked[0]).toContain('congress.gov')
    expect(ranked.some((url) => url.includes('wikipedia.org'))).toBe(false)
    expect(ranked.some((url) => url.includes('jpost.com'))).toBe(true)
    expect(ranked.some((url) => url.includes('haaretz.com'))).toBe(true)
    expect(ranked.filter((url) => url.includes('congress.gov'))).toHaveLength(1)
  })
})
