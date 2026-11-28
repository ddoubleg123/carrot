/**
 * Manually process agent feed queue for israel patch
 * Processes all PENDING items to create agent memories
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { processFeedQueue } from '../src/lib/agent/feedWorker'

const PATCH_HANDLE = 'israel'

async function main() {
  console.log('\n🚀 Processing Agent Feed Queue\n')
  console.log(`Patch: ${PATCH_HANDLE}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  console.log(`✅ Patch: ${patch.title} (${patch.id})\n`)

  // Check current queue status
  const queueItems = await (prisma as any).agentMemoryFeedQueue.findMany({
    where: {
      patchId: patch.id,
      status: 'PENDING'
    },
    select: {
      id: true,
      discoveredContentId: true
    }
  })

  console.log(`📊 Found ${queueItems.length} PENDING items\n`)

  if (queueItems.length === 0) {
    console.log('✅ No pending items to process')
    return
  }

  console.log(`🔄 Processing queue items...\n`)
  console.log('='.repeat(80))

  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 20
  let totalProcessed = 0
  let totalFailed = 0
  let totalSkipped = 0

  for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
    const batch = queueItems.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`)

    try {
      const result = await processFeedQueue({
        patchId: patch.id,
        limit: BATCH_SIZE
      })

      totalProcessed += result.processed
      totalFailed += result.failed
      totalSkipped += result.skipped

      console.log(`   ✅ Processed: ${result.processed}`)
      console.log(`   ❌ Failed: ${result.failed}`)
      console.log(`   ⏭️  Skipped: ${result.skipped}`)

      // Small delay between batches
      if (i + BATCH_SIZE < queueItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`   ❌ Error processing batch:`, error)
      totalFailed += batch.length
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 FINAL RESULTS\n')
  console.log(`Total Processed: ${totalProcessed}`)
  console.log(`Total Failed: ${totalFailed}`)
  console.log(`Total Skipped: ${totalSkipped}`)

  // Check final status
  const finalQueue = await (prisma as any).agentMemoryFeedQueue.findMany({
    where: {
      patchId: patch.id
    },
    select: {
      status: true
    }
  })

  const statusCounts = {
    PENDING: finalQueue.filter((q: any) => q.status === 'PENDING').length,
    PROCESSING: finalQueue.filter((q: any) => q.status === 'PROCESSING').length,
    DONE: finalQueue.filter((q: any) => q.status === 'DONE').length,
    FAILED: finalQueue.filter((q: any) => q.status === 'FAILED').length
  }

  console.log(`\n📈 Queue Status:`)
  console.log(`   PENDING: ${statusCounts.PENDING}`)
  console.log(`   DONE: ${statusCounts.DONE}`)
  console.log(`   FAILED: ${statusCounts.FAILED}`)

  // Check agent memories
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: { id: true }
  })

  const agentMemories = await prisma.agentMemory.findMany({
    where: {
      patchId: patch.id,
      discoveredContentId: { in: savedContent.map(s => s.id) }
    },
    select: { id: true }
  })

  console.log(`\n🧠 Agent Memories: ${agentMemories.length}/${savedContent.length} (${((agentMemories.length / savedContent.length) * 100).toFixed(1)}%)\n`)

  if (statusCounts.PENDING > 0) {
    console.log(`⚠️  Warning: ${statusCounts.PENDING} items still PENDING`)
    console.log(`   You may need to run this script again or check for errors\n`)
  } else {
    console.log(`✅ All items processed!\n`)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

