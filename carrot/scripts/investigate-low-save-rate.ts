#!/usr/bin/env tsx
/**
 * Investigate Low Save Rate
 * 
 * Analyzes why citations are being denied to understand the low save rate (6.4% vs expected 15-35%)
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigateLowSaveRate(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔍 Investigating Low Save Rate for: ${patch.title}\n`)

  // Get all scanned external URLs
  const scanned = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: { in: ['scanned', 'scanned_denied'] },
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
      citationUrl: true,
      relevanceDecision: true,
      aiPriorityScore: true,
      contentText: true,
      errorMessage: true,
      verificationStatus: true
    }
  })

  console.log(`Total scanned external URLs: ${scanned.length}\n`)

  const saved = scanned.filter(c => c.relevanceDecision === 'saved')
  const denied = scanned.filter(c => c.relevanceDecision === 'denied')
  const noDecision = scanned.filter(c => c.relevanceDecision === null)

  console.log(`📊 Decision Breakdown:`)
  console.log(`   Saved: ${saved.length} (${(saved.length / scanned.length * 100).toFixed(1)}%)`)
  console.log(`   Denied: ${denied.length} (${(denied.length / scanned.length * 100).toFixed(1)}%)`)
  console.log(`   No Decision: ${noDecision.length}\n`)

  // Analyze denied citations
  console.log(`❌ Denied Citations Analysis:\n`)

  // By AI score
  const deniedWithScore = denied.filter(c => c.aiPriorityScore !== null)
  const deniedHighScore = denied.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 70)
  const deniedMediumScore = denied.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 60 && c.aiPriorityScore < 70)
  const deniedLowScore = denied.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore < 60)
  const deniedNoScore = denied.filter(c => c.aiPriorityScore === null)

  console.log(`   With AI Score: ${deniedWithScore.length}`)
  console.log(`   High Score (>=70): ${deniedHighScore.length} ⚠️ Should be saved!`)
  console.log(`   Medium Score (60-69): ${deniedMediumScore.length}`)
  console.log(`   Low Score (<60): ${deniedLowScore.length}`)
  console.log(`   No Score: ${deniedNoScore.length}\n`)

  // By content extraction
  const deniedWithContent = denied.filter(c => c.contentText && c.contentText.length > 0)
  const deniedNoContent = denied.filter(c => !c.contentText || c.contentText.length === 0)
  const deniedShortContent = denied.filter(c => c.contentText && c.contentText.length > 0 && c.contentText.length < 500)
  const deniedGoodContent = denied.filter(c => c.contentText && c.contentText.length >= 500)

  console.log(`   With Content Extracted: ${deniedWithContent.length}`)
  console.log(`   No Content: ${deniedNoContent.length}`)
  console.log(`   Short Content (<500 chars): ${deniedShortContent.length}`)
  console.log(`   Good Content (>=500 chars): ${deniedGoodContent.length}\n`)

  // High-score denied with content (should have been saved!)
  const highScoreDeniedWithContent = denied.filter(
    c => c.aiPriorityScore !== null && 
    c.aiPriorityScore >= 70 && 
    c.contentText && 
    c.contentText.length >= 500
  )

  console.log(`⚠️  HIGH-SCORE DENIED WITH CONTENT (Should be saved!): ${highScoreDeniedWithContent.length}\n`)

  if (highScoreDeniedWithContent.length > 0) {
    console.log(`Sample high-score denied citations:\n`)
    highScoreDeniedWithContent.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c.citationUrl.substring(0, 80)}...`)
      console.log(`   Score: ${c.aiPriorityScore}, Content: ${c.contentText?.length || 0} chars`)
      if (c.errorMessage) {
        console.log(`   Error: ${c.errorMessage}`)
      }
      console.log()
    })
  }

  // Check for patterns in denied citations
  const deniedWithErrors = denied.filter(c => c.errorMessage)
  console.log(`   With Error Messages: ${deniedWithErrors.length}\n`)

  if (deniedWithErrors.length > 0) {
    const errorTypes = deniedWithErrors.reduce((acc, c) => {
      const error = c.errorMessage || 'unknown'
      const errorType = error.split(':')[0] || error.substring(0, 50)
      acc[errorType] = (acc[errorType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`Error Types:`)
    Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([error, count]) => {
        console.log(`   ${error}: ${count}`)
      })
    console.log()
  }

  // Compare with saved citations
  console.log(`✅ Saved Citations Analysis:\n`)

  const savedWithScore = saved.filter(c => c.aiPriorityScore !== null)
  const savedHighScore = saved.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 70)
  const savedWithContent = saved.filter(c => c.contentText && c.contentText.length > 0)

  console.log(`   With AI Score: ${savedWithScore.length}`)
  console.log(`   High Score (>=70): ${savedHighScore.length}`)
  console.log(`   With Content: ${savedWithContent.length}\n`)

  // Summary
  console.log(`📋 Summary:\n`)
  console.log(`   Save Rate: ${(saved.length / scanned.length * 100).toFixed(1)}% (Target: 15-35%)`)
  console.log(`   High-score denied: ${deniedHighScore.length} (should be saved!)`)
  console.log(`   Content extraction success: ${(deniedWithContent.length / denied.length * 100).toFixed(1)}%`)
  console.log(`   AI scoring success: ${(deniedWithScore.length / denied.length * 100).toFixed(1)}%\n`)

  // Recommendations
  console.log(`💡 Recommendations:\n`)
  
  if (deniedHighScore.length > 0) {
    console.log(`   1. Reprocess ${deniedHighScore.length} high-score denied citations`)
  }
  
  if (deniedNoScore.length > 0) {
    console.log(`   2. Investigate why ${deniedNoScore.length} citations have no AI score`)
  }
  
  if (deniedNoContent.length > 0) {
    console.log(`   3. Investigate why ${deniedNoContent.length} citations have no content extracted`)
  }
  
  if (deniedShortContent.length > 0) {
    console.log(`   4. Review ${deniedShortContent.length} citations with short content (<500 chars)`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

investigateLowSaveRate(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

