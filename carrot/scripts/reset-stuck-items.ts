#!/usr/bin/env tsx
/**
 * Reset Stuck Queue Items
 * 
 * Resets items stuck in PROCESSING state back to PENDING
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetStuckItems() {
  console.log('\n🔄 Resetting stuck queue items...\n')

  // Find items stuck in PROCESSING for > 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  
  const stuckItems = await (prisma as any).agentMemoryFeedQueue.findMany({
    where: {
      status: 'PROCESSING',
      pickedAt: { lt: fiveMinutesAgo }
    },
    select: {
      id: true,
      patchId: true,
      pickedAt: true,
      discoveredContentId: true
    }
  })

  console.log(`Found ${stuckItems.length} stuck items\n`)

  if (stuckItems.length === 0) {
    console.log('✅ No stuck items found')
    await prisma.$disconnect()
    return
  }

  let reset = 0
  for (const item of stuckItems) {
    await (prisma as any).agentMemoryFeedQueue.update({
      where: { id: item.id },
      data: {
        status: 'PENDING',
        pickedAt: null
      }
    })
    reset++
    console.log(`✅ Reset item ${item.id}`)
  }

  console.log(`\n✅ Reset ${reset} stuck items`)
  await prisma.$disconnect()
}

resetStuckItems()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

