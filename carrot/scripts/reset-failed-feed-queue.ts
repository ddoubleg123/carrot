/**
 * Reset failed feed queue items to PENDING
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function resetFailed() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log('Resetting failed feed queue items...\n')

  const result = await (prisma as any).agentMemoryFeedQueue.updateMany({
    where: {
      patchId: patch.id,
      status: 'FAILED'
    },
    data: {
      status: 'PENDING',
      lastError: null,
      attempts: 0
    }
  })

  console.log(`✅ Reset ${result.count} failed items to PENDING\n`)
}

resetFailed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

