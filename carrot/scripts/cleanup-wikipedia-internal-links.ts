/**
 * Clean up existing Wikipedia internal links from database
 * Mark them as denied_verify so they don't get processed
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const dryRun = !args.includes('--live')

  console.log(`\n=== Cleanup Wikipedia Internal Links ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Find all Wikipedia internal links
  const wikipediaLinks = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      id: true,
      citationUrl: true,
      scanStatus: true,
      relevanceDecision: true
    }
  })

  console.log(`Found ${wikipediaLinks.length} Wikipedia internal links\n`)

  if (wikipediaLinks.length === 0) {
    console.log(`✅ No Wikipedia internal links found`)
    process.exit(0)
  }

  // Group by status
  const byStatus = wikipediaLinks.reduce((acc, c) => {
    const key = `${c.scanStatus}_${c.relevanceDecision || 'null'}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`Status breakdown:`)
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })

  // Show sample URLs
  console.log(`\nSample URLs (first 10):`)
  wikipediaLinks.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.citationUrl}`)
  })

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN - No changes made`)
    console.log(`Run with --live to mark these as denied_verify`)
    process.exit(0)
  }

  // Mark as denied_verify
  console.log(`\nMarking as denied_verify...`)
  const updateResult = await prisma.wikipediaCitation.updateMany({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    data: {
      scanStatus: 'scanned_denied',
      relevanceDecision: 'denied_verify',
      verificationStatus: 'failed',
      errorMessage: 'Wikipedia internal link - filtered out'
    }
  })

  console.log(`✅ Marked ${updateResult.count} citations as denied_verify`)
  console.log(`\nThese citations will no longer be selected for processing`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

