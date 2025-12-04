/**
 * Investigate why verified external URLs were not saved to DiscoveredContent
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'

  console.log(`\n=== Investigating Verified URLs Not Saved ===\n`)
  console.log(`Patch: ${patchHandle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Find verified citations that weren't saved
  const verifiedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      },
      verificationStatus: 'verified',
      savedContentId: null,
      savedMemoryId: null
    },
    include: {
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    },
    take: 50
  })

  console.log(`Found ${verifiedCitations.length} verified citations not saved\n`)

  if (verifiedCitations.length === 0) {
    console.log('No verified citations found that weren\'t saved')
    process.exit(0)
  }

  console.log(`=== Analysis of First 20 ===\n`)

  for (let i = 0; i < Math.min(20, verifiedCitations.length); i++) {
    const cit = verifiedCitations[i]
    console.log(`\n[${i + 1}] ${cit.citationUrl}`)
    console.log(`  Wikipedia Page: ${cit.monitoring.wikipediaTitle}`)
    console.log(`  Scan Status: ${cit.scanStatus}`)
    console.log(`  Verification: ${cit.verificationStatus}`)
    console.log(`  Relevance Decision: ${cit.relevanceDecision || 'null'}`)
    console.log(`  AI Score: ${cit.aiPriorityScore ?? 'null'}`)
    console.log(`  Content Length: ${cit.contentText?.length || 0} chars`)
    console.log(`  Content Text Preview: ${cit.contentText?.substring(0, 100) || 'N/A'}...`)
    
    // Check why it might not have been saved
    const reasons: string[] = []
    
    if (!cit.contentText || cit.contentText.length === 0) {
      reasons.push('No content extracted')
    } else if (cit.contentText.length < 500) {
      reasons.push(`Content too short (${cit.contentText.length} < 500 chars)`)
    }
    
    if (cit.aiPriorityScore === null || cit.aiPriorityScore === undefined) {
      reasons.push('No AI score')
    } else if (cit.aiPriorityScore < 60) {
      reasons.push(`AI score too low (${cit.aiPriorityScore} < 60)`)
    }
    
    if (cit.relevanceDecision === 'denied') {
      reasons.push('Relevance decision: denied')
    }
    
    if (cit.scanStatus !== 'scanned') {
      reasons.push(`Scan status: ${cit.scanStatus} (not 'scanned')`)
    }
    
    if (reasons.length > 0) {
      console.log(`  ⚠️  Reasons not saved: ${reasons.join(', ')}`)
    } else {
      console.log(`  ❓ No obvious reason - should have been saved`)
    }
  }

  // Summary statistics
  console.log(`\n=== Summary Statistics ===\n`)
  
  const withContent = verifiedCitations.filter(c => c.contentText && c.contentText.length > 0).length
  const withContent500Plus = verifiedCitations.filter(c => c.contentText && c.contentText.length >= 500).length
  const withAIScore = verifiedCitations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore !== undefined).length
  const withAIScore60Plus = verifiedCitations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore !== undefined && c.aiPriorityScore >= 60).length
  const denied = verifiedCitations.filter(c => c.relevanceDecision === 'denied').length
  const scanned = verifiedCitations.filter(c => c.scanStatus === 'scanned').length

  console.log(`Total verified citations not saved: ${verifiedCitations.length}`)
  console.log(`  - With content: ${withContent}`)
  console.log(`  - With content ≥500 chars: ${withContent500Plus}`)
  console.log(`  - With AI score: ${withAIScore}`)
  console.log(`  - With AI score ≥60: ${withAIScore60Plus}`)
  console.log(`  - Denied: ${denied}`)
  console.log(`  - Scanned: ${scanned}`)

  // Check if they're in DiscoveredContent but not linked
  console.log(`\n=== Checking DiscoveredContent ===\n`)
  
  let foundInDiscoveredContent = 0
  for (const cit of verifiedCitations.slice(0, 10)) {
    const found = await prisma.discoveredContent.findFirst({
      where: {
        patchId: patch.id,
        OR: [
          { canonicalUrl: cit.citationUrl },
          { sourceUrl: cit.citationUrl }
        ]
      }
    })
    
    if (found) {
      foundInDiscoveredContent++
      console.log(`  ✅ Found in DiscoveredContent: ${cit.citationUrl}`)
      console.log(`     Content ID: ${found.id}`)
      console.log(`     Title: ${found.title}`)
    }
  }

  if (foundInDiscoveredContent > 0) {
    console.log(`\n⚠️  ${foundInDiscoveredContent} citations found in DiscoveredContent but not linked in wikipediaCitation table`)
    console.log(`   This suggests a linking issue, not a save issue`)
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

