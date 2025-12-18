#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllExternalUrls() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Comprehensive Citation Analysis\n')
  
  // Get ALL citations, not just pending
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId }
    },
    select: {
      citationUrl: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      aiPriorityScore: true
    },
    take: 100
  })
  
  console.log(`Sample of 100 citations (all statuses):\n`)
  
  let externalCount = 0
  let wikipediaCount = 0
  let relativeCount = 0
  
  const externalUrls: string[] = []
  const wikipediaUrls: string[] = []
  
  allCitations.forEach((c, i) => {
    const url = c.citationUrl
    let type = 'unknown'
    
    if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
      type = 'relative'
      relativeCount++
    } else if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      type = 'wikipedia'
      wikipediaCount++
      wikipediaUrls.push(url)
    } else if (url.startsWith('http')) {
      type = 'external'
      externalCount++
      externalUrls.push(url)
    }
    
    if (i < 30) { // Show first 30
      console.log(`${i + 1}. [${type}] ${url.substring(0, 80)}${url.length > 80 ? '...' : ''} (${c.verificationStatus}/${c.scanStatus}/${c.relevanceDecision || 'null'})`)
    }
  })
  
  console.log(`\n📊 Sample Breakdown (first 100):`)
  console.log(`   External URLs: ${externalCount}`)
  console.log(`   Wikipedia URLs: ${wikipediaCount}`)
  console.log(`   Relative URLs: ${relativeCount}`)
  
  if (externalUrls.length > 0) {
    console.log(`\n✅ Found External URLs in sample:`)
    externalUrls.slice(0, 10).forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`)
    })
  }
  
  // Now count ALL external URLs in database
  const totalExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
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
  
  console.log(`\n📈 Total External URLs in Database: ${totalExternal}`)
  
  // Count by verification status
  const externalByStatus = await prisma.wikipediaCitation.groupBy({
    by: ['verificationStatus'],
    where: {
      monitoring: { patchId },
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    _count: true
  })
  
  console.log(`\n📊 External URLs by Verification Status:`)
  externalByStatus.forEach(s => {
    console.log(`   ${s.verificationStatus}: ${s._count}`)
  })
  
  // Count by scan status
  const externalByScan = await prisma.wikipediaCitation.groupBy({
    by: ['scanStatus'],
    where: {
      monitoring: { patchId },
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    _count: true
  })
  
  console.log(`\n📊 External URLs by Scan Status:`)
  externalByScan.forEach(s => {
    console.log(`   ${s.scanStatus}: ${s._count}`)
  })
  
  await prisma.$disconnect()
}

checkAllExternalUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

