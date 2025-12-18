#!/usr/bin/env tsx
/**
 * Debug why citations aren't being found by getNextCitationToProcess
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugCitationQuery() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g' // Israel patch
  
  console.log('🔍 Debugging Citation Query\n')
  console.log(`Patch ID: ${patchId}\n`)

  // Test the exact query from getNextCitationToProcess
  const citation = await prisma.wikipediaCitation.findFirst({
    where: {
      monitoring: { patchId },
      verificationStatus: { in: ['pending', 'verified'] },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null,
      NOT: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    orderBy: [
      { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'asc' }
    ],
    include: {
      monitoring: {
        select: {
          id: true,
          wikipediaTitle: true,
          status: true
        }
      }
    }
  })

  if (citation) {
    console.log('✅ Found citation:')
    console.log(JSON.stringify(citation, null, 2))
  } else {
    console.log('❌ No citation found\n')
    
    // Check each condition separately
    console.log('📊 Checking each condition:\n')
    
    // Total citations
    const total = await prisma.wikipediaCitation.count({
      where: { monitoring: { patchId } }
    })
    console.log(`Total citations: ${total}`)
    
    // With correct verification status
    const withVerificationStatus = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] }
      }
    })
    console.log(`With verificationStatus IN ['pending','verified']: ${withVerificationStatus}`)
    
    // With correct scan status
    const withScanStatus = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        scanStatus: { in: ['not_scanned', 'scanning'] }
      }
    })
    console.log(`With scanStatus IN ['not_scanned','scanning']: ${withScanStatus}`)
    
    // With null relevanceDecision
    const withNullDecision = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        relevanceDecision: null
      }
    })
    console.log(`With relevanceDecision IS NULL: ${withNullDecision}`)
    
    // Combined: verification + scan + decision
    const combined = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] },
        scanStatus: { in: ['not_scanned', 'scanning'] },
        relevanceDecision: null
      }
    })
    console.log(`Combined (verification + scan + decision): ${combined}`)
    
    // Check NOT exclusions
    const withWikipediaUrls = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] },
        scanStatus: { in: ['not_scanned', 'scanning'] },
        relevanceDecision: null,
        OR: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      }
    })
    console.log(`Excluded by NOT clause (Wikipedia URLs): ${withWikipediaUrls}`)
    
    // Final count after NOT exclusion
    const final = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] },
        scanStatus: { in: ['not_scanned', 'scanning'] },
        relevanceDecision: null,
        NOT: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      }
    })
    console.log(`\nFinal count (after all filters): ${final}`)
    
    // Sample some citations to see what they look like
    console.log('\n📋 Sample citations (first 5):')
    const samples = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId },
        verificationStatus: 'pending',
        scanStatus: 'not_scanned',
        relevanceDecision: null
      },
      select: {
        id: true,
        citationUrl: true,
        verificationStatus: true,
        scanStatus: true,
        relevanceDecision: true,
        aiPriorityScore: true
      },
      take: 5
    })
    
    samples.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.citationUrl}`)
      console.log(`   verificationStatus: ${c.verificationStatus}`)
      console.log(`   scanStatus: ${c.scanStatus}`)
      console.log(`   relevanceDecision: ${c.relevanceDecision}`)
      console.log(`   aiPriorityScore: ${c.aiPriorityScore}`)
    })
  }
  
  await prisma.$disconnect()
}

debugCitationQuery()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

