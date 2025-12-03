/**
 * Check why citations aren't being saved for Israel patch
 * Run with: npx tsx scripts/check-israel-citations.ts
 */

import { prisma } from '../src/lib/prisma'

async function checkIsraelCitations() {
  console.log('Checking Israel patch citations...\n')

  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.log('❌ Patch "israel" not found')
      return
    }

    // Get processed citations
    const processedCitations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        scanStatus: 'scanned'
      },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        savedContentId: true,
        savedMemoryId: true,
        contentText: true,
        errorMessage: true
      },
      take: 20,
      orderBy: { lastScannedAt: 'desc' }
    })

    console.log(`📊 Processed Citations: ${processedCitations.length}\n`)

    if (processedCitations.length > 0) {
      console.log('Sample processed citations:')
      processedCitations.forEach((citation, i) => {
        console.log(`\n${i + 1}. "${citation.citationTitle}"`)
        console.log(`   URL: ${citation.citationUrl}`)
        console.log(`   AI Score: ${citation.aiPriorityScore ?? 'N/A'}`)
        console.log(`   Decision: ${citation.relevanceDecision ?? 'null'}`)
        console.log(`   Saved Content ID: ${citation.savedContentId ?? 'null'}`)
        console.log(`   Saved Memory ID: ${citation.savedMemoryId ?? 'null'}`)
        console.log(`   Content Length: ${citation.contentText?.length ?? 0} chars`)
        if (citation.errorMessage) {
          console.log(`   Error: ${citation.errorMessage}`)
        }
      })
    }

    // Count by decision
    const decisionCounts = await prisma.wikipediaCitation.groupBy({
      by: ['relevanceDecision'],
      _count: { id: true },
      where: {
        monitoring: { patchId: patch.id },
        scanStatus: 'scanned'
      }
    })

    console.log('\n📈 Decision Breakdown:')
    decisionCounts.forEach(({ relevanceDecision, _count }) => {
      console.log(`   ${relevanceDecision ?? 'null'}: ${_count.id}`)
    })

    // Check citations with scores
    const scoredCitations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        aiPriorityScore: { not: null }
      },
      select: {
        aiPriorityScore: true,
        relevanceDecision: true
      },
      take: 100
    })

    if (scoredCitations.length > 0) {
      const avgScore = scoredCitations.reduce((sum, c) => sum + (c.aiPriorityScore || 0), 0) / scoredCitations.length
      const scoresBelow60 = scoredCitations.filter(c => (c.aiPriorityScore || 0) < 60).length
      const scoresAbove60 = scoredCitations.filter(c => (c.aiPriorityScore || 0) >= 60).length
      
      console.log('\n📊 Score Analysis:')
      console.log(`   Total scored: ${scoredCitations.length}`)
      console.log(`   Average score: ${avgScore.toFixed(2)}`)
      console.log(`   Scores >= 60: ${scoresAbove60}`)
      console.log(`   Scores < 60: ${scoresBelow60}`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkIsraelCitations().catch(console.error)

