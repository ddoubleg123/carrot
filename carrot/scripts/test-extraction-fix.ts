/**
 * Test the updated extraction function
 */

import { extractWikipediaCitationsWithContext } from '../src/lib/discovery/wikiUtils'

async function main() {
  const wikiTitle = process.argv.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Testing Extraction Fix ===\n`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  // Fetch REST API HTML
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  const restResponse = await fetch(restApiUrl, {
    headers: { 'User-Agent': 'CarrotBot/1.0', 'Accept': 'text/html' }
  })
  
  if (!restResponse.ok) {
    console.error(`❌ Failed: HTTP ${restResponse.status}`)
    process.exit(1)
  }

  const html = await restResponse.text()
  const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`

  console.log(`✅ Fetched HTML: ${html.length} bytes\n`)

  // Extract citations
  const citations = extractWikipediaCitationsWithContext(html, sourceUrl, 10000)

  console.log(`=== Extraction Results ===\n`)
  console.log(`Total citations extracted: ${citations.length}`)

  // Group by section
  const bySection = new Map<string, number>()
  citations.forEach(c => {
    const section = c.context?.match(/\[([^\]]+)\]/)?.[1] || 'Unknown'
    bySection.set(section, (bySection.get(section) || 0) + 1)
  })

  console.log(`\nBreakdown by section:`)
  Array.from(bySection.entries()).sort((a, b) => b[1] - a[1]).forEach(([section, count]) => {
    console.log(`  ${section}: ${count}`)
  })

  // Show sample URLs
  console.log(`\nFirst 20 URLs:`)
  citations.slice(0, 20).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.url}`)
    if (c.title) console.log(`     Title: ${c.title.substring(0, 80)}`)
  })

  // Count unique domains
  const domains = new Set<string>()
  citations.forEach(c => {
    try {
      const domain = new URL(c.url).hostname.replace(/^www\./, '')
      domains.add(domain)
    } catch {}
  })

  console.log(`\nUnique domains: ${domains.size}`)
  console.log(`\nTop 10 domains:`)
  const domainCounts = new Map<string, number>()
  citations.forEach(c => {
    try {
      const domain = new URL(c.url).hostname.replace(/^www\./, '')
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
    } catch {}
  })
  Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count}`)
    })

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

