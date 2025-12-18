#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkActualUrls() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Checking Actual Citation URLs in Database\n')
  
  // Get a random sample of citations
  const samples = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null
    },
    select: {
      citationUrl: true,
      verificationStatus: true,
      aiPriorityScore: true
    },
    take: 50,
    orderBy: {
      createdAt: 'asc'
    }
  })
  
  console.log(`Sample of 50 citations:\n`)
  
  let externalCount = 0
  let wikipediaCount = 0
  let relativeCount = 0
  
  samples.forEach((c, i) => {
    const url = c.citationUrl
    let type = 'unknown'
    
    if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
      type = 'relative'
      relativeCount++
    } else if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      type = 'wikipedia'
      wikipediaCount++
    } else if (url.startsWith('http')) {
      type = 'external'
      externalCount++
    }
    
    console.log(`${i + 1}. [${type}] ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`)
  })
  
  console.log(`\n📊 Breakdown:`)
  console.log(`   External URLs: ${externalCount}`)
  console.log(`   Wikipedia URLs: ${wikipediaCount}`)
  console.log(`   Relative URLs: ${relativeCount}`)
  
  // Now check if there are ANY external URLs at all
  const totalExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
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
  
  console.log(`\n📈 Total external URLs (pending): ${totalExternal}`)
  
  // Check what verification statuses exist
  const statusBreakdown = await prisma.wikipediaCitation.groupBy({
    by: ['verificationStatus'],
    where: {
      monitoring: { patchId }
    },
    _count: true
  })
  
  console.log(`\n📊 Verification Status Breakdown:`)
  statusBreakdown.forEach(s => {
    console.log(`   ${s.verificationStatus}: ${s._count}`)
  })
  
  await prisma.$disconnect()
}

checkActualUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

