#!/usr/bin/env tsx
/**
 * Verify Agent Learning Pipeline
 * 
 * Checks if saved citations are being fed to agents automatically
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyAgentLearning(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔍 Verifying Agent Learning for: ${patch.title}\n`)

  // Get saved citations
  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      savedContentId: { not: null }
    },
    select: {
      id: true,
      citationUrl: true,
      savedContentId: true
    }
  })

  console.log(`Saved citations: ${savedCitations.length}\n`)

  // Check if DiscoveredContent exists
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true
    }
  })

  console.log(`DiscoveredContent items (from citations): ${discoveredContent.length}\n`)

  // Check agent feed queue
  const feedQueue = await prisma.agentMemoryFeedQueue.findMany({
    where: {
      patchId: patch.id
    },
    select: {
      id: true,
      status: true,
      discoveredContentId: true
    }
  })

  const queueByStatus = feedQueue.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`Agent Feed Queue:`)
  console.log(`   Total: ${feedQueue.length}`)
  Object.entries(queueByStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`)
  })
  console.log()

  // Check agent memories (agents are linked via associatedPatches)
  const agent = await prisma.agent.findFirst({
    where: {
      associatedPatches: {
        has: patch.id
      }
    },
    select: {
      id: true,
      name: true
    }
  })

  if (agent) {
    const memories = await prisma.agentMemory.count({
      where: {
        agentId: agent.id
      }
    })

    const memoriesFromDiscovery = await prisma.agentMemory.count({
      where: {
        agentId: agent.id,
        patchId: patch.id,
        discoveredContentId: { not: null }
      }
    })

    console.log(`Agent: ${agent.name} (${agent.id})`)
    console.log(`   Total Memories: ${memories}`)
    console.log(`   From Discovery: ${memoriesFromDiscovery}\n`)

    // Check if agent has memories from citations
    const memoriesFromCitations = await prisma.agentMemory.count({
      where: {
        agentId: agent.id,
        patchId: patch.id,
        sourceType: 'discovery',
        sourceUrl: { contains: 'http' }
      }
    })

    console.log(`   From Citations: ${memoriesFromCitations}\n`)
  } else {
    console.log(`⚠️  No agent found for this patch\n`)
  }

  // Check if auto-feed is working
  const recentSaved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      savedContentId: { not: null },
      updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    },
    select: {
      id: true,
      savedContentId: true
    }
  })

  const recentInQueue = await prisma.agentMemoryFeedQueue.count({
    where: {
      patchId: patch.id,
      discoveredContentId: {
        in: recentSaved.map(c => c.savedContentId).filter((id): id is string => id !== null)
      }
    }
  })

  console.log(`Auto-Feed Status:`)
  console.log(`   Citations saved in last 24h: ${recentSaved.length}`)
  console.log(`   In feed queue: ${recentInQueue}`)
  console.log(`   Coverage: ${recentSaved.length > 0 ? (recentInQueue / recentSaved.length * 100).toFixed(1) : 0}%\n`)

  // Recommendations
  console.log(`💡 Recommendations:\n`)

  if (discoveredContent.length < savedCitations.length) {
    console.log(`   ⚠️  Some saved citations don't have DiscoveredContent entries`)
  }

  if (feedQueue.length === 0 && discoveredContent.length > 0) {
    console.log(`   ⚠️  Feed queue is empty - citations may not be auto-feeding`)
    console.log(`   → Check if enqueue hooks are working in engineV21.ts`)
  }

  if (agent) {
    const memoriesFromDiscovery = await prisma.agentMemory.count({
      where: {
        agentId: agent.id,
        patchId: patch.id,
        discoveredContentId: { not: null }
      }
    })
    
    if (memoriesFromDiscovery === 0 && discoveredContent.length > 0) {
      console.log(`   ⚠️  Agent has no memories from discovery`)
      console.log(`   → Run backfill script to feed existing content`)
    }
  }

  if (recentInQueue < recentSaved.length) {
    console.log(`   ⚠️  Recent citations not in feed queue`)
    console.log(`   → Check auto-feed pipeline is enabled`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

verifyAgentLearning(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

