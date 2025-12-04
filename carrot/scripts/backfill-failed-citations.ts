/**
 * Backfill Pass Script
 * Reprocesses citations where scanStatus IN ('not_scanned', 'scanned_denied') and updatedAt > cutoff
 */

import { prisma } from '../src/lib/prisma'
import { reprocessCitation } from '../src/lib/discovery/wikipediaProcessor'
import pLimit from 'p-limit'

async function main() {
  const patchHandle = process.argv[2] || 'israel'
  const cutoffDays = Number(process.argv[3]) || 7 // Default: last 7 days
  const concurrency = Number(process.argv[4]) || 5
  const limit = Number(process.argv[5]) || 500
  
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })
  
  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays)
  
  // Find citations to reprocess
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: { in: ['not_scanned', 'scanned_denied'] },
      updatedAt: { gte: cutoffDate }
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true
    }
  })
  
  console.log(`\n=== Backfill Pass ===`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Found ${citations.length} citations to reprocess`)
  console.log(`Cutoff date: ${cutoffDate.toISOString()}`)
  console.log(`Concurrency: ${concurrency}`)
  console.log(`Limit: ${limit}\n`)
  
  if (citations.length === 0) {
    console.log('No citations to reprocess')
    process.exit(0)
  }
  
  const limitConc = pLimit(concurrency)
  let success = 0
  let failed = 0
  const failedUrls: string[] = []
  
  await Promise.all(
    citations.map(citation =>
      limitConc(async () => {
        try {
          const result = await reprocessCitation(citation.id)
          if (result.processed && result.saved) {
            success++
            console.log(`✅ Reprocessed and saved: ${citation.citationUrl}`)
          } else if (result.processed) {
            success++
            console.log(`⚠️ Reprocessed but not saved: ${citation.citationUrl}`)
          } else {
            failed++
            failedUrls.push(citation.citationUrl)
            console.log(`❌ Failed to reprocess: ${citation.citationUrl}`)
          }
        } catch (error) {
          failed++
          failedUrls.push(citation.citationUrl)
          console.error(`❌ Error reprocessing ${citation.citationUrl}:`, error)
        }
      })
    )
  )
  
  console.log(`\n=== Backfill Complete ===`)
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log(`Success rate: ${((success / citations.length) * 100).toFixed(1)}%`)
  
  if (failedUrls.length > 0) {
    console.log(`\nFailed URLs (first 10):`)
    failedUrls.slice(0, 10).forEach(url => console.log(`  - ${url}`))
  }
  
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

