/**
 * Check Citation Processing Status
 * 
 * Shows comprehensive status of citation processing, including:
 * - Total citations
 * - Processed vs unprocessed
 * - Saved vs denied
 * - Hero images generated
 * - Agent feeding status
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function checkStatus() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n📊 Citation Processing Status for ${patch.title}\n`)

  // Total citations
  const total = await prisma.wikipediaCitation.count({
    where: { monitoring: { patchId: patch.id } }
  })

  // Processing status
  const scanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned'
    }
  })

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

  // Decision status
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
      relevanceDecision: null
    }
  })

  // DiscoveredContent from citations
  const discoveredFromCitations = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    }
  })

  // Hero images for citation-sourced content
  const withHeroes = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      },
      hero: {
        not: null
      }
    }
  })

  // Agent memory from citations (query by sourceType only - discovery fields not in Prisma types yet)
  const agentMemories = await prisma.agentMemory.count({
    where: {
      sourceType: 'discovery'
    }
  })

  // Agent feed queue status (using type assertion since Prisma types don't include this model)
  let queued = 0
  let processing = 0
  let done = 0
  let failed = 0
  
  try {
    queued = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'PENDING'
      }
    }) || 0

    processing = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'PROCESSING'
      }
    }) || 0

    done = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'DONE'
      }
    }) || 0

    failed = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'FAILED'
      }
    }) || 0
  } catch (error) {
    console.warn('Could not query agentMemoryFeedQueue:', error)
  }

  console.log('📈 Citation Statistics:')
  console.log(`   Total citations: ${total.toLocaleString()}`)
  console.log(`   Scanned: ${scanned.toLocaleString()} (${((scanned / total) * 100).toFixed(1)}%)`)
  console.log(`   Not scanned: ${notScanned.toLocaleString()} (${((notScanned / total) * 100).toFixed(1)}%)`)
  console.log(`   Scanning: ${scanning.toLocaleString()}`)
  console.log()

  console.log('✅ Decision Status:')
  console.log(`   Saved: ${saved.toLocaleString()} (${((saved / total) * 100).toFixed(1)}%)`)
  console.log(`   Denied: ${denied.toLocaleString()} (${((denied / total) * 100).toFixed(1)}%)`)
  console.log(`   No decision: ${noDecision.toLocaleString()} (${((noDecision / total) * 100).toFixed(1)}%)`)
  console.log()

  console.log('💾 DiscoveredContent:')
  console.log(`   From citations: ${discoveredFromCitations.toLocaleString()}`)
  console.log(`   With hero images: ${withHeroes.toLocaleString()} (${discoveredFromCitations > 0 ? ((withHeroes / discoveredFromCitations) * 100).toFixed(1) : 0}%)`)
  console.log()

  console.log('🤖 Agent Learning:')
  console.log(`   Memories created: ${agentMemories.toLocaleString()}`)
  console.log(`   Feed queue - Queued: ${queued.toLocaleString()}`)
  console.log(`   Feed queue - Processing: ${processing.toLocaleString()}`)
  console.log(`   Feed queue - Done: ${done.toLocaleString()}`)
  console.log(`   Feed queue - Failed: ${failed.toLocaleString()}`)
  console.log()

  // Processing progress
  const processed = scanned
  const remaining = notScanned + scanning
  const progress = total > 0 ? ((processed / total) * 100).toFixed(1) : '0'
  
  console.log('📊 Overall Progress:')
  console.log(`   Processed: ${processed.toLocaleString()} / ${total.toLocaleString()} (${progress}%)`)
  console.log(`   Remaining: ${remaining.toLocaleString()}`)
  console.log()

  // Sample of recent saved citations
  const recentSaved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      citationTitle: true,
      citationUrl: true,
      aiPriorityScore: true,
      savedContentId: true,
      updatedAt: true
    }
  })

  if (recentSaved.length > 0) {
    console.log('📝 Recent Saved Citations:')
    recentSaved.forEach((citation, i) => {
      console.log(`   ${i + 1}. ${citation.citationTitle || citation.citationUrl.substring(0, 60)}`)
      console.log(`      Score: ${citation.aiPriorityScore || 'N/A'}, Saved: ${citation.savedContentId ? 'Yes' : 'No'}`)
      console.log(`      Updated: ${citation.updatedAt.toISOString().split('T')[0]}`)
    })
    console.log()
  }
}

checkStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

