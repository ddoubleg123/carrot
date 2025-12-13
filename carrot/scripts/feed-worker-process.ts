/**
 * Feed Worker Process
 * 
 * Continuously processes AgentMemoryFeedQueue to feed discovered content to agents
 * Runs indefinitely, processing queue items every few seconds
 * 
 * Usage:
 *   ts-node scripts/feed-worker-process.ts
 */

import 'dotenv/config'
import { processFeedQueue } from '../src/lib/agent/feedWorker'

const PROCESS_INTERVAL = parseInt(process.env.AGENT_FEED_INTERVAL || '5000') // 5 seconds
const BATCH_SIZE = parseInt(process.env.AGENT_FEED_BATCH_SIZE || '10')

let isRunning = true
let processedTotal = 0
let failedTotal = 0

async function runWorker() {
  console.log('🚀 Starting feed worker process...')
  console.log(`   Interval: ${PROCESS_INTERVAL}ms`)
  console.log(`   Batch size: ${BATCH_SIZE}`)
  console.log('   Press Ctrl+C to stop\n')

  while (isRunning) {
    try {
      const result = await processFeedQueue({
        limit: BATCH_SIZE
      })

      processedTotal += result.processed
      failedTotal += result.failed

      if (result.processed > 0 || result.failed > 0) {
        console.log(`[${new Date().toISOString()}] Processed: ${result.processed}, Failed: ${result.failed}, Skipped: ${result.skipped}`)
        console.log(`   Total: ${processedTotal} processed, ${failedTotal} failed`)
      }

      // Wait before next batch
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL))
    } catch (error) {
      console.error('[Worker] Error:', error)
      // Wait a bit longer on error
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL * 2))
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping worker...')
  isRunning = false
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping worker...')
  isRunning = false
  process.exit(0)
})

runWorker().catch(console.error)

