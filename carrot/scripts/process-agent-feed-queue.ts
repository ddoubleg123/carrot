/**
 * Process Agent Feed Queue
 * 
 * Processes all pending items in the agent memory feed queue
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { processFeedQueue } from '../src/lib/agent/feedWorker'

async function processQueue() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n🔄 Processing Agent Feed Queue for ${patch.title}\n`)

  const result = await processFeedQueue({
    patchId: patch.id,
    batchSize: 10,
    concurrency: 4
  })

  console.log(`\n📊 Results:`)
  console.log(`   Processed: ${result.processed}`)
  console.log(`   Succeeded: ${result.succeeded}`)
  console.log(`   Failed: ${result.failed}`)
  console.log()
}

processQueue()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

