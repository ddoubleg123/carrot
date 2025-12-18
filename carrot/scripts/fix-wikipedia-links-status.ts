#!/usr/bin/env tsx
/**
 * Fix Wikipedia Links Status
 * 
 * Marks Wikipedia internal links (relative URLs and Wikipedia domains) as 'pending_wiki'
 * instead of 'pending' so they don't block external URL processing.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWikipediaLinksStatus(patchHandle: string, dryRun: boolean = false) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔧 Fixing Wikipedia Links Status for: ${patch.title}\n`)

  // Find all citations that are Wikipedia links but marked as 'pending'
  const wikipediaLinks = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'pending',
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { startsWith: '../' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      id: true,
      citationUrl: true
    }
  })

  console.log(`Found ${wikipediaLinks.length} Wikipedia links marked as 'pending'\n`)

  if (wikipediaLinks.length === 0) {
    console.log('✅ No Wikipedia links to fix')
    await prisma.$disconnect()
    return
  }

  if (dryRun) {
    console.log('🔍 DRY RUN - Would update the following citations:\n')
    wikipediaLinks.slice(0, 20).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.citationUrl}`)
    })
    if (wikipediaLinks.length > 20) {
      console.log(`  ... and ${wikipediaLinks.length - 20} more`)
    }
    console.log(`\nTotal: ${wikipediaLinks.length} citations would be updated`)
    await prisma.$disconnect()
    return
  }

  // Update them to 'pending_wiki'
  console.log('Updating citations to pending_wiki...')
  
  const result = await prisma.wikipediaCitation.updateMany({
    where: {
      id: { in: wikipediaLinks.map(c => c.id) }
    },
    data: {
      verificationStatus: 'pending_wiki'
    }
  })

  console.log(`✅ Updated ${result.count} citations to 'pending_wiki'`)

  // Verify the fix
  const remainingPending = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null
    }
  })

  const externalPending = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    }
  })

  console.log(`\n📊 After Fix:`)
  console.log(`   Remaining 'pending' (should be external URLs): ${remainingPending}`)
  console.log(`   External URLs pending: ${externalPending}`)
  console.log(`   Wikipedia links now 'pending_wiki': ${wikipediaLinks.length}`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const dryRun = args.includes('--dry-run')

fixWikipediaLinksStatus(patchHandle, dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

