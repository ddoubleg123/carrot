/**
 * Investigate URL matching differences between audit and extraction
 */

import { prisma } from '../src/lib/prisma'
import { extractAllExternalUrls } from '../src/lib/discovery/wikiUtils'
import { canonicalizeUrlFast } from '../src/lib/discovery/canonicalize'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const wikiTitle = args.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Investigating URL Matching ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Fetch Wikipedia page
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`
  console.log(`Fetching: ${wikipediaUrl}`)
  
  const response = await fetch(wikipediaUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
      'Accept': 'text/html'
    }
  })

  if (!response.ok) {
    console.error(`❌ Failed to fetch: HTTP ${response.status}`)
    process.exit(1)
  }

  const html = await response.text()
  console.log(`✅ Fetched HTML (${html.length} bytes)\n`)

  // Extract external URLs using audit function
  const externalUrls = extractAllExternalUrls(html, wikipediaUrl)
  console.log(`External URLs found by audit: ${externalUrls.length}\n`)

  // Get database citations
  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId: patch.id,
      wikipediaTitle: wikiTitle
    },
    include: {
      citations: {
        where: {
          citationUrl: {
            not: { contains: 'wikipedia.org' }
          }
        },
        select: {
          citationUrl: true,
          sourceNumber: true
        }
      }
    }
  })

  if (!monitoring) {
    console.error(`❌ Monitoring entry not found`)
    process.exit(1)
  }

  console.log(`External URLs in database: ${monitoring.citations.length}\n`)

  // Create canonical URL sets for comparison
  const auditCanonical = new Set(externalUrls.map(u => canonicalizeUrlFast(u.url) || u.url))
  const dbCanonical = new Set(monitoring.citations.map(c => canonicalizeUrlFast(c.citationUrl) || c.citationUrl))

  console.log(`=== URL Matching Analysis ===\n`)
  console.log(`Audit canonical URLs: ${auditCanonical.size}`)
  console.log(`Database canonical URLs: ${dbCanonical.size}\n`)

  // Find matches
  const matches: string[] = []
  const auditOnly: string[] = []
  const dbOnly: string[] = []

  for (const url of auditCanonical) {
    if (dbCanonical.has(url)) {
      matches.push(url)
    } else {
      auditOnly.push(url)
    }
  }

  for (const url of dbCanonical) {
    if (!auditCanonical.has(url)) {
      dbOnly.push(url)
    }
  }

  console.log(`Matches: ${matches.length}`)
  console.log(`Only in audit: ${auditOnly.length}`)
  console.log(`Only in database: ${dbOnly.length}\n`)

  if (auditOnly.length > 0) {
    console.log(`=== URLs Only in Audit (first 10) ===`)
    auditOnly.slice(0, 10).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)
      // Find original URL
      const original = externalUrls.find(u => (canonicalizeUrlFast(u.url) || u.url) === url)
      if (original) {
        console.log(`     Original: ${original.url}`)
      }
    })
  }

  if (dbOnly.length > 0) {
    console.log(`\n=== URLs Only in Database (first 10) ===`)
    dbOnly.slice(0, 10).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)
      // Find original citation
      const citation = monitoring.citations.find(c => (canonicalizeUrlFast(c.citationUrl) || c.citationUrl) === url)
      if (citation) {
        console.log(`     Original: ${citation.citationUrl}`)
        console.log(`     Source #: ${citation.sourceNumber}`)
      }
    })
  }

  // Check for URL variations
  console.log(`\n=== Checking URL Variations ===\n`)
  
  let variationsFound = 0
  for (const auditUrl of auditOnly.slice(0, 5)) {
    // Try to find similar URLs in database
    const similar = dbOnly.filter(dbUrl => {
      try {
        const auditHost = new URL(auditUrl).hostname
        const dbHost = new URL(dbUrl).hostname
        return auditHost === dbHost
      } catch {
        return false
      }
    })
    
    if (similar.length > 0) {
      variationsFound++
      console.log(`Audit URL: ${auditUrl}`)
      console.log(`  Similar in DB:`)
      similar.forEach(s => console.log(`    - ${s}`))
    }
  }

  if (variationsFound === 0) {
    console.log(`No obvious URL variations found`)
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

