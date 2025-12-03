/**
 * Debug why nothing is being saved - check citation scores and relevance decisions
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const patchHandle = 'israel'
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`Patch with handle "${patchHandle}" not found.`)
    return
  }

  console.log(`\n=== Debug: Why Nothing Is Saved for "${patch.title}" ===\n`)

  // Get citations that have been scanned
  const scannedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } },
      scanStatus: 'scanned'
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      contentText: true,
      savedContentId: true,
      sourceNumber: true,
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    },
    orderBy: {
      aiPriorityScore: 'desc'
    },
    take: 20
  })

  console.log(`Total Scanned Citations: ${scannedCitations.length}\n`)

  if (scannedCitations.length === 0) {
    console.log('No citations have been scanned yet. Check if processing is running.\n')
    return
  }

  // Analyze scores
  const withScores = scannedCitations.filter(c => c.aiPriorityScore !== null)
  const saved = scannedCitations.filter(c => c.savedContentId !== null)
  const denied = scannedCitations.filter(c => c.relevanceDecision === 'denied')
  const pending = scannedCitations.filter(c => c.relevanceDecision === null)

  console.log(`=== Statistics ===`)
  console.log(`With AI Scores: ${withScores.length}`)
  console.log(`Saved to DiscoveredContent: ${saved.length}`)
  console.log(`Denied: ${denied.length}`)
  console.log(`Pending Decision: ${pending.length}\n`)

  // Score distribution
  const scoreRanges = {
    '>= 60': withScores.filter(c => (c.aiPriorityScore ?? 0) >= 60).length,
    '50-59': withScores.filter(c => (c.aiPriorityScore ?? 0) >= 50 && (c.aiPriorityScore ?? 0) < 60).length,
    '40-49': withScores.filter(c => (c.aiPriorityScore ?? 0) >= 40 && (c.aiPriorityScore ?? 0) < 50).length,
    '< 40': withScores.filter(c => (c.aiPriorityScore ?? 0) < 40).length
  }

  console.log(`=== Score Distribution ===`)
  Object.entries(scoreRanges).forEach(([range, count]) => {
    console.log(`${range}: ${count}`)
  })
  console.log('')

  // Show top 10 by score
  console.log(`=== Top 10 Citations by AI Score ===\n`)
  scannedCitations.slice(0, 10).forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.citationUrl}`)
    console.log(`   Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`   From: ${citation.monitoring?.wikipediaTitle || 'N/A'}, Reference #${citation.sourceNumber}`)
    console.log(`   AI Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    console.log(`   Decision: ${citation.relevanceDecision || 'Pending'}`)
    console.log(`   Saved: ${citation.savedContentId ? 'YES' : 'NO'}`)
    if (citation.contentText) {
      console.log(`   Content Length: ${citation.contentText.length} chars`)
    }
    console.log('')
  })

  // Show citations that should have been saved (score >= 60 but not saved)
  const shouldBeSaved = scannedCitations.filter(c => 
    (c.aiPriorityScore ?? 0) >= 60 && 
    !c.savedContentId && 
    c.relevanceDecision !== 'saved'
  )

  if (shouldBeSaved.length > 0) {
    console.log(`\n=== ⚠️  Citations with Score >= 60 but NOT Saved (${shouldBeSaved.length}) ===\n`)
    shouldBeSaved.slice(0, 5).forEach((citation, index) => {
      console.log(`${index + 1}. ${citation.citationUrl}`)
      console.log(`   Score: ${citation.aiPriorityScore}`)
      console.log(`   Decision: ${citation.relevanceDecision || 'NULL'}`)
      console.log(`   Saved ID: ${citation.savedContentId || 'NULL'}`)
      console.log('')
    })
  }

  // Check DiscoveredContent
  const discoveredContent = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id
    }
  })

  console.log(`\n=== DiscoveredContent Table ===`)
  console.log(`Total items in DiscoveredContent: ${discoveredContent}`)
  console.log(`Items saved from citations: ${saved.length}`)
  console.log(`Gap: ${discoveredContent - saved.length} items from other sources\n`)

  await prisma.$disconnect()
}

main().catch(console.error)

