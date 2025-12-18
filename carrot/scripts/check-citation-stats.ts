import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Citation Statistics\n')

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('❌ Israel patch not found')
    process.exit(1)
  }

  console.log(`Patch: ${patch.title} (${patch.id})\n`)

  // Total citations
  const totalCitations = await prisma.wikipediaCitation.count({
    where: { monitoring: { patchId: patch.id } }
  })

  // By scan status
  const notScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'not_scanned'
    }
  })

  const scanning = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanning'
    }
  })

  const scanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned'
    }
  })

  // By relevance decision
  const saved = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    }
  })

  const denied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied'
    }
  })

  const noDecision = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      relevanceDecision: null
    }
  })

  // Citations with extracted content
  const withContent = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      AND: [
        { contentText: { not: null } },
        { contentText: { not: '' } }
      ]
    }
  })

  // Citations with saved content (DiscoveredContent)
  const withSavedContent = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      savedContentId: { not: null }
    }
  })

  // Citations with agent memories
  const citationsWithMemories = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      savedContentId: { not: null }
    }
  })

  // Get discovered content count (from Wikipedia citations)
  // These are linked via savedContentId in WikipediaCitation
  const discoveredContentCount = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      wikipediaCitations: {
        some: {
          monitoring: { patchId: patch.id }
        }
      }
    }
  })

  // Get agent memory count (from Wikipedia citations)
  const agentMemoryCount = await prisma.agentMemory.count({
    where: {
      patchId: patch.id,
      sourceType: 'wikipedia-citation'
    }
  })

  console.log('=== Citation Status ===')
  console.log(`Total Citations: ${totalCitations.toLocaleString()}`)
  console.log(`  - Not Scanned: ${notScanned.toLocaleString()}`)
  console.log(`  - Scanning: ${scanning.toLocaleString()}`)
  console.log(`  - Scanned: ${scanned.toLocaleString()}`)
  console.log()

  console.log('=== Relevance Decisions ===')
  console.log(`  - Saved: ${saved.toLocaleString()}`)
  console.log(`  - Denied: ${denied.toLocaleString()}`)
  console.log(`  - No Decision: ${noDecision.toLocaleString()}`)
  console.log()

  console.log('=== Content Extraction ===')
  console.log(`  - With Extracted Content: ${withContent.toLocaleString()}`)
  console.log(`  - With Saved Content (DiscoveredContent): ${withSavedContent.toLocaleString()}`)
  console.log()

  console.log('=== Downstream Processing ===')
  console.log(`  - DiscoveredContent Records: ${discoveredContentCount.toLocaleString()}`)
  console.log(`  - Agent Memories: ${agentMemoryCount.toLocaleString()}`)
  console.log()

  // Calculate percentages
  const scannedPct = totalCitations > 0 ? ((scanned / totalCitations) * 100).toFixed(1) : '0.0'
  const savedPct = scanned > 0 ? ((saved / scanned) * 100).toFixed(1) : '0.0'
  const extractedPct = scanned > 0 ? ((withContent / scanned) * 100).toFixed(1) : '0.0'
  const savedContentPct = saved > 0 ? ((withSavedContent / saved) * 100).toFixed(1) : '0.0'
  const memoryPct = withSavedContent > 0 ? ((agentMemoryCount / withSavedContent) * 100).toFixed(1) : '0.0'

  console.log('=== Percentages ===')
  console.log(`  - Scanned: ${scannedPct}% of total`)
  console.log(`  - Saved: ${savedPct}% of scanned`)
  console.log(`  - Extracted: ${extractedPct}% of scanned`)
  console.log(`  - Saved Content: ${savedContentPct}% of saved`)
  console.log(`  - Agent Memories: ${memoryPct}% of saved content`)
  console.log()

  // Get some recent examples
  const recentSaved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      savedContentId: { not: null }
    },
    orderBy: { lastScannedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      savedContentId: true,
      lastScannedAt: true
    }
  })

  console.log('=== Recent Saved Citations (with content) ===')
  for (const citation of recentSaved) {
    console.log(`  - ${citation.citationTitle || 'No title'}`)
    console.log(`    URL: ${citation.citationUrl}`)
    console.log(`    Saved: ${citation.lastScannedAt?.toISOString()}`)
    console.log(`    Content ID: ${citation.savedContentId}`)
    console.log()
  }

  await prisma.$disconnect()
}

main().catch(console.error)

