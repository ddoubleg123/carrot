#!/usr/bin/env tsx
/**
 * Cleanup Wikipedia Links from Citations Table
 * 
 * Removes Wikipedia internal links from the citations table
 * These should not be stored as citations - they're internal references
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupWikipediaLinks(patchHandle: string, dryRun: boolean = false) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🧹 Cleaning up Wikipedia Links for: ${patch.title}\n`)
  console.log(`   Dry Run: ${dryRun}\n`)

  // Find all Wikipedia links
  const wikipediaLinks = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { startsWith: '../' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } },
        { citationUrl: { contains: 'wiktionary.org' } },
        { citationUrl: { contains: 'wikinews.org' } },
        { citationUrl: { contains: 'wikiquote.org' } },
        { citationUrl: { contains: 'wikisource.org' } },
        { citationUrl: { contains: 'wikibooks.org' } },
        { citationUrl: { contains: 'wikiversity.org' } },
        { citationUrl: { contains: 'wikivoyage.org' } },
        { citationUrl: { contains: 'wikimediafoundation.org' } },
        { citationUrl: { contains: 'mediawiki.org' } },
        { citationUrl: { contains: 'toolforge.org' } }
      ]
    },
    select: {
      id: true,
      citationUrl: true,
      verificationStatus: true
    }
  })

  console.log(`Found ${wikipediaLinks.length} Wikipedia links to remove\n`)

  if (wikipediaLinks.length === 0) {
    console.log('✅ No Wikipedia links to clean up')
    await prisma.$disconnect()
    return
  }

  if (dryRun) {
    console.log('🔍 DRY RUN - Would delete the following:\n')
    wikipediaLinks.slice(0, 20).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.citationUrl.substring(0, 80)}...`)
    })
    if (wikipediaLinks.length > 20) {
      console.log(`  ... and ${wikipediaLinks.length - 20} more`)
    }
    console.log(`\nTotal: ${wikipediaLinks.length} citations would be deleted`)
    await prisma.$disconnect()
    return
  }

  // Delete them
  console.log('Deleting Wikipedia links...\n')
  
  const result = await prisma.wikipediaCitation.deleteMany({
    where: {
      id: { in: wikipediaLinks.map(c => c.id) }
    }
  })

  console.log(`✅ Deleted ${result.count} Wikipedia links`)

  // Verify cleanup
  const remainingWikipedia = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } }
      ]
    }
  })

  const externalCount = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } },
        { citationUrl: { contains: 'wiktionary.org' } },
        { citationUrl: { contains: 'wikinews.org' } },
        { citationUrl: { contains: 'wikiquote.org' } },
        { citationUrl: { contains: 'wikisource.org' } },
        { citationUrl: { contains: 'wikibooks.org' } },
        { citationUrl: { contains: 'wikiversity.org' } },
        { citationUrl: { contains: 'wikivoyage.org' } },
        { citationUrl: { contains: 'wikimediafoundation.org' } },
        { citationUrl: { contains: 'mediawiki.org' } },
        { citationUrl: { contains: 'toolforge.org' } }
      ]
    }
  })

  console.log(`\n📊 After Cleanup:`)
  console.log(`   Remaining Wikipedia Links: ${remainingWikipedia}`)
  console.log(`   External Citations: ${externalCount}`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const dryRun = args.includes('--dry-run')

cleanupWikipediaLinks(patchHandle, dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
