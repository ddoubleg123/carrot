/**
 * Check enrichment status - see how many items have been cleaned
 */

import { prisma } from '@/lib/prisma'

async function checkStatus() {
  console.log('=== ENRICHMENT STATUS CHECK ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  const contentItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      metadata: true
    }
  })
  
  let cleaned = 0
  let failed = 0
  let notCleaned = 0
  
  contentItems.forEach(item => {
    const metadata = (item.metadata as any) || {}
    if (metadata.grammarCleaned) {
      cleaned++
    } else if (metadata.cleanupFailed) {
      failed++
    } else {
      notCleaned++
    }
  })
  
  console.log(`Total items: ${contentItems.length}`)
  console.log(`✅ Cleaned: ${cleaned} (${((cleaned / contentItems.length) * 100).toFixed(1)}%)`)
  console.log(`❌ Failed: ${failed} (${((failed / contentItems.length) * 100).toFixed(1)}%)`)
  console.log(`⏳ Not cleaned: ${notCleaned} (${((notCleaned / contentItems.length) * 100).toFixed(1)}%)`)
  
  if (cleaned > 0) {
    console.log(`\n✅ Enrichment is working! ${cleaned} items have been cleaned.`)
  } else if (failed > 0) {
    console.log(`\n⚠️  Some items failed cleanup. Check server logs.`)
  } else {
    console.log(`\n⏳ Enrichment hasn't run yet or is still in progress.`)
  }
}

checkStatus().catch(console.error)

