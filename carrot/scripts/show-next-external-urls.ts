/**
 * Show next external URLs to process with their Wikipedia source and reference numbers
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

  console.log(`\n=== Next External URLs to Process for "${patch.title}" ===\n`)

  // Get next 10 citations to process (ordered by priority)
  const nextCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } }, // External URLs only
      verificationStatus: { in: ['pending', 'verified'] },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null // Not yet decided
    },
    orderBy: [
      { aiPriorityScore: 'desc' },
      { createdAt: 'asc' }
    ],
    take: 10,
    include: {
      monitoring: {
        select: {
          wikipediaTitle: true,
          wikipediaUrl: true
        }
      }
    }
  })

  if (nextCitations.length === 0) {
    console.log('No external URLs pending processing.\n')
    
    // Show statistics
    const totalExternal = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        citationUrl: { not: { contains: 'wikipedia.org' } }
      }
    })
    
    const processed = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        citationUrl: { not: { contains: 'wikipedia.org' } },
        relevanceDecision: { not: null }
      }
    })
    
    console.log(`Total External URLs: ${totalExternal}`)
    console.log(`Processed (with decision): ${processed}`)
    console.log(`Pending: ${totalExternal - processed}\n`)
    return
  }

  console.log(`Found ${nextCitations.length} external URLs ready to process:\n`)

  nextCitations.forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.citationUrl}`)
    console.log(`   Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`   From Wikipedia: ${citation.monitoring?.wikipediaTitle || 'N/A'}`)
    console.log(`   Wikipedia URL: ${citation.monitoring?.wikipediaUrl || 'N/A'}`)
    console.log(`   Reference #${citation.sourceNumber} on that page`)
    console.log(`   AI Priority Score: ${citation.aiPriorityScore ?? 'N/A'}`)
    console.log(`   Status: ${citation.scanStatus} | Verification: ${citation.verificationStatus}`)
    console.log(`   Decision: ${citation.relevanceDecision || 'Pending'}`)
    if (citation.citationContext) {
      console.log(`   Context: ${citation.citationContext.substring(0, 100)}...`)
    }
    console.log('')
  })

  // Show summary by Wikipedia page
  console.log(`=== Summary by Wikipedia Page ===\n`)
  const byWikiPage = nextCitations.reduce((acc, citation) => {
    const wikiTitle = citation.monitoring?.wikipediaTitle || 'Unknown'
    if (!acc[wikiTitle]) {
      acc[wikiTitle] = []
    }
    acc[wikiTitle].push(citation)
    return acc
  }, {} as Record<string, typeof nextCitations>)

  Object.entries(byWikiPage).forEach(([wikiTitle, citations]) => {
    console.log(`${wikiTitle}:`)
    citations.forEach(c => {
      console.log(`  - Reference #${c.sourceNumber}: ${c.citationUrl}`)
    })
    console.log('')
  })

  await prisma.$disconnect()
}

main().catch(console.error)

