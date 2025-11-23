#!/usr/bin/env tsx
/**
 * Backfill script: Promote all eligible Source records to Hero records
 * Usage: tsx scripts/backfill-promote-all.ts [patchId]
 */

import { prisma } from '../src/lib/prisma'
import { enrichContentId } from '../src/lib/enrichment/worker'

async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  options: { concurrency: number }
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += options.concurrency) {
    const batch = items.slice(i, i + options.concurrency)
    const batchResults = await Promise.all(batch.map(mapper))
    results.push(...batchResults)
  }
  return results
}

async function backfillPromote(patchId?: string) {
  console.log('[Backfill Promote] Starting...', { patchId: patchId || 'all patches' })
  
  const whereClause = patchId 
    ? { patchId }
    : {}
  
  // Find all content without heroes
  const contentWithoutHeroes = await prisma.discoveredContent.findMany({
    where: {
      ...whereClause,
      heroRecord: null,
      textContent: { not: null },
      NOT: { textContent: '' }
    },
    select: {
      id: true,
      patchId: true,
      title: true,
      canonicalUrl: true,
      textContent: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`[Backfill Promote] Found ${contentWithoutHeroes.length} content items without heroes`)
  
  if (contentWithoutHeroes.length === 0) {
    console.log('[Backfill Promote] No content to promote')
    return
  }
  
  // Group by patch
  const byPatch = new Map<string, typeof contentWithoutHeroes>()
  for (const item of contentWithoutHeroes) {
    if (!byPatch.has(item.patchId)) {
      byPatch.set(item.patchId, [])
    }
    byPatch.get(item.patchId)!.push(item)
  }
  
  console.log(`[Backfill Promote] Processing ${byPatch.size} patches`)
  
  const results = await pMap(
    contentWithoutHeroes,
    async (content) => {
      try {
        const result = await enrichContentId(content.id)
        return {
          contentId: content.id,
          patchId: content.patchId,
          title: content.title,
          ...result
        }
      } catch (error: any) {
        return {
          contentId: content.id,
          patchId: content.patchId,
          title: content.title,
          ok: false,
          errorCode: 'ENRICHMENT_ERROR',
          errorMessage: error.message
        }
      }
    },
    { concurrency: 5 }
  )
  
  const created = results.filter(r => r.ok && 'heroId' in r && r.heroId).length
  const updated = results.filter(r => r.ok && (!('heroId' in r) || !r.heroId)).length
  const failed = results.filter(r => !r.ok).length
  
  // Summary by patch
  const summaryByPatch = new Map<string, { created: number; updated: number; failed: number }>()
  for (const result of results) {
    if (!summaryByPatch.has(result.patchId)) {
      summaryByPatch.set(result.patchId, { created: 0, updated: 0, failed: 0 })
    }
    const summary = summaryByPatch.get(result.patchId)!
    if (!result.ok) {
      summary.failed++
    } else if ('heroId' in result && result.heroId) {
      summary.created++
    } else {
      summary.updated++
    }
  }
  
  console.log('\n[Backfill Promote] Summary:')
  console.log(`  Total: ${results.length}`)
  console.log(`  Created: ${created}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)
  
  console.log('\n[Backfill Promote] By Patch:')
  for (const [patchId, summary] of summaryByPatch.entries()) {
    const patch = await prisma.patch.findUnique({
      where: { id: patchId },
      select: { handle: true, title: true }
    })
    console.log(`  ${patch?.handle || patchId} (${patch?.title || 'Unknown'}):`, summary)
  }
  
  console.log('\n[Backfill Promote] ✅ Complete')
}

// Run if called directly
if (require.main === module) {
  const patchId = process.argv[2]
  backfillPromote(patchId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[Backfill Promote] Error:', error)
      process.exit(1)
    })
}

export { backfillPromote }

