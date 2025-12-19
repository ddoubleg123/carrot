#!/usr/bin/env tsx
/**
 * Automatic Agent Feed Worker
 * 
 * Continuously processes agent feed queues and verifies system health
 * Runs automatically with built-in verification
 * 
 * Usage:
 *   npx tsx scripts/auto-feed-worker.ts
 * 
 * Environment Variables:
 *   AGENT_FEED_INTERVAL - Processing interval in ms (default: 10000)
 *   AGENT_FEED_BATCH_SIZE - Items per batch (default: 20)
 *   AGENT_FEED_VERIFY_INTERVAL - Verification interval in ms (default: 60000)
 */

import 'dotenv/config'
import { processFeedQueue } from '../src/lib/agent/feedWorker'
import { prisma } from '../src/lib/prisma'
import { selfAuditAndFix } from './self-audit-and-fix'

const PROCESS_INTERVAL = parseInt(process.env.AGENT_FEED_INTERVAL || '10000') // 10 seconds
const BATCH_SIZE = parseInt(process.env.AGENT_FEED_BATCH_SIZE || '20')
const VERIFY_INTERVAL = parseInt(process.env.AGENT_FEED_VERIFY_INTERVAL || '60000') // 1 minute
const AUDIT_INTERVAL = parseInt(process.env.SELF_AUDIT_INTERVAL || '3600000') // 1 hour

let isRunning = true
let processedTotal = 0
let failedTotal = 0
let lastVerification: Date | null = null
let lastAudit: Date | null = null

async function processAllQueues() {
  try {
    // Get all patches with pending items
    const patchesWithQueue = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: { status: 'PENDING' },
      select: { patchId: true },
      distinct: ['patchId']
    })

    const patchIds = [...new Set(patchesWithQueue.map((q: any) => q.patchId))]

    if (patchIds.length === 0) {
      return { processed: 0, failed: 0, skipped: 0 }
    }

    let totalProcessed = 0
    let totalFailed = 0

    // Process each patch
    for (const patchId of patchIds) {
      try {
        const result = await processFeedQueue({
          patchId,
          limit: BATCH_SIZE
        })

        totalProcessed += result.processed
        totalFailed += result.failed
      } catch (error) {
        console.error(`[AutoFeedWorker] Error processing patch ${patchId}:`, error)
        totalFailed++
      }
    }

    return { processed: totalProcessed, failed: totalFailed, skipped: 0 }
  } catch (error) {
    console.error('[AutoFeedWorker] Error processing queues:', error)
    return { processed: 0, failed: 1, skipped: 0 }
  }
}

async function verifySystem() {
  try {
    // Get overall stats
    const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
      by: ['status'],
      _count: true
    })

    const stats = {
      PENDING: 0,
      PROCESSING: 0,
      DONE: 0,
      FAILED: 0
    }

    for (const stat of queueStats) {
      stats[stat.status as keyof typeof stats] = stat._count
    }

    // Check for stuck items (PROCESSING for > 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const stuckItems = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: {
        status: 'PROCESSING',
        pickedAt: { lt: fiveMinutesAgo }
      },
      select: { id: true, patchId: true, pickedAt: true }
    })

    if (stuckItems.length > 0) {
      console.warn(`[AutoFeedWorker] ⚠️  Found ${stuckItems.length} stuck items, resetting to PENDING`)
      // Reset stuck items
      for (const item of stuckItems) {
        await (prisma as any).agentMemoryFeedQueue.update({
          where: { id: item.id },
          data: { status: 'PENDING', pickedAt: null }
        })
      }
    }

    // Check for DiscoveredContent not in queue
    const allDiscoveredContent = await prisma.discoveredContent.findMany({
      select: { id: true, patchId: true }
    })

    const queuedContentIds = new Set(
      (await (prisma as any).agentMemoryFeedQueue.findMany({
        select: { discoveredContentId: true }
      })).map((q: any) => q.discoveredContentId)
    )

    const missingContent = allDiscoveredContent.filter(
      c => !queuedContentIds.has(c.id)
    )

    if (missingContent.length > 0) {
      console.warn(`[AutoFeedWorker] ⚠️  Found ${missingContent.length} DiscoveredContent items not in queue`)
      // Could auto-enqueue here, but that's handled by the sync endpoint
    }

    console.log(`[AutoFeedWorker] ✅ Verification complete:`)
    console.log(`   Queue: ${stats.PENDING} pending, ${stats.PROCESSING} processing, ${stats.DONE} done, ${stats.FAILED} failed`)
    console.log(`   Stuck items: ${stuckItems.length}`)
    console.log(`   Missing from queue: ${missingContent.length}`)

    lastVerification = new Date()
  } catch (error) {
    console.error('[AutoFeedWorker] Verification error:', error)
  }
}

async function runWorker() {
  console.log('🚀 Starting automatic agent feed worker...')
  console.log(`   Processing interval: ${PROCESS_INTERVAL}ms`)
  console.log(`   Batch size: ${BATCH_SIZE}`)
  console.log(`   Verification interval: ${VERIFY_INTERVAL}ms`)
  console.log('   Press Ctrl+C to stop\n')

  let lastProcessTime = Date.now()

  // Initial verification
  await verifySystem()

  while (isRunning) {
    try {
      const now = Date.now()

      // Process queues
      const result = await processAllQueues()
      processedTotal += result.processed
      failedTotal += result.failed

      if (result.processed > 0 || result.failed > 0) {
        console.log(`[${new Date().toISOString()}] Processed: ${result.processed}, Failed: ${result.failed}`)
        console.log(`   Total: ${processedTotal} processed, ${failedTotal} failed`)
      }

      // Periodic verification
      if (now - lastProcessTime >= VERIFY_INTERVAL) {
        await verifySystem()
        lastProcessTime = now
      }

      // Periodic self-audit and auto-fix
      if (!lastAudit || (now - lastAudit.getTime()) >= AUDIT_INTERVAL) {
        console.log('[AutoFeedWorker] 🔍 Running self-audit and auto-fix...')
        try {
          const auditResults = await selfAuditAndFix()
          console.log(`[AutoFeedWorker] ✅ Self-audit complete:`)
          console.log(`   Fixed ${auditResults.untitledFixed} untitled items`)
          console.log(`   Fixed ${auditResults.agentMemoryFixed} AgentMemory entries`)
          console.log(`   Reset ${auditResults.stuckQueueItemsReset} stuck queue items`)
          if (auditResults.errors.length > 0) {
            console.warn(`   Errors: ${auditResults.errors.length}`)
          }
          lastAudit = new Date()
        } catch (error) {
          console.error('[AutoFeedWorker] Self-audit error:', error)
        }
      }

      // Wait before next batch
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL))
    } catch (error) {
      console.error('[AutoFeedWorker] Error:', error)
      // Wait a bit longer on error
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL * 2))
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AutoFeedWorker] Shutting down gracefully...')
  isRunning = false
  prisma.$disconnect().then(() => {
    console.log('[AutoFeedWorker] Disconnected from database')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n[AutoFeedWorker] Shutting down gracefully...')
  isRunning = false
  prisma.$disconnect().then(() => {
    console.log('[AutoFeedWorker] Disconnected from database')
    process.exit(0)
  })
})

// Start worker
runWorker().catch((error) => {
  console.error('[AutoFeedWorker] Fatal error:', error)
  process.exit(1)
})

