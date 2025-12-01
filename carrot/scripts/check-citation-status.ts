/**
 * Check citation processing status
 * Run with: npx tsx scripts/check-citation-status.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function checkCitationStatus(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n📊 Citation Status for: ${patch.title} (${patch.handle})\n`)

  // Get status breakdown - use raw query to avoid ambiguous column error
  const statsRaw = await prisma.$queryRawUnsafe<Array<{
    verification_status: string
    scan_status: string
    count: bigint
  }>>(`
    SELECT 
      verification_status,
      scan_status,
      COUNT(*) as count
    FROM wikipedia_citations wc
    INNER JOIN wikipedia_monitoring wm ON wc.monitoring_id = wm.id
    WHERE wm.patch_id = $1
    GROUP BY verification_status, scan_status
    ORDER BY verification_status, scan_status
  `, patch.id)

  const stats = statsRaw.map(s => ({
    verificationStatus: s.verification_status,
    scanStatus: s.scan_status,
    _count: { id: Number(s.count) }
  }))

  console.log('Citation Status Breakdown:')
  stats.forEach(s => {
    console.log(`  ${s.verificationStatus}/${s.scanStatus}: ${s._count.id}`)
  })

  const total = await prisma.wikipediaCitation.count({
    where: { monitoring: { patchId: patch.id } }
  })

  const pending = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'pending',
      scanStatus: 'not_scanned'
    }
  })

  const verified = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'verified',
      scanStatus: 'scanned'
    }
  })

  const failed = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'failed'
    }
  })

  const verifiedButNotScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'verified',
      scanStatus: { not: 'scanned' }
    }
  })

  console.log(`\n📈 Summary:`)
  console.log(`  Total citations: ${total}`)
  console.log(`  Pending (not reviewed): ${pending}`)
  console.log(`  Verified & Fetched (scanned): ${verified}`)
  console.log(`  Failed verification: ${failed}`)
  console.log(`  Verified but not scanned: ${verifiedButNotScanned}`)
  console.log(`  Reviewed but not verified/fetched: ${total - pending - verified - failed - verifiedButNotScanned}`)

  // Check AgentMemory storage
  const agentMemories = await prisma.agentMemory.count({
    where: {
      sourceType: 'wikipedia_citation',
      tags: { has: patchHandle }
    }
  })

  console.log(`\n🧠 Agent Memory:`)
  console.log(`  Citations in AgentMemory: ${agentMemories}`)

  // Check how memories are tagged and which pages they came from
  const memorySamples = await prisma.agentMemory.findMany({
    where: {
      sourceType: 'wikipedia_citation',
      tags: { has: patchHandle }
    },
    select: { 
      tags: true,
      sourceUrl: true,
      sourceTitle: true
    },
    take: 5
  })

  if (memorySamples.length > 0) {
    console.log(`\n  Sample memory tags: ${JSON.stringify(memorySamples[0].tags)}`)
    console.log(`  Sample source: ${memorySamples[0].sourceTitle || memorySamples[0].sourceUrl}`)
  }

  // Check if memories are segregated by Wikipedia page
  const citationsWithMemory = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      savedMemoryId: { not: null }
    },
    include: {
      monitoring: {
        select: { wikipediaTitle: true }
      },
      savedMemory: {
        select: { tags: true }
      }
    },
    take: 5
  })

  if (citationsWithMemory.length > 0) {
    console.log(`\n📄 Memory Segregation by Wikipedia Page:`)
    citationsWithMemory.forEach(c => {
      console.log(`  Page: ${c.monitoring.wikipediaTitle}`)
      console.log(`    Citation: ${c.citationTitle || c.citationUrl}`)
      console.log(`    Memory tags: ${JSON.stringify(c.savedMemory?.tags)}`)
    })
  }

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/check-citation-status.ts [patchHandle]')
  process.exit(1)
}

checkCitationStatus(patchHandle).catch(console.error)
