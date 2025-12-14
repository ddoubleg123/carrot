/**
 * Check Agent Learning Status
 * 
 * Shows what an agent has learned, what it has access to, and its capabilities
 * 
 * Usage:
 *   ts-node scripts/check-agent-learning.ts --patch=israel
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

interface Args {
  patch?: string
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    }
  }
  
  return args
}

async function checkAgentLearning(patchHandle: string) {
  console.log(`\n🔍 Checking agent learning for patch: ${patchHandle}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true
    }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  console.log(`📋 Patch: ${patch.title}`)
  console.log(`   ID: ${patch.id}`)
  console.log(`   Tags: ${(patch.tags as string[] || []).join(', ') || 'None'}\n`)

  // Get agents for this patch
  const agents = await AgentRegistry.getAgentsByPatches([patchHandle])

  if (agents.length === 0) {
    console.log('❌ No agents found for this patch')
    console.log('\n💡 The agent should have been auto-created when the patch was created.')
    console.log('   Check if the patch creation process completed successfully.\n')
    process.exit(0)
  }

  const agent = agents[0]
  console.log(`🤖 Agent: ${agent.name}`)
  console.log(`   ID: ${agent.id}`)
  console.log(`   Persona: ${agent.persona.substring(0, 100)}...`)
  console.log(`   Domain Expertise: ${agent.domainExpertise.join(', ') || 'None'}`)
  console.log(`   Status: ${agent.isActive ? '✅ Active' : '❌ Inactive'}\n`)

  // Get agent memories
  const memories = await prisma.agentMemory.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      content: true,
      sourceType: true,
      sourceUrl: true,
      sourceTitle: true,
      createdAt: true
    }
  })

  console.log(`📚 Agent Memories: ${memories.length} total\n`)

  // Group by source type
  const bySourceType = memories.reduce((acc, mem) => {
    const type = mem.sourceType || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(mem)
    return acc
  }, {} as Record<string, typeof memories>)

  console.log('📊 Memories by Source Type:')
  for (const [type, mems] of Object.entries(bySourceType)) {
    console.log(`   ${type}: ${mems.length}`)
  }
  console.log()

  // Show recent memories
  if (memories.length > 0) {
    console.log('📖 Recent Memories (last 5):')
    for (const mem of memories.slice(0, 5)) {
      const preview = mem.content.substring(0, 100).replace(/\n/g, ' ')
      console.log(`\n   [${mem.sourceType}] ${mem.sourceTitle || 'Untitled'}`)
      console.log(`   ${preview}...`)
      console.log(`   Created: ${mem.createdAt.toISOString().split('T')[0]}`)
      if (mem.sourceUrl) {
        console.log(`   Source: ${mem.sourceUrl.substring(0, 60)}...`)
      }
    }
    console.log()
  } else {
    console.log('⚠️  No memories found!')
    console.log('\n💡 The agent has not learned anything yet.')
    console.log('   This could mean:')
    console.log('   1. The auto-feed pipeline is not running')
    console.log('   2. No discovered content has been fed to the agent')
    console.log('   3. The feed worker has not processed any queue items\n')
  }

  // Check discovered content count
  const discoveredContentCount = await prisma.discoveredContent.count({
    where: { patchId: patch.id }
  })

  console.log(`📰 Discovered Content: ${discoveredContentCount} items total\n`)

  // Check feed queue status (if table exists after migration)
  let queueStats: Array<{ status: string; _count: number }> = []
  try {
    queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
      by: ['status'],
      where: { patchId: patch.id },
      _count: true
    })
  } catch (error) {
    // Table might not exist yet (migration not run)
    console.log('📥 Feed Queue: Table not found (migration may not be run yet)\n')
  }

  if (queueStats.length > 0) {
    console.log('📥 Feed Queue Status:')
    for (const stat of queueStats) {
      console.log(`   ${stat.status}: ${stat._count}`)
    }
    console.log()
  } else {
    console.log('📥 Feed Queue: Empty (no items queued)\n')
  }

  // Check what the agent CAN do
  console.log('🎯 Agent Capabilities:')
  console.log('   ✅ Store memories from content')
  console.log('   ✅ Answer questions using stored memories')
  console.log('   ✅ Search memories by topic/query')
  console.log('   ✅ Participate in conversations (via Rabbit page)')
  console.log('   ✅ Generate insights from learned content')
  console.log('   ✅ Be trained with workflows')
  console.log()

  // Check what the agent CANNOT do yet
  console.log('❌ Current Limitations:')
  if (memories.length === 0) {
    console.log('   ⚠️  Agent has no memories - cannot answer questions yet')
  }
  if (bySourceType['discovery']?.length === 0) {
    console.log('   ⚠️  Agent has NOT learned from discovered content')
    console.log('      Only learning from manual posts/facts/events')
  }
  console.log('   ⚠️  Auto-feed pipeline may not be running')
  console.log('   ⚠️  No real-time learning from new discoveries')
  console.log()

  // Recommendations
  console.log('💡 Recommendations:')
  if (discoveredContentCount > 0 && memories.length === 0) {
    console.log('   1. Run backfill script to feed existing discovered content:')
    console.log(`      ts-node scripts/backfill-agent-memory.ts --patch=${patchHandle}`)
  }
  if (queueStats.length > 0 && queueStats.find((s: { status: string }) => s.status === 'PENDING')) {
    console.log('   2. Start the feed worker to process queued items')
  }
  console.log('   3. Check agent health endpoint:')
  console.log(`      GET /api/patches/${patchHandle}/agent/health`)
  console.log('   4. Trigger manual sync:')
  console.log(`      POST /api/patches/${patchHandle}/agent/sync`)
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    
    await checkAgentLearning(patchHandle)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

