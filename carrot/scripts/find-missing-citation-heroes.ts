#!/usr/bin/env tsx
/**
 * Find Missing Citation Heroes
 * Identifies saved citations that don't have corresponding DiscoveredContent
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findMissingHeroes(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n🔍 Finding missing citation heroes for: ${patch.title}\n`)

  // Get all saved citations
  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    select: {
      id: true,
      citationTitle: true,
      citationUrl: true,
      contentText: true,
      aiPriorityScore: true,
      lastScannedAt: true
    }
  })

  console.log(`📊 Total saved citations: ${savedCitations.length}\n`)

  // Get all DiscoveredContent from citations
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      canonicalUrl: true
    }
  })

  console.log(`📊 DiscoveredContent from citations: ${discoveredContent.length}\n`)

  // Find missing ones
  const discoveredUrls = new Set(
    discoveredContent.flatMap(dc => [dc.sourceUrl, dc.canonicalUrl].filter(Boolean))
  )

  const missing = savedCitations.filter(citation => {
    const url = citation.citationUrl
    return !discoveredUrls.has(url)
  })

  console.log(`\n⚠️  Missing heroes: ${missing.length}\n`)

  if (missing.length > 0) {
    console.log('Missing citations:\n')
    missing.forEach((citation, i) => {
      console.log(`${i + 1}. ${citation.citationTitle || 'Untitled'}`)
      console.log(`   URL: ${citation.citationUrl.substring(0, 70)}...`)
      console.log(`   Score: ${citation.aiPriorityScore || 'N/A'}`)
      console.log(`   Last scanned: ${citation.lastScannedAt?.toISOString() || 'Never'}`)
      console.log(`   Has content: ${citation.contentText ? 'Yes' : 'No'}`)
      console.log()
    })

    console.log('\n💡 Possible reasons:')
    console.log('   1. Save process failed silently')
    console.log('   2. Content extraction failed')
    console.log('   3. Duplicate detection prevented save')
    console.log('   4. URL mismatch (canonicalization issue)')
  } else {
    console.log('✅ All saved citations have corresponding DiscoveredContent!\n')
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

findMissingHeroes(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

