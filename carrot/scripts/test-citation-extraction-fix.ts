#!/usr/bin/env tsx
/**
 * Test Citation Extraction Fix
 * 
 * Re-extracts citations from Israel Wikipedia page and verifies all external citations are stored
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { extractWikipediaCitationsWithContext } from '../src/lib/discovery/wikiUtils'
import { extractAndStoreCitations } from '../src/lib/discovery/wikipediaCitation'

const prisma = new PrismaClient()

async function testCitationExtraction() {
  console.log('🧪 Testing Citation Extraction Fix\n')
  console.log('═'.repeat(70))

  // Get Israel patch and monitoring
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('❌ Patch "israel" not found')
    process.exit(1)
  }

  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId: patch.id,
      wikipediaTitle: 'Israel'
    },
    select: {
      id: true,
      wikipediaTitle: true,
      wikipediaUrl: true
    }
  })

  if (!monitoring) {
    console.error('❌ Wikipedia monitoring for "Israel" not found')
    process.exit(1)
  }

  console.log(`📄 Testing: ${monitoring.wikipediaTitle}\n`)

  // Step 1: Fetch the page HTML
  console.log('Step 1: Fetching Wikipedia page HTML...')
  const response = await fetch(monitoring.wikipediaUrl)
  if (!response.ok) {
    console.error(`❌ Failed to fetch: ${response.status}`)
    process.exit(1)
  }
  const html = await response.text()
  console.log(`✅ Fetched HTML (${(html.length / 1024).toFixed(1)} KB)\n`)

  // Step 2: Extract citations
  console.log('Step 2: Extracting citations...')
  const extractedCitations = extractWikipediaCitationsWithContext(html, monitoring.wikipediaUrl, 10000)
  
  const external = extractedCitations.filter(c => {
    const url = c.url
    return url.startsWith('http://') || url.startsWith('https://')
  })

  const wikipedia = extractedCitations.filter(c => {
    const url = c.url
    return url.startsWith('./') || 
           url.startsWith('/wiki/') || 
           url.includes('wikipedia.org')
  })

  console.log(`   Extracted: ${extractedCitations.length} total`)
  console.log(`   External URLs: ${external.length}`)
  console.log(`   Wikipedia Links: ${wikipedia.length} (should be 0 after extraction)\n`)

  // Step 3: Check current database state
  console.log('Step 3: Checking current database state...')
  const beforeCount = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id
    }
  })

  const beforeExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id,
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

  const beforeWikipedia = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id,
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } }
      ]
    }
  })

  console.log(`   Before:`)
  console.log(`      Total: ${beforeCount}`)
  console.log(`      External: ${beforeExternal}`)
  console.log(`      Wikipedia Links: ${beforeWikipedia}\n`)

  // Step 4: Re-extract and store citations
  console.log('Step 4: Re-extracting and storing citations...')
  console.log('   (This will skip duplicates by URL)\n')

  // Mock prioritize function (just return citations as-is)
  const prioritizeCitations = async (citations: any[]) => {
    return citations.map(c => ({ ...c, score: 50 }))
  }

  const result = await extractAndStoreCitations(
    monitoring.id,
    monitoring.wikipediaUrl,
    html,
    prioritizeCitations
  )

  console.log(`\n   Extraction Result:`)
  console.log(`      Citations Found: ${result.citationsFound}`)
  console.log(`      Citations Stored: ${result.citationsStored}\n`)

  // Step 5: Check database state after
  console.log('Step 5: Checking database state after extraction...')
  const afterCount = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id
    }
  })

  const afterExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id,
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

  const afterWikipedia = await prisma.wikipediaCitation.count({
    where: {
      monitoringId: monitoring.id,
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } }
      ]
    }
  })

  console.log(`   After:`)
  console.log(`      Total: ${afterCount}`)
  console.log(`      External: ${afterExternal}`)
  console.log(`      Wikipedia Links: ${afterWikipedia}\n`)

  // Step 6: Verification
  console.log('Step 6: Verification\n')
  console.log('═'.repeat(70))

  const externalMatch = afterExternal === external.length
  const wikipediaMatch = afterWikipedia === 0

  console.log(`   Expected External Citations: ${external.length}`)
  console.log(`   Actual External Citations: ${afterExternal}`)
  console.log(`   Match: ${externalMatch ? '✅' : '❌'}`)

  console.log(`\n   Expected Wikipedia Links: 0`)
  console.log(`   Actual Wikipedia Links: ${afterWikipedia}`)
  console.log(`   Match: ${wikipediaMatch ? '✅' : '❌'}`)

  if (externalMatch && wikipediaMatch) {
    console.log(`\n✅ SUCCESS: All citations stored correctly!`)
    console.log(`   - All ${external.length} external citations stored`)
    console.log(`   - No Wikipedia links stored as citations`)
  } else {
    console.log(`\n⚠️  ISSUES FOUND:`)
    if (!externalMatch) {
      const missing = external.length - afterExternal
      console.log(`   - Missing ${missing} external citations`)
    }
    if (!wikipediaMatch) {
      console.log(`   - ${afterWikipedia} Wikipedia links still in database`)
    }
  }

  // Show sample stored citations
  console.log(`\n📝 Sample Stored Citations (first 10):\n`)
  const sampleCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoringId: monitoring.id,
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      sourceNumber: true,
      citationUrl: true,
      citationTitle: true
    },
    orderBy: {
      sourceNumber: 'asc'
    },
    take: 10
  })

  sampleCitations.forEach((c, i) => {
    console.log(`   ${i + 1}. [#${c.sourceNumber}] ${c.citationUrl.substring(0, 70)}...`)
    if (c.citationTitle) {
      console.log(`      Title: ${c.citationTitle.substring(0, 60)}...`)
    }
  })

  await prisma.$disconnect()
}

testCitationExtraction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

