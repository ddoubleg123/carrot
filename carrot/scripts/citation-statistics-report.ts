#!/usr/bin/env tsx
/**
 * Citation Statistics Report
 * 
 * Comprehensive analysis of citation processing, content extraction, and fetch failures
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateStatisticsReport(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`📊 Citation Statistics Report for: ${patch.title}\n`)
  console.log(`═`.repeat(70))

  // ===== OVERALL CITATION STATISTICS =====
  console.log(`\n📈 OVERALL CITATION STATISTICS\n`)

  const totalCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id }
    }
  })

  const externalCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
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

  const wikipediaLinks = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    }
  })

  console.log(`   Total Citations: ${totalCitations.toLocaleString()}`)
  console.log(`   External URLs: ${externalCitations.toLocaleString()}`)
  console.log(`   Wikipedia Links: ${wikipediaLinks.toLocaleString()}`)

  // ===== PROCESSING STATUS =====
  console.log(`\n🔄 PROCESSING STATUS\n`)

  const notScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: 'not_scanned'
    }
  })

  const scanning = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: 'scanning'
    }
  })

  const scanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] }
    }
  })

  console.log(`   Not Scanned: ${notScanned.toLocaleString()}`)
  console.log(`   Currently Scanning: ${scanning.toLocaleString()}`)
  console.log(`   Scanned: ${scanned.toLocaleString()} (${((scanned / externalCitations) * 100).toFixed(1)}%)`)

  // ===== SAVE/DENY BREAKDOWN =====
  console.log(`\n💾 SAVE/DENY BREAKDOWN\n`)

  const saved = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      relevanceDecision: 'saved'
    }
  })

  const denied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      relevanceDecision: 'denied'
    }
  })

  const noDecision = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      relevanceDecision: null
    }
  })

  const processed = saved + denied
  const saveRate = processed > 0 ? (saved / processed * 100) : 0

  console.log(`   Saved: ${saved.toLocaleString()} (${saveRate.toFixed(1)}% of processed)`)
  console.log(`   Denied: ${denied.toLocaleString()} (${(100 - saveRate).toFixed(1)}% of processed)`)
  console.log(`   No Decision: ${noDecision.toLocaleString()}`)
  console.log(`   Total Processed: ${processed.toLocaleString()}`)

  // ===== CONTENT EXTRACTION STATISTICS =====
  console.log(`\n📄 CONTENT EXTRACTION STATISTICS\n`)

  const citationsWithContent = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] },
      contentText: { not: null }
    },
    select: {
      contentText: true
    }
  })

  const citationsNoContent = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] },
      OR: [
        { contentText: null },
        { contentText: '' }
      ]
    }
  })

  const contentLengths = citationsWithContent.map(c => c.contentText?.length || 0).filter(l => l > 0)
  const totalContentChars = contentLengths.reduce((sum, len) => sum + len, 0)
  const avgContentLength = contentLengths.length > 0 ? totalContentChars / contentLengths.length : 0
  const minContentLength = contentLengths.length > 0 ? Math.min(...contentLengths) : 0
  const maxContentLength = contentLengths.length > 0 ? Math.max(...contentLengths) : 0

  const shortContent = citationsWithContent.filter(c => (c.contentText?.length || 0) < 500).length
  const mediumContent = citationsWithContent.filter(c => {
    const len = c.contentText?.length || 0
    return len >= 500 && len < 2000
  }).length
  const longContent = citationsWithContent.filter(c => (c.contentText?.length || 0) >= 2000).length

  const extractionSuccessRate = scanned > 0 ? (citationsWithContent.length / scanned * 100) : 0

  console.log(`   Extraction Success Rate: ${extractionSuccessRate.toFixed(1)}%`)
  console.log(`   Citations with Content: ${citationsWithContent.length.toLocaleString()}`)
  console.log(`   Citations without Content: ${citationsNoContent.toLocaleString()}`)
  console.log(`\n   Content Length Statistics:`)
  console.log(`      Average: ${Math.round(avgContentLength).toLocaleString()} chars`)
  console.log(`      Min: ${minContentLength.toLocaleString()} chars`)
  console.log(`      Max: ${maxContentLength.toLocaleString()} chars`)
  console.log(`      Total: ${totalContentChars.toLocaleString()} chars`)
  console.log(`\n   Content Length Distribution:`)
  console.log(`      Short (<500 chars): ${shortContent.toLocaleString()}`)
  console.log(`      Medium (500-1999 chars): ${mediumContent.toLocaleString()}`)
  console.log(`      Long (>=2000 chars): ${longContent.toLocaleString()}`)

  // ===== SAVED CONTENT STATISTICS =====
  console.log(`\n✅ SAVED CONTENT STATISTICS\n`)

  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      savedContentId: { not: null }
    },
    select: {
      contentText: true,
      aiPriorityScore: true
    }
  })

  const discoveredContent = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    }
  })

  const savedContentLengths = savedCitations.map(c => c.contentText?.length || 0).filter(l => l > 0)
  const totalSavedChars = savedContentLengths.reduce((sum, len) => sum + len, 0)
  const avgSavedLength = savedContentLengths.length > 0 ? totalSavedChars / savedContentLengths.length : 0

  console.log(`   Saved Citations: ${savedCitations.length.toLocaleString()}`)
  console.log(`   DiscoveredContent Entries: ${discoveredContent.toLocaleString()}`)
  console.log(`   Average Saved Content Length: ${Math.round(avgSavedLength).toLocaleString()} chars`)
  console.log(`   Total Saved Content: ${totalSavedChars.toLocaleString()} chars`)

  // ===== AI SCORING STATISTICS =====
  console.log(`\n🤖 AI SCORING STATISTICS\n`)

  const citationsWithScore = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] },
      aiPriorityScore: { not: null }
    },
    select: {
      aiPriorityScore: true,
      relevanceDecision: true
    }
  })

  const citationsNoScore = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] },
      aiPriorityScore: null
    }
  })

  const scores = citationsWithScore.map(c => c.aiPriorityScore || 0)
  const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0
  const minScore = scores.length > 0 ? Math.min(...scores) : 0
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0

  const highScores = scores.filter(s => s >= 70).length
  const mediumScores = scores.filter(s => s >= 60 && s < 70).length
  const lowScores = scores.filter(s => s < 60).length

  const scoringSuccessRate = scanned > 0 ? (citationsWithScore.length / scanned * 100) : 0

  console.log(`   Scoring Success Rate: ${scoringSuccessRate.toFixed(1)}%`)
  console.log(`   Citations with Score: ${citationsWithScore.length.toLocaleString()}`)
  console.log(`   Citations without Score: ${citationsNoScore.toLocaleString()}`)
  console.log(`\n   Score Statistics:`)
  console.log(`      Average: ${avgScore.toFixed(1)}`)
  console.log(`      Min: ${minScore}`)
  console.log(`      Max: ${maxScore}`)
  console.log(`\n   Score Distribution:`)
  console.log(`      High (>=70): ${highScores.toLocaleString()}`)
  console.log(`      Medium (60-69): ${mediumScores.toLocaleString()}`)
  console.log(`      Low (<60): ${lowScores.toLocaleString()}`)

  // ===== VERIFICATION/FETCH FAILURE ANALYSIS =====
  console.log(`\n❌ VERIFICATION/FETCH FAILURE ANALYSIS\n`)

  const failedVerifications = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      verificationStatus: 'failed'
    },
    select: {
      errorMessage: true,
      citationUrl: true
    }
  })

  const verificationErrors: Record<string, number> = {}
  failedVerifications.forEach(c => {
    const error = c.errorMessage || 'Unknown error'
    // Categorize errors
    let category = 'Other'
    if (error.includes('HTTP 403')) category = 'HTTP 403 (Forbidden)'
    else if (error.includes('HTTP 404')) category = 'HTTP 404 (Not Found)'
    else if (error.includes('HTTP 500')) category = 'HTTP 500 (Server Error)'
    else if (error.includes('HTTP 0')) category = 'HTTP 0 (Connection Failed)'
    else if (error.includes('Timeout')) category = 'Timeout'
    else if (error.includes('ECONNREFUSED')) category = 'Connection Refused'
    else if (error.includes('Low-quality URL')) category = 'Low-quality URL (Filtered)'
    else if (error.includes('fetch failed')) category = 'Fetch Failed'
    else if (error.includes('aborted')) category = 'Request Aborted'
    
    verificationErrors[category] = (verificationErrors[category] || 0) + 1
  })

  const totalFailed = failedVerifications.length
  const verificationSuccessRate = externalCitations > 0 
    ? ((externalCitations - totalFailed) / externalCitations * 100) 
    : 0

  console.log(`   Verification Success Rate: ${verificationSuccessRate.toFixed(1)}%`)
  console.log(`   Total Failed Verifications: ${totalFailed.toLocaleString()}`)
  console.log(`\n   Failure Reasons:`)
  Object.entries(verificationErrors)
    .sort((a, b) => b[1] - a[1])
    .forEach(([error, count]) => {
      const percentage = totalFailed > 0 ? (count / totalFailed * 100) : 0
      console.log(`      ${error}: ${count.toLocaleString()} (${percentage.toFixed(1)}%)`)
    })

  // Sample failed URLs by category
  if (totalFailed > 0) {
    console.log(`\n   Sample Failed URLs:`)
    const sampleSize = Math.min(5, totalFailed)
    failedVerifications.slice(0, sampleSize).forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.citationUrl.substring(0, 70)}...`)
      console.log(`         Error: ${c.errorMessage?.substring(0, 60) || 'Unknown'}...`)
    })
  }

  // ===== CONTENT EXTRACTION FAILURES =====
  console.log(`\n📄 CONTENT EXTRACTION FAILURES\n`)

  const extractionFailures = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { startsWith: 'http' },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ],
      scanStatus: { in: ['scanned', 'scanned_denied'] },
      OR: [
        { contentText: null },
        { contentText: '' }
      ],
      verificationStatus: 'verified' // Only count verified URLs that failed extraction
    },
    select: {
      citationUrl: true,
      errorMessage: true
    },
    take: 20
  })

  console.log(`   Verified URLs with No Content: ${extractionFailures.length.toLocaleString()}`)
  if (extractionFailures.length > 0) {
    console.log(`\n   Sample URLs with Extraction Failures:`)
    extractionFailures.slice(0, 10).forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.citationUrl.substring(0, 70)}...`)
      if (c.errorMessage) {
        console.log(`         Error: ${c.errorMessage.substring(0, 60)}...`)
      }
    })
  }

  // ===== SUMMARY =====
  console.log(`\n\n📋 SUMMARY\n`)
  console.log(`═`.repeat(70))
  console.log(`\n   Total External Citations: ${externalCitations.toLocaleString()}`)
  console.log(`   Processed: ${processed.toLocaleString()} (${((processed / externalCitations) * 100).toFixed(1)}%)`)
  console.log(`   Save Rate: ${saveRate.toFixed(1)}%`)
  console.log(`   Content Extraction Success: ${extractionSuccessRate.toFixed(1)}%`)
  console.log(`   AI Scoring Success: ${scoringSuccessRate.toFixed(1)}%`)
  console.log(`   Verification Success: ${verificationSuccessRate.toFixed(1)}%`)
  console.log(`   Total Content Extracted: ${totalContentChars.toLocaleString()} chars`)
  console.log(`   Total Content Saved: ${totalSavedChars.toLocaleString()} chars`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

generateStatisticsReport(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

