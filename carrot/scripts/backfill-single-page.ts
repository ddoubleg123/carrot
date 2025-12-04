/**
 * Backfill a single Wikipedia page
 */

import { prisma } from '../src/lib/prisma'
import { extractAndStoreCitations } from '../src/lib/discovery/wikipediaCitation'
import { prioritizeCitations } from '../src/lib/discovery/wikipediaProcessor'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const wikiTitle = args.find(a => a.startsWith('--wiki-title='))?.split('=')[1]

  if (!wikiTitle) {
    console.error('Usage: npx tsx scripts/backfill-single-page.ts --patch=israel --wiki-title=Zionism')
    process.exit(1)
  }

  console.log(`\n=== Backfilling Single Wikipedia Page ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Get the page
  const page = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId: patch.id,
      wikipediaTitle: wikiTitle
    }
  })

  if (!page) {
    console.error(`❌ Wikipedia page "${wikiTitle}" not found in monitoring`)
    process.exit(1)
  }

  console.log(`Found page: ${page.wikipediaTitle} (ID: ${page.id})\n`)

  // Fetch HTML
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

  // Extract citations using new logic
  const prioritizeFn = async (citations: any[], sourceUrl: string) => {
    return prioritizeCitations(citations, sourceUrl, patch.title, [patchHandle])
  }

  const result = await extractAndStoreCitations(
    page.id,
    wikipediaUrl,
    html,
    prioritizeFn
  )

  console.log(`\n=== Results ===`)
  console.log(`Citations found: ${result.citationsFound}`)
  console.log(`Citations stored: ${result.citationsStored}`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

