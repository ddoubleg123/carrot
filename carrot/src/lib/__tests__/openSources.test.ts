import { OPEN_SOURCES } from '../curator/openSources'
import { alternateFeed, fillQuery, listedPages } from '../curator/read'

describe('open sources', () => {
  it('reads a page out of a record and a feed out of a site', () => {
    const pages = listedPages(
      '{"articles":[{"title":"A hearing on the bill","url":"https://www.congress.gov/hearing/1"}]}',
      'https://example.test/records'
    )
    expect(pages[0].url).toBe('https://www.congress.gov/hearing/1')
    const html = '<link rel="alternate" type="application/rss+xml" href="/feed/" /><a href="/about">About</a><a href="/2024/rome-road">Rome found a new road</a>'
    expect(alternateFeed(html, 'https://www.livius.org/')).toBe('https://www.livius.org/feed/')
    const links = listedPages(html, 'https://www.livius.org/')
    expect(links.map((item) => item.url)).toEqual(['https://www.livius.org/2024/rome-road'])
    expect(fillQuery('https://example.test/?q={q}', 'Israel and Palestine')).toBe('https://example.test/?q=Israel%20and%20Palestine')
  })

  it('attaches sites and records, and leaves keyed feeds out', () => {
    const blob = JSON.stringify(OPEN_SOURCES)
    expect(blob).not.toMatch(/api_key=KEY|apikey=KEY|wss:\/\//)
    expect(blob).not.toContain('/CHANNEL')
    const israel = OPEN_SOURCES['Israel and Palestine'].map((source) => source.name)
    expect(israel).toContain('Haaretz')
    expect(israel).toContain("B'Tselem")
    expect(Object.keys(OPEN_SOURCES).length).toBeGreaterThan(80)
  })
})
