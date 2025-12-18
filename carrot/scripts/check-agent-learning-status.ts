#!/usr/bin/env tsx
/**
 * Check Agent Learning Status
 * 
 * Verifies if agents are learning from DiscoveredContent
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

const prisma = new PrismaClient()

async function checkAgentLearningStatus(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n🤖 AGENT LEARNING STATUS REPORT`)
  console.log(`   Patch: ${patch.title}\n`)
  console.log('═'.repeat(80))

  // Get agent
  const agents = await AgentRegistry.getAgentsByPatches([patchHandle])
  if (agents.length === 0) {
    console.log(`\n❌ No agent found for patch: ${patchHandle}`)
    console.log(`   Agents should be auto-created when patches are created.`)
    await prisma.$disconnect()
    return
  }

  const agent = agents[0]
  console.log(`\n✅ Agent Found:`)
  console.log(`   Name: ${agent.name}`)
  console.log(`   ID: ${agent.id}`)
  console.log(`   Associated Patches: ${agent.associatedPatches.length}`)

  // Get DiscoveredContent stats
  const allDiscoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: { id: true, title: true, sourceUrl: true, createdAt: true }
  })

  console.log(`\n\n📰 DISCOVERED CONTENT STATISTICS`)
  console.log('─'.repeat(80))
  console.log(`   Total DiscoveredContent Items: ${allDiscoveredContent.length.toLocaleString()}`)

  // Check AgentMemory (content already fed to agent)
  const agentMemories = await prisma.agentMemory.findMany({
    where: {
      agentId: agent.id,
      patchId: patch.id,
      sourceType: 'discovery'
    },
    select: {
      id: true,
      discoveredContentId: true,
      sourceTitle: true,
      sourceUrl: true,
      createdAt: true
    }
  })

  console.log(`\n\n💾 AGENT MEMORY STATISTICS`)
  console.log('─'.repeat(80))
  console.log(`   Total AgentMemory Entries: ${agentMemories.length.toLocaleString()}`)
  console.log(`   From DiscoveredContent: ${agentMemories.filter(m => m.discoveredContentId).length.toLocaleString()}`)
  console.log(`   Source Type 'discovery': ${agentMemories.filter(m => m.sourceType === 'discovery').length.toLocaleString()}`)

  // Check feed queue
  const feedQueue = await prisma.agentMemoryFeedQueue.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      status: true,
      discoveredContentId: true,
      enqueuedAt: true,
      pickedAt: true
    }
  })

  console.log(`\n\n📋 FEED QUEUE STATISTICS`)
  console.log('─'.repeat(80))
  console.log(`   Total Queue Items: ${feedQueue.length.toLocaleString()}`)
  
  const pending = feedQueue.filter(q => q.status === 'PENDING').length
  const processing = feedQueue.filter(q => q.status === 'PROCESSING').length
  const done = feedQueue.filter(q => q.status === 'DONE').length
  const failed = feedQueue.filter(q => q.status === 'FAILED').length

  console.log(`   PENDING: ${pending.toLocaleString()}`)
  console.log(`   PROCESSING: ${processing.toLocaleString()}`)
  console.log(`   DONE: ${done.toLocaleString()}`)
  console.log(`   FAILED: ${failed.toLocaleString()}`)

  // Calculate coverage
  const discoveredContentIds = new Set(allDiscoveredContent.map(c => c.id))
  const fedContentIds = new Set(agentMemories.filter(m => m.discoveredContentId).map(m => m.discoveredContentId!))
  const queuedContentIds = new Set(feedQueue.map(q => q.discoveredContentId))

  const fedCount = Array.from(fedContentIds).length
  const queuedCount = Array.from(queuedContentIds).length
  const totalCoverage = fedCount + queuedCount
  const coveragePercent = allDiscoveredContent.length > 0 
    ? ((totalCoverage / allDiscoveredContent.length) * 100).toFixed(1)
    : '0'

  console.log(`\n\n📊 COVERAGE ANALYSIS`)
  console.log('─'.repeat(80))
  console.log(`   Total DiscoveredContent: ${allDiscoveredContent.length.toLocaleString()}`)
  console.log(`   Already Fed to Agent: ${fedCount.toLocaleString()} (${((fedCount / allDiscoveredContent.length) * 100).toFixed(1)}%)`)
  console.log(`   Queued for Feeding: ${queuedCount.toLocaleString()} (${((queuedCount / allDiscoveredContent.length) * 100).toFixed(1)}%)`)
  console.log(`   Total Coverage: ${totalCoverage.toLocaleString()} (${coveragePercent}%)`)

  const notFed = allDiscoveredContent.length - totalCoverage
  if (notFed > 0) {
    console.log(`\n   ⚠️  ${notFed.toLocaleString()} items NOT yet fed to agent`)
  } else {
    console.log(`\n   ✅ All DiscoveredContent items are fed or queued!`)
  }

  // Check Wikipedia citation content specifically
  const wikipediaDiscoveredContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    },
    select: { id: true, title: true, sourceUrl: true }
  })

  const wikipediaFed = agentMemories.filter(m => {
    const contentId = m.discoveredContentId
    return contentId && wikipediaDiscoveredContent.some(w => w.id === contentId)
  }).length

  console.log(`\n\n📚 WIKIPEDIA CITATION CONTENT`)
  console.log('─'.repeat(80))
  console.log(`   DiscoveredContent from Citations: ${wikipediaDiscoveredContent.length.toLocaleString()}`)
  console.log(`   Fed to Agent: ${wikipediaFed.toLocaleString()} (${wikipediaDiscoveredContent.length > 0 ? ((wikipediaFed / wikipediaDiscoveredContent.length) * 100).toFixed(1) : 0}%)`)

  // Sample of recent memories
  const recentMemories = agentMemories
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  if (recentMemories.length > 0) {
    console.log(`\n\n📝 RECENT AGENT MEMORIES (Last 5)`)
    console.log('─'.repeat(80))
    recentMemories.forEach((memory, i) => {
      console.log(`\n   ${i + 1}. ${memory.sourceTitle || 'Untitled'}`)
      console.log(`      URL: ${memory.sourceUrl || 'N/A'}`)
      console.log(`      Date: ${new Date(memory.createdAt).toLocaleString()}`)
    })
  }

  // Recommendations
  console.log(`\n\n💡 RECOMMENDATIONS`)
  console.log('─'.repeat(80))
  
  if (notFed > 0) {
    console.log(`\n   ⚠️  Action Required:`)
    console.log(`      ${notFed.toLocaleString()} DiscoveredContent items are not yet fed to the agent.`)
    console.log(`      Run: POST /api/patches/${patchHandle}/agent/sync`)
    console.log(`      Or use: npx tsx scripts/feed-all-discovered-content.ts --patch=${patchHandle}`)
  }

  if (pending > 0) {
    console.log(`\n   ⚠️  ${pending.toLocaleString()} items are queued but not yet processed.`)
    console.log(`      The feed worker should process these automatically.`)
  }

  if (failed > 0) {
    console.log(`\n   ⚠️  ${failed.toLocaleString()} items failed to process.`)
    console.log(`      Check feed worker logs for errors.`)
  }

  if (notFed === 0 && pending === 0 && failed === 0) {
    console.log(`\n   ✅ All content is being fed to the agent!`)
    console.log(`      The agent is learning from all DiscoveredContent.`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

checkAgentLearningStatus(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

