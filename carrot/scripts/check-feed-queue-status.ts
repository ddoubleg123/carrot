/**
 * Check AgentMemoryFeedQueue status for israel patch
 * Identifies why saved content doesn't have agent memories
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

async function main() {
  console.log('\n🔍 Checking Agent Memory Feed Queue Status\n')
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

  // Get all saved content for this patch
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: {
      id: true,
      canonicalUrl: true,
      title: true,
      createdAt: true
    }
  })

  console.log(`📦 Saved Content: ${savedContent.length} items\n`)

  const contentIds = savedContent.map(s => s.id)

  // Get feed queue items
  const feedQueueItems = await prisma.agentMemoryFeedQueue.findMany({
    where: {
      discoveredContentId: { in: contentIds }
    },
    select: {
      id: true,
      discoveredContentId: true,
      status: true,
      enqueuedAt: true,
      pickedAt: true,
      attempts: true,
      lastError: true,
      priority: true
    }
  })

  // Get agent memories
  const agentMemories = await prisma.agentMemory.findMany({
    where: {
      patchId: patch.id,
      discoveredContentId: { in: contentIds }
    },
    select: {
      id: true,
      discoveredContentId: true,
      createdAt: true
    }
  })

  console.log('='.repeat(80))
  console.log('FEED QUEUE ANALYSIS\n')
  
  const queueMap = new Map(feedQueueItems.map(q => [q.discoveredContentId, q]))
  const memoryMap = new Map(agentMemories.map(m => [m.discoveredContentId, m]))

  const statusBreakdown = {
    PENDING: feedQueueItems.filter(q => q.status === 'PENDING').length,
    PROCESSING: feedQueueItems.filter(q => q.status === 'PROCESSING').length,
    DONE: feedQueueItems.filter(q => q.status === 'DONE').length,
    FAILED: feedQueueItems.filter(q => q.status === 'FAILED' || q.status === 'ERROR').length
  }

  console.log(`Feed Queue Items: ${feedQueueItems.length}`)
  console.log(`  - PENDING: ${statusBreakdown.PENDING}`)
  console.log(`  - PROCESSING: ${statusBreakdown.PROCESSING}`)
  console.log(`  - DONE: ${statusBreakdown.DONE}`)
  console.log(`  - FAILED/ERROR: ${statusBreakdown.FAILED}`)
  console.log(`  - With Errors: ${feedQueueItems.filter(q => q.lastError).length}`)

  console.log(`\nAgent Memories: ${agentMemories.length}`)

  // Analyze what's missing
  const notEnqueued = savedContent.filter(s => !queueMap.has(s.id))
  const enqueuedButNoMemory = feedQueueItems
    .filter(q => q.status === 'DONE' && !memoryMap.has(q.discoveredContentId))
    .map(q => ({ queueItem: q, contentId: q.discoveredContentId }))
  const failedItems = feedQueueItems.filter(q => q.status === 'FAILED' || q.lastError)

  console.log(`\n` + '='.repeat(80))
  console.log('ISSUES FOUND\n')

  if (notEnqueued.length > 0) {
    console.log(`❌ ${notEnqueued.length} saved items were NEVER ENQUEUED:`)
    console.log(`   These items were saved but never added to the feed queue.`)
    notEnqueued.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title} (${item.id})`)
      console.log(`      URL: ${item.canonicalUrl?.substring(0, 60)}...`)
    })
    if (notEnqueued.length > 10) {
      console.log(`   ... and ${notEnqueued.length - 10} more`)
    }
  }

  if (enqueuedButNoMemory.length > 0) {
    console.log(`\n⚠️  ${enqueuedButNoMemory.length} items marked DONE but NO MEMORY created:`)
    enqueuedButNoMemory.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. Content ID: ${item.contentId}`)
      console.log(`      Queue Status: ${item.queueItem.status}, Attempts: ${item.queueItem.attempts}`)
      if (item.queueItem.lastError) {
        console.log(`      Error: ${item.queueItem.lastError.substring(0, 100)}...`)
      }
    })
    if (enqueuedButNoMemory.length > 10) {
      console.log(`   ... and ${enqueuedButNoMemory.length - 10} more`)
    }
  }

  if (failedItems.length > 0) {
    console.log(`\n❌ ${failedItems.length} items FAILED processing:`)
    failedItems.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. Content ID: ${item.discoveredContentId}`)
      console.log(`      Status: ${item.status}, Attempts: ${item.attempts}`)
      if (item.lastError) {
        console.log(`      Error: ${item.lastError.substring(0, 200)}`)
      }
    })
    if (failedItems.length > 10) {
      console.log(`   ... and ${failedItems.length - 10} more`)
    }
  }

  if (statusBreakdown.PENDING > 0) {
    console.log(`\n⏳ ${statusBreakdown.PENDING} items are PENDING (waiting to be processed):`)
    const pending = feedQueueItems.filter(q => q.status === 'PENDING').slice(0, 5)
    pending.forEach((item, i) => {
      console.log(`   ${i + 1}. Content ID: ${item.discoveredContentId}`)
      console.log(`      Enqueued: ${item.enqueuedAt.toISOString()}`)
      const age = Date.now() - item.enqueuedAt.getTime()
      const ageHours = Math.floor(age / (1000 * 60 * 60))
      console.log(`      Age: ${ageHours} hours`)
    })
  }

  console.log(`\n` + '='.repeat(80))
  console.log('\n📊 SUMMARY\n')
  console.log(`Saved Content: ${savedContent.length}`)
  console.log(`Feed Queue Items: ${feedQueueItems.length}`)
  console.log(`Agent Memories: ${agentMemories.length}`)
  console.log(`\nMissing:`)
  console.log(`  - Not Enqueued: ${notEnqueued.length}`)
  console.log(`  - Enqueued but No Memory: ${enqueuedButNoMemory.length}`)
  console.log(`  - Failed: ${failedItems.length}`)
  console.log(`  - Pending: ${statusBreakdown.PENDING}`)
  console.log(`\n✅ Total Coverage: ${agentMemories.length}/${savedContent.length} (${((agentMemories.length / savedContent.length) * 100).toFixed(1)}%)\n`)
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

