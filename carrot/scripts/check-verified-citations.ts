#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkVerifiedCitations() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Checking Verified Citations\n')
  
  // Get verified citations that haven't been scanned
  const verified = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      verificationStatus: 'verified',
      scanStatus: 'not_scanned',
      relevanceDecision: null
    },
    select: {
      citationUrl: true,
      aiPriorityScore: true,
      verificationStatus: true
    },
    take: 20
  })
  
  console.log(`Verified but not scanned: ${verified.length}\n`)
  
  let externalCount = 0
  let wikipediaCount = 0
  
  verified.forEach((c, i) => {
    const url = c.citationUrl
    let type = 'unknown'
    
    if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      type = 'wikipedia'
      wikipediaCount++
    } else if (url.startsWith('http')) {
      type = 'external'
      externalCount++
    }
    
    console.log(`${i + 1}. [${type}] ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`)
  })
  
  console.log(`\n📊 Breakdown:`)
  console.log(`   External URLs: ${externalCount}`)
  console.log(`   Wikipedia URLs: ${wikipediaCount}`)
  
  // Count total verified external URLs
  const totalVerifiedExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      verificationStatus: 'verified',
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
  
  console.log(`\n📈 Total verified external URLs (not scanned): ${totalVerifiedExternal}`)
  
  // Also check all verified (including scanned)
  const allVerifiedExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      verificationStatus: 'verified',
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
  
  console.log(`📈 Total verified external URLs (all): ${allVerifiedExternal}`)
  
  await prisma.$disconnect()
}

checkVerifiedCitations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

