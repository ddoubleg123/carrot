/**
 * Cleanup script to mark old Wikipedia internal links as denied
 * These were stored before we implemented proper filtering
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const dryRun = args.includes('--dry-run')

  console.log(`\n=== Cleaning Up Wikipedia Internal Links ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Find all Wikipedia internal links
  const wikipediaLinks = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      },
      OR: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    include: {
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    },
    take: 10000 // Limit to prevent timeout
  })

  console.log(`Found ${wikipediaLinks.length} Wikipedia internal links\n`)

  if (wikipediaLinks.length === 0) {
    console.log('No Wikipedia links to clean up')
    process.exit(0)
  }

  // Group by status
  const byStatus = wikipediaLinks.reduce((acc, link) => {
    const status = link.scanStatus
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`Current status breakdown:`)
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })

  // Show sample
  console.log(`\nSample Wikipedia links (first 10):`)
  wikipediaLinks.slice(0, 10).forEach((link, i) => {
    console.log(`  ${i + 1}. [${link.monitoring.wikipediaTitle}] ${link.citationUrl}`)
    console.log(`     Status: ${link.scanStatus}, Decision: ${link.relevanceDecision || 'null'}`)
  })

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN - No changes made`)
    console.log(`Run without --dry-run to update database`)
    process.exit(0)
  }

  // Update all Wikipedia links to denied
  console.log(`\n=== Updating Database ===\n`)
  
  const result = await prisma.wikipediaCitation.updateMany({
    where: {
      id: { in: wikipediaLinks.map(l => l.id) }
    },
    data: {
      scanStatus: 'scanned_denied',
      relevanceDecision: 'denied_verify',
      verificationStatus: 'failed',
      errorMessage: 'Wikipedia internal link - filtered during extraction'
    }
  })

  console.log(`✅ Updated ${result.count} Wikipedia links`)
  console.log(`   - Set scanStatus: scanned_denied`)
  console.log(`   - Set relevanceDecision: denied_verify`)
  console.log(`   - Set verificationStatus: failed`)

  // Verify
  const remaining = await prisma.wikipediaCitation.count({
    where: {
      monitoring: {
        patchId: patch.id
      },
      OR: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } }
      ],
      scanStatus: { not: 'scanned_denied' }
    }
  })

  console.log(`\nRemaining Wikipedia links with non-denied status: ${remaining}`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

