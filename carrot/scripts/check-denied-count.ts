/**
 * Check Total Denied Citations Count
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function checkCount() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  const total = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id }
    }
  })

  const totalDenied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied'
    }
  })

  const unprocessed = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null
    }
  })

  const saved = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    }
  })

  const scanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned'
    }
  })

  const notScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'not_scanned'
    }
  })

  console.log(`\n📊 Citation Statistics for ${patch.title}:`)
  console.log(`   Total citations: ${total}`)
  console.log(`   Scanned: ${scanned}`)
  console.log(`   Not scanned: ${notScanned}`)
  console.log(`   Saved: ${saved}`)
  console.log(`   Denied: ${totalDenied}`)
  console.log(`   Ready to process: ${unprocessed}`)
  console.log()
  
  // Check all patches if user wants
  const allDenied = await prisma.wikipediaCitation.count({
    where: {
      relevanceDecision: 'denied'
    }
  })
  
  console.log(`📊 Across ALL Patches:`)
  console.log(`   Total denied: ${allDenied}`)
  console.log()
}

checkCount()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

