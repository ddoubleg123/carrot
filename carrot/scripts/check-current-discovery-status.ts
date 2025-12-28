/**
 * Quick script to check current discovery run status
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

async function main() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  // Get latest discovery run
  const latestRun = await prisma.discoveryRun.findFirst({
    where: { patchId: patch.id },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      metrics: true
    }
  })

  if (!latestRun) {
    console.log('No discovery runs found')
    process.exit(0)
  }

  console.log(`\n🔍 Latest Discovery Run: ${latestRun.id}`)
  console.log(`   Status: ${latestRun.status}`)
  console.log(`   Started: ${latestRun.startedAt}`)
  if (latestRun.endedAt) {
    console.log(`   Ended: ${latestRun.endedAt}`)
    const duration = Math.floor((latestRun.endedAt.getTime() - latestRun.startedAt.getTime()) / 1000)
    console.log(`   Duration: ${duration}s`)
  } else {
    const duration = Math.floor((Date.now() - latestRun.startedAt.getTime()) / 1000)
    console.log(`   Running for: ${duration}s`)
  }

  // Get content saved since run started
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      createdAt: { gte: latestRun.startedAt }
    },
    select: {
      id: true,
      title: true,
      sourceDomain: true,
      category: true,
      type: true,
      textContent: true,
      createdAt: true
    }
  })

  const annasArchive = savedContent.filter(c => c.sourceDomain?.includes('annas-archive.org') || c.type === 'book')
  const newsAPI = savedContent.filter(c => (c as any).metadata?.source === 'NewsAPI')
  const wikipedia = savedContent.filter(c => c.sourceDomain?.includes('wikipedia.org') || c.category === 'wikipedia')
  const citations = savedContent.filter(c => c.category === 'wikipedia_citation')

  console.log(`\n💾 Content Saved: ${savedContent.length} items`)
  console.log(`   ├─ Anna's Archive: ${annasArchive.length}`)
  console.log(`   ├─ NewsAPI: ${newsAPI.length}`)
  console.log(`   ├─ Wikipedia Pages: ${wikipedia.filter(c => c.category !== 'wikipedia_citation').length}`)
  console.log(`   └─ Wikipedia Citations: ${citations.length}`)

  // Get citations
  const citationsFound = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      createdAt: { gte: latestRun.startedAt }
    },
    select: {
      id: true,
      savedContentId: true,
      scanStatus: true
    }
  })

  const citationsSaved = citationsFound.filter(c => c.savedContentId !== null).length

  console.log(`\n📚 Wikipedia Citations:`)
  console.log(`   Found: ${citationsFound.length}`)
  console.log(`   Saved: ${citationsSaved}`)

  // Get agent learning stats
  const feedQueue = await prisma.agentMemoryFeedQueue.count({
    where: {
      patchId: patch.id,
      enqueuedAt: { gte: latestRun.startedAt }
    }
  })

  const memories = await prisma.agentMemory.count({
    where: {
      patchId: patch.id,
      createdAt: { gte: latestRun.startedAt }
    }
  })

  console.log(`\n🤖 Agent Learning:`)
  console.log(`   Feed Queue Items: ${feedQueue}`)
  console.log(`   Memories Created: ${memories}`)

  // Run metrics
  const metrics = latestRun.metrics as any || {}
  console.log(`\n⚙️  Processing Stats:`)
  console.log(`   Processed: ${metrics.candidatesProcessed || metrics.processed || 0}`)
  console.log(`   Saved: ${metrics.itemsSaved || metrics.saved || savedContent.length}`)
  console.log(`   Duplicates: ${metrics.duplicates || 0}`)
  console.log(`   Failures: ${metrics.failures || 0}`)

  await prisma.$disconnect()
}

main().catch(console.error)

