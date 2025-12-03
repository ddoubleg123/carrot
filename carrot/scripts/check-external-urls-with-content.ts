/**
 * Check how many external URLs have extracted text/data
 * Show first 5 URLs with their extracted content
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

  console.log(`\n=== External URLs with Extracted Content for "${patch.title}" ===\n`)

  // Find external citations (not Wikipedia) with extracted content
  const externalCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: {
        not: {
          contains: 'wikipedia.org'
        }
      },
      contentText: {
        not: null
      },
      contentText: {
        not: ''
      }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      citationContext: true,
      contentText: true,
      aiPriorityScore: true,
      scanStatus: true,
      relevanceDecision: true,
      savedContentId: true,
      createdAt: true,
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 100 // Get more to show stats
  })

  console.log(`Total external URLs with extracted content: ${externalCitations.length}\n`)

  // Show first 5
  console.log('=== First 5 URLs with Extracted Content ===\n')
  
  externalCitations.slice(0, 5).forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.citationUrl}`)
    console.log(`   Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`   From Wikipedia: ${citation.monitoring.wikipediaTitle}`)
    console.log(`   Content Length: ${citation.contentText?.length || 0} characters`)
    console.log(`   AI Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    console.log(`   Status: ${citation.scanStatus} | Decision: ${citation.relevanceDecision || 'N/A'}`)
    console.log(`   Saved Content ID: ${citation.savedContentId || 'Not saved'}`)
    console.log(`   Content Preview (first 200 chars):`)
    console.log(`   ${(citation.contentText || '').substring(0, 200)}...`)
    console.log('')
  })

  // Statistics
  const withScores = externalCitations.filter(c => c.aiPriorityScore !== null).length
  const saved = externalCitations.filter(c => c.savedContentId !== null).length
  const denied = externalCitations.filter(c => c.relevanceDecision === 'denied').length
  const relevant = externalCitations.filter(c => c.relevanceDecision === 'saved').length

  console.log('\n=== Statistics ===')
  console.log(`Total external URLs with content: ${externalCitations.length}`)
  console.log(`With AI scores: ${withScores}`)
  console.log(`Saved to DiscoveredContent: ${saved}`)
  console.log(`Relevant (saved): ${relevant}`)
  console.log(`Denied: ${denied}`)
  console.log(`Pending decision: ${externalCitations.length - relevant - denied}`)

  await prisma.$disconnect()
}

main().catch(console.error)

