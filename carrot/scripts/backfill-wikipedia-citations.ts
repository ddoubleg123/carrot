/**
 * Backfill script to re-extract citations from existing Wikipedia pages
 * This will update citations using the new extraction logic that captures
 * all sections (References, Further reading, External links)
 */

import { prisma } from '../src/lib/prisma'
import { extractAndStoreCitations } from '../src/lib/discovery/wikipediaCitation'
import { prioritizeCitations } from '../src/lib/discovery/wikipediaProcessor'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
  const limit = limitArg ? parseInt(limitArg) : undefined

  console.log(`\n=== Backfilling Wikipedia Citations ===\n`)
  console.log(`Patch: ${patchHandle}`)
  if (limit) {
    console.log(`Limit: ${limit} pages`)
  }

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Get all Wikipedia pages in monitoring
  const pages = await prisma.wikipediaMonitoring.findMany({
    where: {
      patchId: patch.id,
      citationsExtracted: true // Only re-process pages that have been extracted before
    },
    orderBy: {
      lastExtractedAt: 'asc' // Process oldest first
    },
    take: limit
  })

  console.log(`\nFound ${pages.length} Wikipedia pages to backfill\n`)

  if (pages.length === 0) {
    console.log('No pages to backfill')
    process.exit(0)
  }

  let processed = 0
  let updated = 0
  let errors = 0

  for (const page of pages) {
    try {
      console.log(`\n[${processed + 1}/${pages.length}] Processing: ${page.wikipediaTitle}`)
      
      // Fetch HTML
      const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.wikipediaTitle)}`
      const response = await fetch(wikipediaUrl, {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
          'Accept': 'text/html'
        }
      })

      if (!response.ok) {
        console.error(`  ❌ Failed to fetch: HTTP ${response.status}`)
        errors++
        continue
      }

      const html = await response.text()
      console.log(`  ✅ Fetched HTML (${html.length} bytes)`)

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

      console.log(`  ✅ Extracted ${result.citationsFound} citations, stored ${result.citationsStored} new ones`)
      
      if (result.citationsStored > 0) {
        updated++
      }
      
      processed++

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay between pages
    } catch (error) {
      console.error(`  ❌ Error processing ${page.wikipediaTitle}:`, error)
      errors++
    }
  }

  console.log(`\n=== Backfill Complete ===`)
  console.log(`Processed: ${processed}/${pages.length}`)
  console.log(`Updated: ${updated} pages with new citations`)
  console.log(`Errors: ${errors}`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

