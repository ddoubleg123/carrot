/**
 * Reset failed citations to pending status for reprocessing
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function resetFailedCitations(patchHandle: string) {
  console.log(`\n🔄 Resetting failed citations for patch: ${patchHandle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Count failed citations
  const failedCount = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'failed'
    }
  })

  console.log(`📊 Found ${failedCount.toLocaleString()} failed citations\n`)

  if (failedCount === 0) {
    console.log('✅ No failed citations to reset')
    return
  }

  // Reset failed citations to pending
  const result = await prisma.wikipediaCitation.updateMany({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'failed'
    },
    data: {
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      savedContentId: null
    }
  })

  console.log(`✅ Reset ${result.count.toLocaleString()} failed citations to pending status\n`)
}

async function main() {
  const patchHandle = process.argv[2] || 'israel'
  
  try {
    await resetFailedCitations(patchHandle)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

