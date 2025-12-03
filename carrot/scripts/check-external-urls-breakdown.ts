/**
 * Check external URLs breakdown:
 * - Which Wikipedia pages they're from
 * - How many identified vs processed vs read
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  // Get Israel patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Israel patch not found')
    process.exit(1)
  }

  console.log(`\n=== External URLs Breakdown for "${patch.title}" ===\n`)

  // Get ALL citations (external and Wikipedia)
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      scanStatus: true,
      verificationStatus: true,
      contentText: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      savedContentId: true,
      monitoring: {
        select: {
          wikipediaTitle: true,
          wikipediaUrl: true
        }
      }
    }
  })

  // Separate external vs Wikipedia
  const externalCitations = allCitations.filter(c => 
    !c.citationUrl.includes('wikipedia.org')
  )
  const wikipediaCitations = allCitations.filter(c => 
    c.citationUrl.includes('wikipedia.org')
  )

  console.log(`Total Citations: ${allCitations.length}`)
  console.log(`  - External URLs: ${externalCitations.length}`)
  console.log(`  - Wikipedia URLs: ${wikipediaCitations.length}\n`)

  // External URL breakdown
  console.log('=== External URLs Breakdown ===\n')
  
  const identified = externalCitations.length
  const verified = externalCitations.filter(c => c.verificationStatus === 'verified').length
  const verifiedFailed = externalCitations.filter(c => c.verificationStatus === 'failed').length
  const pending = externalCitations.filter(c => c.verificationStatus === 'pending').length
  
  const scanned = externalCitations.filter(c => c.scanStatus === 'scanned').length
  const notScanned = externalCitations.filter(c => c.scanStatus === 'not_scanned').length
  const scanning = externalCitations.filter(c => c.scanStatus === 'scanning').length
  
  const withContent = externalCitations.filter(c => c.contentText && c.contentText.length > 0).length
  const withScores = externalCitations.filter(c => c.aiPriorityScore !== null).length
  const saved = externalCitations.filter(c => c.savedContentId !== null).length
  const denied = externalCitations.filter(c => c.relevanceDecision === 'denied').length
  const savedDecision = externalCitations.filter(c => c.relevanceDecision === 'saved').length

  console.log(`Identified: ${identified}`)
  console.log(`  - Verified: ${verified}`)
  console.log(`  - Verification Failed: ${verifiedFailed}`)
  console.log(`  - Pending Verification: ${pending}\n`)

  console.log(`Read/Processed: ${scanned}`)
  console.log(`  - Not Scanned: ${notScanned}`)
  console.log(`  - Currently Scanning: ${scanning}\n`)

  console.log(`With Extracted Content: ${withContent}`)
  console.log(`With AI Scores: ${withScores}`)
  console.log(`Saved to DiscoveredContent: ${saved}`)
  console.log(`  - Decision: Saved: ${savedDecision}`)
  console.log(`  - Decision: Denied: ${denied}`)
  console.log(`  - No Decision Yet: ${identified - savedDecision - denied}\n`)

  // Group by Wikipedia page
  console.log('=== External URLs by Wikipedia Page ===\n')
  
  const byWikipediaPage = externalCitations.reduce((acc, citation) => {
    const pageTitle = citation.monitoring.wikipediaTitle || 'Unknown'
    if (!acc[pageTitle]) {
      acc[pageTitle] = {
        total: 0,
        scanned: 0,
        withContent: 0,
        saved: 0,
        denied: 0
      }
    }
    acc[pageTitle].total++
    if (citation.scanStatus === 'scanned') acc[pageTitle].scanned++
    if (citation.contentText && citation.contentText.length > 0) acc[pageTitle].withContent++
    if (citation.savedContentId) acc[pageTitle].saved++
    if (citation.relevanceDecision === 'denied') acc[pageTitle].denied++
    return acc
  }, {} as Record<string, { total: number; scanned: number; withContent: number; saved: number; denied: number }>)

  // Sort by total count
  const sortedPages = Object.entries(byWikipediaPage)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10) // Top 10

  sortedPages.forEach(([pageTitle, stats], index) => {
    console.log(`${index + 1}. ${pageTitle}`)
    console.log(`   Total External URLs: ${stats.total}`)
    console.log(`   Scanned: ${stats.scanned}`)
    console.log(`   With Content: ${stats.withContent}`)
    console.log(`   Saved: ${stats.saved}`)
    console.log(`   Denied: ${stats.denied}`)
    console.log('')
  })

  // Show first 5 external URLs with their Wikipedia pages
  console.log('\n=== First 5 External URLs with Wikipedia Source ===\n')
  
  externalCitations.slice(0, 5).forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.citationUrl}`)
    console.log(`   From Wikipedia: ${citation.monitoring.wikipediaTitle}`)
    console.log(`   Wikipedia URL: ${citation.monitoring.wikipediaUrl}`)
    console.log(`   Status: ${citation.scanStatus} | Verification: ${citation.verificationStatus}`)
    console.log(`   Has Content: ${citation.contentText ? 'Yes (' + citation.contentText.length + ' chars)' : 'No'}`)
    console.log(`   AI Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    console.log(`   Decision: ${citation.relevanceDecision || 'Pending'}`)
    console.log(`   Saved: ${citation.savedContentId ? 'Yes (' + citation.savedContentId + ')' : 'No'}`)
    console.log('')
  })

  await prisma.$disconnect()
}

main().catch(console.error)

