/**
 * Review extraction quality for processed citations
 * Shows sample citations with their extraction results
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function reviewExtractionQuality(patchHandle: string, limit: number = 20) {
  console.log(`\n📊 Reviewing extraction quality for: ${patchHandle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Get recently processed citations (saved or denied)
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      relevanceDecision: { in: ['saved', 'denied'] }
    },
    orderBy: { lastScannedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      citationTitle: true,
      citationUrl: true,
      relevanceDecision: true,
      aiPriorityScore: true,
      contentText: true,
      savedContentId: true
    }
  })

  console.log(`📝 Reviewing ${citations.length} recently processed citations:\n`)

  let savedCount = 0
  let deniedCount = 0
  let totalContentLength = 0
  let savedContentLength = 0
  let deniedContentLength = 0

  for (const citation of citations) {
    const contentLength = citation.contentText?.length || 0
    totalContentLength += contentLength

    if (citation.relevanceDecision === 'saved') {
      savedCount++
      savedContentLength += contentLength
    } else {
      deniedCount++
      deniedContentLength += contentLength
    }

    const status = citation.relevanceDecision === 'saved' ? '✅ SAVED' : '❌ DENIED'
    const score = citation.aiPriorityScore !== null ? citation.aiPriorityScore.toFixed(1) : 'N/A'
    const contentPreview = citation.contentText 
      ? citation.contentText.substring(0, 150).replace(/\n/g, ' ') + '...'
      : 'No content extracted'

    console.log(`${status} | Score: ${score} | Content: ${contentLength} chars`)
    console.log(`   Title: ${citation.citationTitle || 'Untitled'}`)
    console.log(`   URL: ${citation.citationUrl.substring(0, 80)}...`)
    console.log(`   Preview: ${contentPreview}`)
    if (citation.savedContentId) {
      console.log(`   Saved as: ${citation.savedContentId}`)
    }
    console.log()
  }

  // Get saved DiscoveredContent items
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      textContent: true,
      summary: true,
      sourceUrl: true,
      metadata: true
    }
  })

  console.log(`\n📦 Recently Saved DiscoveredContent (${savedContent.length} items):\n`)

  for (const content of savedContent) {
    const textLength = content.textContent?.length || 0
    const extractionMethod = (content.metadata as any)?.extractionMethod || 'unknown'
    const contentLength = (content.metadata as any)?.contentLength || textLength

    console.log(`✅ ${content.title}`)
    console.log(`   ID: ${content.id}`)
    console.log(`   URL: ${content.sourceUrl.substring(0, 80)}...`)
    console.log(`   Text length: ${textLength} chars`)
    console.log(`   Extraction method: ${extractionMethod}`)
    console.log(`   Summary: ${content.summary?.substring(0, 100)}...`)
    console.log()
  }

  // Summary stats
  const avgContentLength = citations.length > 0 ? (totalContentLength / citations.length).toFixed(0) : '0'
  const avgSavedLength = savedCount > 0 ? (savedContentLength / savedCount).toFixed(0) : '0'
  const avgDeniedLength = deniedCount > 0 ? (deniedContentLength / deniedCount).toFixed(0) : '0'

  console.log(`\n📊 Summary Statistics:`)
  console.log(`   Total reviewed: ${citations.length}`)
  console.log(`   Saved: ${savedCount} (${((savedCount / citations.length) * 100).toFixed(1)}%)`)
  console.log(`   Denied: ${deniedCount} (${((deniedCount / citations.length) * 100).toFixed(1)}%)`)
  console.log(`   Avg content length: ${avgContentLength} chars`)
  console.log(`   Avg saved length: ${avgSavedLength} chars`)
  console.log(`   Avg denied length: ${avgDeniedLength} chars`)
  console.log()
}

async function main() {
  const patchHandle = process.argv[2] || 'israel'
  const limit = parseInt(process.argv[3]) || 20

  try {
    await reviewExtractionQuality(patchHandle, limit)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

