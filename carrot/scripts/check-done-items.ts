#!/usr/bin/env tsx
/**
 * Check Done Queue Items
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDoneItems() {
  const items = await (prisma as any).agentMemoryFeedQueue.findMany({
    where: { status: 'DONE' },
    take: 5,
    select: {
      id: true,
      lastError: true,
      discoveredContentId: true,
      patchId: true
    }
  })

  console.log(`Found ${items.length} DONE items (showing first 5):\n`)
  console.log(JSON.stringify(items, null, 2))

  // Check if AgentMemory entries exist
  for (const item of items) {
    if (item.discoveredContentId) {
      const memory = await prisma.agentMemory.findFirst({
        where: {
          discoveredContentId: item.discoveredContentId,
          patchId: item.patchId
        }
      })
      console.log(`\nItem ${item.id}:`)
      console.log(`  DiscoveredContentId: ${item.discoveredContentId}`)
      console.log(`  AgentMemory exists: ${memory ? 'YES' : 'NO'}`)
      if (item.lastError) {
        console.log(`  Last Error: ${item.lastError}`)
      }
    }
  }

  await prisma.$disconnect()
}

checkDoneItems()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

