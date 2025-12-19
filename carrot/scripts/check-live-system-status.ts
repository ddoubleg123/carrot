#!/usr/bin/env tsx
/**
 * Check Live System Status
 * 
 * Verifies:
 * 1. Agent learning status
 * 2. Saved heroes/discovered content
 * 3. System health
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

const prisma = new PrismaClient()

async function checkSystemStatus(patchHandle: string) {
  console.log(`\n🔍 LIVE SYSTEM STATUS CHECK`)
  console.log(`   Patch: ${patchHandle}\n`)
  console.log('═'.repeat(80))

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    await prisma.$disconnect()
    return
  }

  // ============================================
  // 1. AGENT LEARNING STATUS
  // ============================================
  console.log(`\n1️⃣  AGENT LEARNING STATUS\n`)
  console.log('─'.repeat(80))

  const agents = await AgentRegistry.getAgentsByPatches([patchHandle])
  if (agents.length === 0) {
    console.log(`❌ No agent found for patch`)
  } else {
    const agent = agents[0]
    console.log(`✅ Agent: ${agent.name} (${agent.id})`)

    // Get DiscoveredContent count
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: { id: true }
    })

    // Get AgentMemory entries from DiscoveredContent
    const agentMemories = await prisma.agentMemory.findMany({
      where: {
        agentId: agent.id,
        patchId: patch.id,
        sourceType: 'discovery'
      },
      select: {
        discoveredContentId: true,
        createdAt: true
      }
    })

    const fedCount = agentMemories.filter(m => m.discoveredContentId).length
    const coverage = discoveredContent.length > 0
      ? ((fedCount / discoveredContent.length) * 100).toFixed(1)
      : '0'

    console.log(`\n   DiscoveredContent: ${discoveredContent.length.toLocaleString()} items`)
    console.log(`   AgentMemory entries: ${fedCount.toLocaleString()} (${coverage}% coverage)`)
    console.log(`   Learning status: ${fedCount > 0 ? '✅ Learning' : '⚠️  Not learning'}`)

    // Check recent learning
    const recentMemories = agentMemories
      .filter(m => m.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .length

    console.log(`   Recent (24h): ${recentMemories} new memories`)
  }

  // ============================================
  // 2. SAVED HEROES / DISCOVERED CONTENT
  // ============================================
  console.log(`\n\n2️⃣  SAVED HEROES / DISCOVERED CONTENT\n`)
  console.log('─'.repeat(80))

  const allDiscoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      createdAt: true,
      metadata: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`   Total DiscoveredContent: ${allDiscoveredContent.length.toLocaleString()}`)

  // Count by source
  const fromCitations = allDiscoveredContent.filter(dc => {
    const metadata = dc.metadata as any
    return metadata?.source === 'wikipedia-citation'
  }).length

  const fromWeb = allDiscoveredContent.filter(dc => {
    const metadata = dc.metadata as any
    return metadata?.source !== 'wikipedia-citation'
  }).length

  console.log(`   From Wikipedia Citations: ${fromCitations.toLocaleString()}`)
  console.log(`   From Web Discovery: ${fromWeb.toLocaleString()}`)

  // Check if they're visible (have proper fields)
  const withTitle = allDiscoveredContent.filter(dc => dc.title && dc.title.length > 0).length
  const withContent = allDiscoveredContent.filter(dc => {
    // Check if content exists (would need to query full record)
    return true // Assume they have content if they're saved
  }).length

  console.log(`   With titles: ${withTitle.toLocaleString()}`)
  console.log(`   Status: ${withTitle === allDiscoveredContent.length ? '✅ All have titles' : '⚠️  Some missing titles'}`)

  // Recent additions
  const recentContent = allDiscoveredContent.filter(
    dc => dc.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length

  console.log(`   Recent (7 days): ${recentContent} new items`)

  // ============================================
  // 3. QUEUE STATUS
  // ============================================
  console.log(`\n\n3️⃣  FEED QUEUE STATUS\n`)
  console.log('─'.repeat(80))

  const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
    by: ['status'],
    where: { patchId: patch.id },
    _count: true
  })

  const stats = {
    PENDING: 0,
    PROCESSING: 0,
    DONE: 0,
    FAILED: 0
  }

  for (const stat of queueStats) {
    stats[stat.status as keyof typeof stats] = stat._count
  }

  console.log(`   PENDING: ${stats.PENDING.toLocaleString()}`)
  console.log(`   PROCESSING: ${stats.PROCESSING.toLocaleString()}`)
  console.log(`   DONE: ${stats.DONE.toLocaleString()}`)
  console.log(`   FAILED: ${stats.FAILED.toLocaleString()}`)

  const totalQueued = Object.values(stats).reduce((a, b) => a + b, 0)
  const queueHealth = stats.PENDING < 10 && stats.FAILED === 0 && stats.PROCESSING < 5
  console.log(`   Status: ${queueHealth ? '✅ Healthy' : '⚠️  Needs attention'}`)

  // ============================================
  // 4. EXPECTED VS ACTUAL
  // ============================================
  console.log(`\n\n4️⃣  EXPECTED VS ACTUAL\n`)
  console.log('─'.repeat(80))

  // Get citation stats
  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    select: { id: true }
  })

  console.log(`   Saved Citations: ${savedCitations.length.toLocaleString()}`)
  console.log(`   DiscoveredContent: ${allDiscoveredContent.length.toLocaleString()}`)
  console.log(`   Ratio: ${savedCitations.length > 0 ? ((allDiscoveredContent.length / savedCitations.length) * 100).toFixed(1) : 0}%`)

  // Check if citations are creating DiscoveredContent
  const citationsWithContent = allDiscoveredContent.filter(dc => {
    const metadata = dc.metadata as any
    return metadata?.source === 'wikipedia-citation'
  }).length

  console.log(`\n   Citations → DiscoveredContent:`)
  console.log(`   Expected: ~${savedCitations.length} (one per saved citation)`)
  console.log(`   Actual: ${citationsWithContent}`)
  console.log(`   Match: ${citationsWithContent === savedCitations.length ? '✅' : '⚠️  Mismatch'}`)

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n\n📊 SUMMARY\n`)
  console.log('═'.repeat(80))

  const fedCount = agents.length > 0 
    ? (await prisma.agentMemory.findMany({
        where: {
          agentId: agents[0].id,
          patchId: patch.id,
          sourceType: 'discovery',
          discoveredContentId: { not: null }
        },
        select: { id: true }
      })).length
    : 0

  const agentLearning = agents.length > 0 && fedCount > 0
  const heroesVisible = allDiscoveredContent.length > 0 && withTitle === allDiscoveredContent.length
  const queueWorking = queueHealth

  console.log(`\n   ✅ Agent Learning: ${agentLearning ? 'YES' : 'NO'}`)
  console.log(`   ✅ Heroes Visible: ${heroesVisible ? 'YES' : 'NO'}`)
  console.log(`   ✅ Queue Working: ${queueWorking ? 'YES' : 'NO'}`)

  if (agentLearning && heroesVisible && queueWorking) {
    console.log(`\n   🎉 System is fully operational!`)
  } else {
    console.log(`\n   ⚠️  Some issues detected - see details above`)
  }

  // Expected hero count
  console.log(`\n\n💡 EXPECTED HERO COUNT\n`)
  console.log('─'.repeat(80))
  console.log(`   Based on saved citations: ~${savedCitations.length.toLocaleString()}`)
  console.log(`   Current DiscoveredContent: ${allDiscoveredContent.length.toLocaleString()}`)
  console.log(`   Recommendation: Should have ~${savedCitations.length.toLocaleString()} heroes from citations`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

checkSystemStatus(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

