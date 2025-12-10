/**
 * Analyze why citations aren't being processed
 * Specifically check the high-scoring denied citations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzeCitationProcessing() {
  const patchHandle = 'israel'
  
  console.log(`🔍 Analyzing Citation Processing for: ${patchHandle}\n`)

  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`❌ Patch not found`)
      return
    }

    console.log(`✅ Patch: ${patch.title}\n`)

    // Total citations
    const totalCitations = await prisma.wikipediaCitation.count({
      where: { monitoring: { patchId: patch.id } }
    })
    console.log(`📊 Total Citations: ${totalCitations}\n`)

    // Check Step 1: New citations (pending/verified, not_scanned, no decision)
    const step1Citations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
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
    console.log(`Step 1 (New Citations): ${step1Citations}`)

    // Check Step 3: High-scoring denied citations (30+ days old)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const step3OldCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        verificationStatus: { in: ['pending', 'verified'] },
        relevanceDecision: 'denied',
        aiPriorityScore: { gte: 60 },
        lastScannedAt: { lt: thirtyDaysAgo },
        scanStatus: { in: ['not_scanned', 'scanning', 'scanned'] },
        NOT: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      }
    })
    console.log(`Step 3 (High-Score Denied, 30+ days old): ${step3OldCitations}`)

    // Check Step 3: High-scoring denied citations (recent, within 30 days)
    const step3RecentCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        verificationStatus: { in: ['pending', 'verified'] },
        relevanceDecision: 'denied',
        aiPriorityScore: { gte: 60 },
        OR: [
          { lastScannedAt: { gte: thirtyDaysAgo } },
          { lastScannedAt: null }
        ],
        scanStatus: { in: ['not_scanned', 'scanning', 'scanned'] },
        NOT: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      }
    })
    console.log(`Step 3 (High-Score Denied, <30 days old): ${step3RecentCitations}`)

    // Check the specific citation
    const specificCitation = await prisma.wikipediaCitation.findUnique({
      where: { id: 'cmip9so2u0561ox1t56gue2ye' },
      select: {
        id: true,
        citationUrl: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        scanStatus: true,
        verificationStatus: true,
        lastScannedAt: true,
        createdAt: true
      }
    })

    if (specificCitation) {
      console.log(`\n📝 Specific Citation Analysis:`)
      console.log(`   ID: ${specificCitation.id}`)
      console.log(`   AI Score: ${specificCitation.aiPriorityScore}`)
      console.log(`   Relevance Decision: ${specificCitation.relevanceDecision}`)
      console.log(`   Scan Status: ${specificCitation.scanStatus}`)
      console.log(`   Verification Status: ${specificCitation.verificationStatus}`)
      console.log(`   Last Scanned: ${specificCitation.lastScannedAt?.toISOString()}`)
      
      const daysSinceScanned = specificCitation.lastScannedAt 
        ? Math.floor((Date.now() - specificCitation.lastScannedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null
      console.log(`   Days Since Scanned: ${daysSinceScanned}`)
      
      // Check if it matches Step 3 criteria
      const matchesStep3 = 
        ['pending', 'verified'].includes(specificCitation.verificationStatus || '') &&
        specificCitation.relevanceDecision === 'denied' &&
        (specificCitation.aiPriorityScore || 0) >= 60 &&
        ['not_scanned', 'scanning', 'scanned'].includes(specificCitation.scanStatus || '') &&
        !specificCitation.citationUrl.includes('wikipedia.org') &&
        !specificCitation.citationUrl.includes('wikimedia.org')
      
      console.log(`   Matches Step 3 Criteria: ${matchesStep3}`)
      
      if (matchesStep3 && daysSinceScanned !== null && daysSinceScanned < 30) {
        console.log(`   ⚠️  BLOCKED: Citation is <30 days old, so Step 3 won't select it`)
        console.log(`   💡 Solution: Remove 30-day requirement for high-scoring denied citations`)
      }
    }

    // Show top high-scoring denied citations
    const topDenied = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        relevanceDecision: 'denied',
        aiPriorityScore: { gte: 60 },
        verificationStatus: { in: ['pending', 'verified'] },
        scanStatus: { in: ['not_scanned', 'scanning', 'scanned'] },
        NOT: [
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } }
        ]
      },
      select: {
        id: true,
        citationUrl: true,
        citationTitle: true,
        aiPriorityScore: true,
        lastScannedAt: true,
        scanStatus: true
      },
      orderBy: [
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
        { lastScannedAt: { sort: 'asc', nulls: 'last' } }
      ],
      take: 10
    })

    console.log(`\n📊 Top 10 High-Scoring Denied Citations:`)
    topDenied.forEach((citation, index) => {
      const daysAgo = citation.lastScannedAt 
        ? Math.floor((Date.now() - citation.lastScannedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 'Never'
      console.log(`   ${index + 1}. Score: ${citation.aiPriorityScore}, Scanned: ${daysAgo} days ago`)
      console.log(`      ${citation.citationTitle || citation.citationUrl.substring(0, 60)}...`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeCitationProcessing()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

