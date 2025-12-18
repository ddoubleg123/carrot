#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSavedExternalUrls() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Checking Saved External URLs\n')
  
  // Get external URLs that were scanned
  const scannedExternal = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
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
      savedContentId: true
    }
  })
  
  console.log(`Total scanned external URLs: ${scannedExternal.length}\n`)
  
  const saved = scannedExternal.filter(c => c.relevanceDecision === 'saved')
  const denied = scannedExternal.filter(c => c.relevanceDecision === 'denied')
  const withContent = scannedExternal.filter(c => c.contentText && c.contentText.length > 0)
  const withSavedContent = scannedExternal.filter(c => c.savedContentId !== null)
  
  console.log(`📊 Breakdown:`)
  console.log(`   Saved: ${saved.length} (${(saved.length / scannedExternal.length * 100).toFixed(1)}%)`)
  console.log(`   Denied: ${denied.length} (${(denied.length / scannedExternal.length * 100).toFixed(1)}%)`)
  console.log(`   With Content Extracted: ${withContent.length} (${(withContent.length / scannedExternal.length * 100).toFixed(1)}%)`)
  console.log(`   With savedContentId: ${withSavedContent.length}`)
  
  // Check AI scores
  const withScores = scannedExternal.filter(c => c.aiPriorityScore !== null)
  const highScores = scannedExternal.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 70)
  const mediumScores = scannedExternal.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 60 && c.aiPriorityScore < 70)
  const lowScores = scannedExternal.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore < 60)
  
  console.log(`\n🎯 AI Scoring:`)
  console.log(`   With Scores: ${withScores.length}`)
  console.log(`   High (>=70): ${highScores.length}`)
  console.log(`   Medium (60-69): ${mediumScores.length}`)
  console.log(`   Low (<60): ${lowScores.length}`)
  
  // Check content lengths
  const contentLengths = withContent.map(c => c.contentText?.length || 0)
  if (contentLengths.length > 0) {
    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length
    const minLength = Math.min(...contentLengths)
    const maxLength = Math.max(...contentLengths)
    console.log(`\n📄 Content Extraction:`)
    console.log(`   Average Length: ${avgLength.toFixed(0)} chars`)
    console.log(`   Min Length: ${minLength} chars`)
    console.log(`   Max Length: ${maxLength} chars`)
  }
  
  // Show some examples
  console.log(`\n✅ Sample Saved Citations:`)
  saved.slice(0, 5).forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.citationUrl.substring(0, 80)}...`)
    console.log(`      Score: ${c.aiPriorityScore || 'N/A'}, Content: ${c.contentText?.length || 0} chars`)
  })
  
  console.log(`\n❌ Sample Denied Citations (with high scores):`)
  const highScoreDenied = denied.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 60)
  highScoreDenied.slice(0, 5).forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.citationUrl.substring(0, 80)}...`)
    console.log(`      Score: ${c.aiPriorityScore}, Content: ${c.contentText?.length || 0} chars`)
  })
  
  await prisma.$disconnect()
}

checkSavedExternalUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

