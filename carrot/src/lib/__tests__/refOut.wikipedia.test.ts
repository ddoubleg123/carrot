import { extractOffHostLinks } from '@/lib/discovery/refOut'

const WIKI_FIXTURE = `
<html>
  <body>
    <h2>References</h2>
    <ol class="references">
      <li><a href="https://www.espn.com/nba/team/_/name/chi/chicago-bulls">ESPN Bulls</a></li>
      <li><a href="https://www.basketball-reference.com/teams/CHI/">BBRef Bulls</a></li>
      <li><a href="https://www.chicagotribune.com/sports/nba/chicago-bulls/">Chicago Tribune Bulls</a></li>
      <li><a href="/wiki/Chicago_Bulls">Internal Wiki Link</a></li>
      <li><a href="mailto:test@example.com">Mail</a></li>
      <li><a href="javascript:void(0)">JS</a></li>
      <li><a href="https://nbcchicago.com/tag/chicago-bulls/">NBC Tag</a></li>
      <li><a href="https://www.nba.com/bulls/news">NBA News</a></li>
      <li><a href="#section">Anchor</a></li>
    </ol>
  </body>
</html>
`

describe('extractOffHostLinks (Wikipedia)', () => {
  it('extracts off-host http(s) links and drops same-host/anchors/mailto/js', async () => {
    const base = 'https://en.wikipedia.org/wiki/Chicago_Bulls'
    const links = await extractOffHostLinks(WIKI_FIXTURE, base, { maxLinks: 20 })
    expect(Array.isArray(links)).toBe(true)
    // Should not include en.wikipedia.org links
    expect(links.find(l => l.url.includes('wikipedia.org'))).toBeUndefined()
    // Should include off-host links
    const hosts = new Set(links.map(l => l.sourceHost))
    expect(hosts.size).toBeGreaterThanOrEqual(3)
    // Only http(s)
    expect(links.every(l => l.url.startsWith('http'))).toBe(true)
    // Has pathDepth computed
    expect(links.every(l => typeof l.pathDepth === 'number')).toBe(true)
  })
})


