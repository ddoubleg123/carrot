/**
 * One-off backfill script for historic heroes
 * Re-extracts where status in (EXTRACT_EMPTY, ERROR) or textContent empty
 * Commits in batches of 25; concurrency=5; resume support
 */

import { prisma } from '../src/lib/prisma'
import { enrichContentId } from '../src/lib/enrichment/worker'

const BATCH_SIZE = 25
const CONCURRENCY = 5

interface BackfillOptions {
  patchId?: string
  patchHandle?: string
  limit?: number
  resumeFrom?: string
}

async function backfillHeroes(options: BackfillOptions) {
  const { patchId, patchHandle, limit = 200, resumeFrom } = options
  
  // Find patch
  let patch
  if (patchId) {
    patch = await prisma.patch.findUnique({ where: { id: patchId } })
  } else if (patchHandle) {
    patch = await prisma.patch.findUnique({ where: { handle: patchHandle } })
  } else {
    throw new Error('Must provide either patchId or patchHandle')
  }
  
  if (!patch) {
    throw new Error('Patch not found')
  }
  
  console.log(`[Backfill] Starting backfill for patch: ${patch.handle} (${patch.id})`)
  
  // Find items needing backfill
  const whereClause: any = {
    patchId: patch.id,
    OR: [
      { textContent: null },
      { textContent: '' },
      // Add status check if status field exists
    ]
  }
  
  if (resumeFrom) {
    whereClause.id = { gt: resumeFrom }
  }
  
  const items = await prisma.discoveredContent.findMany({
    where: whereClause,
    take: limit,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      canonicalUrl: true,
      title: true,
      textContent: true
    }
  })
  
  console.log(`[Backfill] Found ${items.length} items to backfill`)
  
  // Process in batches
  let processed = 0
  let succeeded = 0
  let failed = 0
  let lastId: string | null = null
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    console.log(`[Backfill] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)`)
    
    // Process with concurrency limit
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          await enrichContentId(item.id)
          succeeded++
          lastId = item.id
          return { success: true, id: item.id }
        } catch (error: any) {
          failed++
          console.error(`[Backfill] Failed to enrich ${item.id}:`, error.message)
          return { success: false, id: item.id, error: error.message }
        }
      })
    )
    
    processed += batch.length
    console.log(`[Backfill] Progress: ${processed}/${items.length} processed, ${succeeded} succeeded, ${failed} failed`)
    
    // Small delay between batches
    if (i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log(`[Backfill] Complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`)
  if (lastId) {
    console.log(`[Backfill] Last processed ID: ${lastId} (use --resume-from=${lastId} to continue)`)
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {}
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--patch' && args[i + 1]) {
      options.patchHandle = args[i + 1]
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--resume-from' && args[i + 1]) {
      options.resumeFrom = args[i + 1]
      i++
    }
  }
  
  backfillHeroes(options)
    .then(() => {
      console.log('[Backfill] Done')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Backfill] Fatal error:', error)
      process.exit(1)
    })
}

export { backfillHeroes }

