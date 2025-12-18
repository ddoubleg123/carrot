#!/usr/bin/env tsx
/**
 * Verify Agent Feed System
 * 
 * Comprehensive verification that checks:
 * - All DiscoveredContent is queued or fed
 * - Queue items are being processed
 * - AgentMemory entries are being created
 * - System is up to date
 * 
 * Usage:
 *   npx tsx scripts/verify-agent-feed-system.ts --patch=israel
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

const prisma = new PrismaClient()

async function verifySystem(patchHandle?: string) {
  console.log('\n🔍 AGENT FEED SYSTEM VERIFICATION\n')
  console.log('═'.repeat(80))

  const patches = patchHandle
    ? await prisma.patch.findMany({
        where: { handle: patchHandle },
        select: { id: true, handle: true, title: true }
      })
    : await prisma.patch.findMany({
        select: { id: true, handle: true, title: true }
      })

  if (patches.length === 0) {
    console.error('❌ No patches found')
    await prisma.$disconnect()
    return
  }

  let totalIssues = 0
  let totalHealthy = 0

  for (const patch of patches) {
    console.log(`\n📋 Patch: ${patch.title} (${patch.handle})`)
    console.log('─'.repeat(80))

    const issues: string[] = []

    // Get agent
    const agents = await AgentRegistry.getAgentsByPatches([patch.handle])
    if (agents.length === 0) {
      console.log('❌ No agent found')
      issues.push('No agent found for patch')
      totalIssues++
      continue
    }

    const agent = agents[0]
    console.log(`✅ Agent: ${agent.name} (${agent.id})`)

    // Get DiscoveredContent
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: { id: true, title: true, createdAt: true }
    })

    console.log(`\n📰 DiscoveredContent: ${discoveredContent.length} items`)

    // Get queue stats
    const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
      by: ['status'],
      where: { patchId: patch.id },
      _count: true
    })

    const queueCounts = {
      PENDING: 0,
      PROCESSING: 0,
      DONE: 0,
      FAILED: 0
    }

    for (const stat of queueStats) {
      queueCounts[stat.status as keyof typeof queueCounts] = stat._count
    }

    console.log(`\n📋 Queue Status:`)
    console.log(`   PENDING: ${queueCounts.PENDING}`)
    console.log(`   PROCESSING: ${queueCounts.PROCESSING}`)
    console.log(`   DONE: ${queueCounts.DONE}`)
    console.log(`   FAILED: ${queueCounts.FAILED}`)

    // Get AgentMemory entries
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
    console.log(`\n💾 AgentMemory: ${fedCount} entries from DiscoveredContent`)

    // Check coverage
    const fedContentIds = new Set(
      agentMemories
        .filter(m => m.discoveredContentId)
        .map(m => m.discoveredContentId!)
    )

    const queuedContentIds = new Set(
      (await (prisma as any).agentMemoryFeedQueue.findMany({
        where: { patchId: patch.id },
        select: { discoveredContentId: true }
      })).map((q: any) => q.discoveredContentId)
    )

    const allContentIds = new Set(discoveredContent.map(c => c.id))
    const missingContentIds = Array.from(allContentIds).filter(
      id => !fedContentIds.has(id) && !queuedContentIds.has(id)
    )

    const coverage = discoveredContent.length > 0
      ? ((fedCount / discoveredContent.length) * 100).toFixed(1)
      : '0'

    console.log(`\n📊 Coverage:`)
    console.log(`   Fed: ${fedCount}/${discoveredContent.length} (${coverage}%)`)
    console.log(`   Queued: ${queuedContentIds.size}`)
    console.log(`   Missing: ${missingContentIds.length}`)

    // Check for issues
    if (missingContentIds.length > 0) {
      issues.push(`${missingContentIds.length} DiscoveredContent items not queued or fed`)
      console.log(`\n⚠️  Missing items:`)
      for (const id of missingContentIds.slice(0, 5)) {
        const content = discoveredContent.find(c => c.id === id)
        console.log(`   - ${content?.title || id}`)
      }
      if (missingContentIds.length > 5) {
        console.log(`   ... and ${missingContentIds.length - 5} more`)
      }
    }

    if (queueCounts.PENDING > 50) {
      issues.push(`${queueCounts.PENDING} items pending (may need processing)`)
    }

    if (queueCounts.FAILED > 0) {
      issues.push(`${queueCounts.FAILED} items failed`)
    }

    if (queueCounts.PROCESSING > 10) {
      issues.push(`${queueCounts.PROCESSING} items stuck in PROCESSING`)
    }

    // Check for stuck items
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const stuckItems = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: {
        patchId: patch.id,
        status: 'PROCESSING',
        pickedAt: { lt: fiveMinutesAgo }
      },
      select: { id: true, pickedAt: true }
    })

    if (stuckItems.length > 0) {
      issues.push(`${stuckItems.length} items stuck in PROCESSING state`)
    }

    // Summary
    if (issues.length === 0) {
      console.log(`\n✅ System is healthy!`)
      totalHealthy++
    } else {
      console.log(`\n❌ Issues found:`)
      issues.forEach(issue => console.log(`   - ${issue}`))
      totalIssues++
    }
  }

  // Overall summary
  console.log(`\n\n📊 OVERALL SUMMARY`)
  console.log('═'.repeat(80))
  console.log(`   Patches checked: ${patches.length}`)
  console.log(`   Healthy: ${totalHealthy}`)
  console.log(`   With issues: ${totalIssues}`)

  if (totalIssues === 0) {
    console.log(`\n✅ All systems operational!`)
  } else {
    console.log(`\n⚠️  Some patches need attention`)
    console.log(`\n💡 To fix:`)
    console.log(`   1. Run: POST /api/agent-feed/process-all`)
    console.log(`   2. Or: npx tsx scripts/auto-feed-worker.ts`)
    console.log(`   3. Or: POST /api/patches/{handle}/agent/sync`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1]

verifySystem(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

